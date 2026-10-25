import { getDemoComps } from "@/data/demo-comps";
import { intelFromNearby, metres, OSM_INDICATOR_METHOD, travelEstimate, type LocationIntel } from "@/domain/location/intel";
import { getCityOrDefault } from "@/domain/location/registry";
import type { LngLat } from "@/domain/location/types";
import type { SourceStatus } from "@/domain/provenance";
import { apartmentInputSchema, toProperty, type Property } from "@/domain/property/types";
import type { ModuleState } from "@/domain/cases";
import type { InspectionIssue } from "@/domain/inspection";
import type { LegalCheck } from "@/domain/legal";
import { buildReport, type ReportData } from "@/domain/report/build";
import { weightedQuantile } from "@/domain/valuation/engine";
import { briefFromParams, paramsToInput, type SearchParams } from "@/lib/report-service";
import { nbuRate } from "./sources/nbu";
import { geocodeInCity, reverseAdminNames } from "./sources/nominatim";
import { matchDistrict } from "@/domain/location/district";
import { geocodePhoton } from "./sources/photon";
import { nearby as nearbyPlaces } from "./sources/geo";
import { osmLocationIntel } from "./sources/overpass";
import { riaComps, riaConfigured } from "./sources/ria";

export type LiveReportResult = { ok: true; report: ReportData } | { ok: false; error: string };

const MIN_LIVE_COMPS = 5;

/**
 * Builds a report from live sources, degrading gracefully:
 *  point (chosen suggestion, else Photon/Nominatim geocode) → location (Overpass density + Photon nearest)
 *  → comps (DIM.RIA, else demo fallback) → FX (NBU).
 * Every step reports its status, which the report shows in "Sources & methodology".
 */
export async function assembleLiveReport(sp: SearchParams): Promise<LiveReportResult> {
  const parsed = apartmentInputSchema.safeParse(paramsToInput(sp));
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const city = getCityOrDefault(parsed.data.cityId);
  const property = toProperty({ ...parsed.data, cityId: city.id }, city.currency, "p1");
  const lat = Number(Array.isArray(sp.lat) ? sp.lat[0] : sp.lat);
  const lng = Number(Array.isArray(sp.lng) ? sp.lng[0] : sp.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) property.coords = [lng, lat];
  return { ok: true, report: await assembleForProperty(property, { brief: briefFromParams(sp) }) };
}

export interface AssembleExtras {
  brief?: ReportData["brief"];
  legal?: LegalCheck[];
  issues?: InspectionIssue[] | null;
  modules?: { legal: ModuleState; technical: ModuleState };
  caseRef?: ReportData["caseRef"];
}

