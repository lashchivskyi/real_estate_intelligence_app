import { getDemoComps } from "@/data/demo-comps";
import { SAMPLE_ISSUES, SAMPLE_LEGAL, SAMPLE_PROPERTY } from "@/data/samples";
import { PRIORITIES, type Brief } from "@/domain/brief";
import { getCityOrDefault } from "@/domain/location/registry";
import { apartmentInputSchema, toProperty, type Property } from "@/domain/property/types";
import { buildReport, type ReportData } from "@/domain/report/build";

export type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Query-string keys (short, shareable): c city, d district, ask, area, rooms, fl, fls, yr, cond, bt, mk, a address, u url, pur, hh, pri */
export function paramsToInput(sp: SearchParams) {
  return {
    cityId: first(sp.c) || "lviv",
    districtId: first(sp.d) || undefined,
    address: first(sp.a) || undefined,
    sourceUrl: first(sp.u) || undefined,
    market: first(sp.mk) || undefined,
    askingPrice: first(sp.ask),
    areaSqm: first(sp.area),
    rooms: first(sp.rooms),
    floor: first(sp.fl),
    floorsTotal: first(sp.fls),
    yearBuilt: first(sp.yr),
    condition: first(sp.cond) || undefined,
    buildingType: first(sp.bt) || undefined,
  };
}

export function propertyToParams(p: Partial<Property> & { cityId?: string }, brief?: Partial<Pick<Brief, "purpose" | "household" | "priorities">>) {
  const q = new URLSearchParams();
  const set = (k: string, v: unknown) => v !== undefined && v !== null && v !== "" && q.set(k, String(v));
  set("c", p.cityId);
  set("d", p.districtId);
  set("a", p.address);
  set("u", p.sourceUrl);
  set("mk", p.market);
  set("ask", p.askingPrice);
  set("area", p.areaSqm);
  set("rooms", p.rooms);
  set("fl", p.floor);
  set("fls", p.floorsTotal);
  set("yr", p.yearBuilt);
  set("cond", p.condition);
  set("bt", p.buildingType);
  if (p.coords) {
    set("lng", p.coords[0].toFixed(6));
    set("lat", p.coords[1].toFixed(6));
  }
  if (brief) {
    set("pur", brief.purpose);
    set("hh", brief.household);
    if (brief.priorities?.length) set("pri", brief.priorities.join(","));
  }
  return q;
}

export function briefFromParams(sp: SearchParams): ReportData["brief"] {
  const hh = first(sp.hh);
  const pur = first(sp.pur);
  const pri = (first(sp.pri) ?? "").split(",").filter((x): x is (typeof PRIORITIES)[number] => (PRIORITIES as readonly string[]).includes(x));
  if (!hh && !pur && pri.length === 0) return undefined;
  return {
    household: ["single", "couple", "family", "retired"].includes(hh ?? "") ? (hh as Brief["household"]) : undefined,
    purpose: ["live", "invest", "both"].includes(pur ?? "") ? (pur as Brief["purpose"]) : "live",
    priorities: pri,
  };
}

/** Synchronous, demo-comps-only report (tests / offline). Live pages use server/live-report.ts. */
export function demoReport(sp: SearchParams, id = "p1"): { ok: true; report: ReportData } | { ok: false; error: string } {
  const parsed = apartmentInputSchema.safeParse(paramsToInput(sp));
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const city = getCityOrDefault(parsed.data.cityId);
  const property = toProperty({ ...parsed.data, cityId: city.id }, city.currency, id);
  return { ok: true, report: buildReport({ property, city, comps: getDemoComps(city.id), dataMode: "demo", brief: briefFromParams(sp) }) };
}

export function sampleReport(): ReportData {
  const city = getCityOrDefault(SAMPLE_PROPERTY.cityId);
  return buildReport({
    property: SAMPLE_PROPERTY,
    city,
    comps: getDemoComps(city.id),
    dataMode: "demo",
    brief: { household: "family", purpose: "live", priorities: ["schools", "parks", "quiet"] },
    issues: SAMPLE_ISSUES,
    legal: SAMPLE_LEGAL,
    isSample: true,
  });
}

export function reportsForProperties(list: Property[], brief?: ReportData["brief"]): ReportData[] {
  return list.map((property) => {
    const city = getCityOrDefault(property.cityId);
    return buildReport({ property, city, comps: getDemoComps(city.id), dataMode: "demo", brief });
  });
}
