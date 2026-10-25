import type { CityAdapter } from "@/domain/location/types";
import { metres } from "@/domain/location/intel";
import type { Property } from "@/domain/property/types";
import type { Comp } from "@/domain/valuation/types";
import { getJson, mapLimit } from "../http";

/**
 * DIM.RIA official API (developers.ria.com, key required — RIA_API_KEY).
 * Ids for regions/cities are resolved at runtime by name (no hardcoded foreign ids).
 * Docs: api-docs-v2.readthedocs.io/ru/latest/dom_ria/
 */
const BASE = "https://developers.ria.com/dom";
const KEY = () => process.env.RIA_API_KEY;
export const riaConfigured = () => !!KEY();

/** Characteristic ids from the DIM.RIA search docs: 209 rooms, 214 total area. */
const CH_ROOMS = 209;
const CH_AREA = 214;
/** Category 1 / realty_type 2 = apartments; operation_type 1 = sale, 3 = long-term rent. */
const APARTMENTS = { category: 1, realty_type: 2 };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ʼ|’|'/g, "")
    .replace(/\s*(область|обл\.?)\s*/g, "")
    .trim();

interface RiaState {
  stateID: number;
  name: string;
}
interface RiaCity {
  cityID: number;
  stateID: number;
  name: string;
}

export async function resolveRiaIds(city: CityAdapter): Promise<{ stateId: number; cityId: number } | { error: string }> {
  const key = KEY();
  if (!key) return { error: "not-configured" };
  const states = await getJson<RiaState[]>(`${BASE}/states?api_key=${key}&lang_id=4`, { revalidate: 30 * 24 * 3600 });
  if (!states.ok) return { error: states.error };
  const st = states.data.find((s) => norm(s.name).startsWith(norm(city.external.riaStateName)));
  if (!st) return { error: "state-not-found" };
  const cities = await getJson<RiaCity[]>(`${BASE}/cities/${st.stateID}?api_key=${key}&lang_id=4`, { revalidate: 30 * 24 * 3600 });
  if (!cities.ok) return { error: cities.error };
  const ct = cities.data.find((c) => norm(c.name) === norm(city.external.riaCityName)) ?? cities.data.find((c) => norm(c.name).startsWith(norm(city.external.riaCityName)));
  if (!ct) return { error: "city-not-found" };
  return { stateId: st.stateID, cityId: ct.cityID };
}

/** Fields we read from /dom/info/{id} (names as in the DIM.RIA docs sample). */
export interface RiaInfo {
  realty_id: number;
  price?: number;
  priceArr?: Record<string, string>;
  currency_type?: string;
  total_square_meters?: number;
  rooms_count?: number;
  floor?: number;
  floors_count?: number;
  district_name?: string;
  latitude?: string;
  longitude?: string;
  publishing_date?: string;
  created_at?: string;
  wall_type?: string;
}

const parseMoney = (s?: string) => (s ? Number(s.replace(/[^\d]/g, "")) : NaN);

/** Pure mapper: DIM.RIA listing → Comp. Returns null when a price or area is missing. priceArr["1"] is USD. */
export function riaInfoToComp(info: RiaInfo, city: CityAdapter, now: Date, op: "sale" | "rent" = "sale"): Comp | null {
  const usd = parseMoney(info.priceArr?.["1"]) || (info.currency_type === "$" ? Number(info.price) : NaN);
  const area = Number(info.total_square_meters);
  if (!usd || !area || area < 10) return null;
  const lat = Number(info.latitude);
  const lng = Number(info.longitude);
  const coords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? ([lng, lat] as [number, number]) : undefined;
  // District: match by name; otherwise nearest configured district centre (≤ 2.5 km).
  const dn = norm(info.district_name ?? "");
  let districtId = city.districts.find((d) => dn && (norm(d.names.uk).startsWith(dn) || dn.startsWith(norm(d.names.uk))))?.id;
  if (!districtId && coords && city.districts.length) {
    const near = city.districts.map((d) => ({ id: d.id, m: metres(coords, d.center) })).sort((a, b) => a.m - b.m)[0];
    if (near.m < 2500) districtId = near.id;
  }
  const published = new Date((info.publishing_date ?? info.created_at ?? "").replace(" ", "T"));
  const daysAgo = Number.isNaN(published.getTime()) ? 90 : Math.max(0, Math.round((now.getTime() - published.getTime()) / 86_400_000));
  const wall = (info.wall_type ?? "").toLowerCase();
  return {
    id: `ria-${op}-${info.realty_id}`,
    cityId: city.id,
    districtId: districtId ?? "",
    areaSqm: area,
    rooms: Number(info.rooms_count) || Math.max(1, Math.round(area / 25)),
    floor: info.floor ? Number(info.floor) : undefined,
    floorsTotal: info.floors_count ? Number(info.floors_count) : undefined,
    buildingType: wall.includes("панел") ? "panel" : undefined,
    askPricePerSqm: Math.round(usd / area),
    askPrice: usd,
    daysAgo,
    coords,
    sourceId: "dom-ria",
  };
}

function searchUrl(ids: { stateId: number; cityId: number }, p: Pick<Property, "areaSqm" | "rooms">, op: 1 | 3) {
  const q = new URLSearchParams({
    api_key: KEY() ?? "",
    category: String(APARTMENTS.category),
    realty_type: String(APARTMENTS.realty_type),
    operation_type: String(op),
    state_id: String(ids.stateId),
    city_id: String(ids.cityId),
    [`characteristic[${CH_AREA}][from]`]: String(Math.floor(p.areaSqm * 0.65)),
    [`characteristic[${CH_AREA}][to]`]: String(Math.ceil(p.areaSqm * 1.35)),
  });
  if (p.rooms) {
    q.set(`characteristic[${CH_ROOMS}][from]`, String(Math.max(1, p.rooms - 1)));
    q.set(`characteristic[${CH_ROOMS}][to]`, String(p.rooms + 1));
  }
  return `${BASE}/search?${q}`;
}

/** Live listing comps for a property: search (6 h cache) → info for up to `max` listings (24 h cache each). */
export async function riaComps(
  property: Property,
  city: CityAdapter,
  op: "sale" | "rent" = "sale",
  max = 24,
): Promise<{ comps: Comp[]; fetchedAt: string; found: number } | { error: string }> {
  const ids = await resolveRiaIds(city);
  if ("error" in ids) return ids;
  const search = await getJson<{ items: number[]; count: number }>(searchUrl(ids, property, op === "sale" ? 1 : 3), { revalidate: 6 * 3600 });
  if (!search.ok) return { error: search.error };
  const now = new Date();
  const infos = await mapLimit(search.data.items.slice(0, max), 4, (id) =>
    getJson<RiaInfo>(`${BASE}/info/${id}?api_key=${KEY()}&lang_id=4`, { revalidate: 24 * 3600 }),
  );
  const comps = infos.flatMap((r) => (r.ok ? [riaInfoToComp(r.data, city, now, op)] : [])).filter((c): c is Comp => c !== null);
  return { comps, fetchedAt: search.fetchedAt, found: search.data.count };
}