/** Same pipeline for an anonymous preview and for a case in the operations system. */
export async function assembleForProperty(input: Property, extras: AssembleExtras = {}): Promise<ReportData> {
  const property: Property = { ...input };
  const city = getCityOrDefault(property.cityId);
  const sources: SourceStatus[] = [{ sourceId: "user-input", status: "live" }];

  // 1) Geocode the address (precise point) → infer district when not given.
  let point: LngLat | null = null;
  let level = "city-centre" as LocationIntel["level"];
  let label: string | undefined;
  const picked = property.coords;
  const setPoint = (p: LngLat, l?: string) => {
    point = p;
    level = "address";
    label = l ?? property.address;
    property.coords = p;
  };

  // Picked from the type-ahead: coordinates are already exact; must lie near the selected city.
  if (picked && metres(picked, city.center) < 30_000) {
    setPoint(picked);
    sources.push({ sourceId: "photon", status: "live", detail: "address picked from suggestions" });
  } else if (property.address) {
    const g = await geocodePhoton(property.address, city);
    if (!("error" in g)) {
      setPoint(g.point, g.label);
      sources.push({ sourceId: "photon", status: "live", fetchedAt: g.fetchedAt });
    } else {
      const n = await geocodeInCity(property.address, city);
      if ("error" in n) sources.push({ sourceId: "nominatim", status: n.error === "not-found" ? "fallback" : "error", detail: n.error });
      else {
        setPoint(n.point, n.label);
        sources.push({ sourceId: "nominatim", status: "live", fetchedAt: n.fetchedAt });
      }
    }
  }
  if (!point) {
    const d = city.districts.find((x) => x.id === property.districtId);
    point = d?.center ?? city.center;
    level = d ? "district-centre" : "city-centre";
  }
  const at: LngLat = point;
  // District from administrative boundaries when the client didn't choose one.
  if (!property.districtId && level === "address" && city.districts.length) {
    const names = await reverseAdminNames(at);
    const hit = matchDistrict(city, at, "error" in names ? [] : names);
    if (hit) property.districtId = hit.id;
  }

  // 2) In parallel: OSM location intel, live comps (sale + rent), FX.
  const live = riaConfigured();
  const [osm, near, sale, rent, fx] = await Promise.all([
    osmLocationIntel(at, level),
    nearbyPlaces(at, 15),
    live ? riaComps(property, city, "sale") : Promise.resolve({ error: "not-configured" } as const),
    live ? riaComps(property, city, "rent", 12) : Promise.resolve({ error: "not-configured" } as const),
    nbuRate("USD"),
  ]);

  let location: LocationIntel | null = null;
  const nearest = "error" in near ? undefined : near.places;
  const locExtras = { geocoded: label ? { label } : undefined, travel: level !== "city-centre" ? travelEstimate(at, city.center) : undefined, nearest };
  if (!("error" in osm)) {
    location = { ...osm, ...locExtras };
    sources.push({ sourceId: "overpass", status: "live", fetchedAt: osm.fetchedAt, detail: `${osm.pois.length} POI` });
  } else {
    sources.push({ sourceId: "overpass", status: "error", detail: osm.error });
    // Density fallback from nearest-place lookups: fewer indicators, lower confidence, clearly labelled.
    if (nearest && nearest.length) {
      location = {
        ...intelFromNearby(at, nearest),
        ...locExtras,
        level,
        kind: "INFERENCE",
        confidence: level === "address" ? 0.5 : 0.35,
        sourceId: "error" in near ? "photon" : near.provider.split("+")[0],
        fetchedAt: "error" in near ? new Date().toISOString() : near.fetchedAt,
        method: { name: "photon-nearest-indicators", version: OSM_INDICATOR_METHOD.version },
      };
    }
  }
  if (!("error" in near)) near.provider.split("+").forEach((id) => sources.push({ sourceId: id, status: "live", fetchedAt: near.fetchedAt, detail: `${near.places.length} nearby places (merged)` }));
  else sources.push({ sourceId: "photon", status: "error", detail: near.error });
  if (location?.travel) sources.push({ sourceId: "routing", status: "live" });

  let comps = getDemoComps(city.id);
  let dataMode: ReportData["dataMode"] = "demo";
  if ("error" in sale) {
    sources.push({ sourceId: "dom-ria", status: sale.error === "not-configured" ? "not-configured" : "error", detail: sale.error });
  } else if (sale.comps.length >= MIN_LIVE_COMPS) {
    comps = sale.comps;
    dataMode = "live";
    sources.push({ sourceId: "dom-ria", status: "live", fetchedAt: sale.fetchedAt, detail: `${sale.comps.length}/${sale.found} listings` });
  } else {
    sources.push({ sourceId: "dom-ria", status: "fallback", fetchedAt: sale.fetchedAt, detail: `only ${sale.comps.length} listings` });
  }
  if (dataMode === "demo") {
    sources.push({ sourceId: comps.length ? "demo-comps" : "city-config", status: comps.length ? "demo" : "not-connected" });
    if (city.valuation.benchmark) sources.push({ sourceId: city.valuation.benchmark.sourceId, status: "fallback", detail: `benchmark ${city.valuation.benchmark.asOf}` });
  }

  let liveRentPerSqm: number | undefined;
  if (!("error" in rent) && rent.comps.length >= 3) {
    liveRentPerSqm = weightedQuantile(rent.comps.map((c) => ({ v: c.askPricePerSqm, w: 1 })), 0.5);
    sources.push({ sourceId: "dom-ria", status: "live", detail: `rent: ${rent.comps.length} listings` });
  }

  if (fx) sources.push({ sourceId: "nbu", status: "live", fetchedAt: fx.fetchedAt, detail: `${fx.rate} UAH/USD · ${fx.date}` });
  else sources.push({ sourceId: "nbu", status: "error" });

  return buildReport({
    property,
    city,
    comps,
    dataMode,
    brief: extras.brief,
    location,
    liveRentPerSqm,
    sources,
    fx: fx ? { uahPerUsd: fx.rate, date: fx.date } : null,
    legal: extras.legal,
    issues: extras.issues,
    modules: extras.modules,
    caseRef: extras.caseRef,
  });
}
