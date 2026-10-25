import type { DataKind } from "../provenance";
import type { IndicatorKey, LngLat } from "./types";
import type { NearbyPlace } from "./geo";

/**
 * Location intelligence for one point. Counts/distances are FACTs from OpenStreetMap;
 * the 0..100 indicators are an INFERENCE (documented saturation curves, method version below).
 */
export const OSM_INDICATOR_METHOD = { name: "osm-poi-indicators", version: "1.0.0" } as const;

export type PoiCategory = "transit" | "school" | "kindergarten" | "shop" | "park" | "parking" | "office" | "health" | "nightlife";

export interface Poi {
  cat: PoiCategory;
  lng: number;
  lat: number;
  name?: string;
  /** metres from the subject point */
  m: number;
}

export interface LocationIntel {
  /** How precise the point is: geocoded address beats a district/city centroid. */
  level: "address" | "district-centre" | "city-centre" | "config";
  point: LngLat;
  /** null = could not be measured with the data available (shown as "no data", never as 0). */
  indicators: Record<IndicatorKey, number | null>;
  facts: {
    counts: Partial<Record<PoiCategory, number>>;
    nearestM: Partial<Record<PoiCategory, number>>;
    majorRoadM: number | null;
    railM: number | null;
  };
  /** Up to ~60 nearest POIs for the map. */
  pois: Poi[];
  kind: DataKind;
  confidence: number;
  sourceId: string;
  fetchedAt: string;
  method: { name: string; version: string };
  geocoded?: { label: string };
  /** Nearest essentials (shop, stop, pharmacy…) with walking distance. */
  nearest?: NearbyPlace[];
  travel?: { toCentreKm: number; walkMin: number; driveMin: number };
}

/** Minimal shape of an Overpass element (`out center tags` / `out geom`). */
export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
export function metres(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Point-to-polyline distance (local equirectangular projection; fine at city scale). */
export function distanceToLine(p: LngLat, line: Array<{ lat: number; lon: number }>): number {
  if (line.length === 0) return Infinity;
  const k = Math.cos(rad(p[1]));
  const xy = (lng: number, lat: number) => [rad(lng - p[0]) * R * k, rad(lat - p[1]) * R] as const;
  let best = Infinity;
  for (let i = 0; i < line.length; i++) {
    const [ax, ay] = xy(line[i].lon, line[i].lat);
    if (i === 0) best = Math.min(best, Math.hypot(ax, ay));
    if (i === line.length - 1) break;
    const [bx, by] = xy(line[i + 1].lon, line[i + 1].lat);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export function categorize(tags: Record<string, string> = {}): PoiCategory | null {
  const a = tags.amenity;
  if (tags.highway === "bus_stop" || tags.railway === "tram_stop" || tags.public_transport === "platform" || tags.public_transport === "stop_position") return "transit";
  if (a === "school") return "school";
  if (a === "kindergarten") return "kindergarten";
  if (tags.shop === "supermarket" || tags.shop === "convenience" || tags.shop === "mall" || a === "marketplace") return "shop";
  if (tags.leisure === "park") return "park";
  if (a === "parking") return "parking";
  if (tags.office || a === "coworking_space") return "office";
  if (a === "hospital" || a === "clinic" || a === "doctors" || a === "pharmacy") return "health";
  if (a === "bar" || a === "pub" || a === "nightclub") return "nightlife";
  return null;
}

/** Radius (m) within which each category is counted. */
export const RADII: Record<PoiCategory, number> = {
  transit: 500,
  school: 1000,
  kindergarten: 1000,
  shop: 600,
  park: 1000,
  parking: 400,
  office: 1000,
  health: 1000,
  nightlife: 300,
};

/** 100·(1 − e^(−n/k)): diminishing returns; k = count at which the score reaches ~63. */
const sat = (n: number, k: number) => 100 * (1 - Math.exp(-n / k));
const clamp = (v: number) => Math.round(Math.max(0, Math.min(100, v)));

export function indicatorsFromOsm(point: LngLat, elements: OsmElement[]): Omit<LocationIntel, "level" | "kind" | "confidence" | "sourceId" | "fetchedAt" | "method"> {
  const counts: Partial<Record<PoiCategory, number>> = {};
  const nearestM: Partial<Record<PoiCategory, number>> = {};
  const pois: Poi[] = [];
  const seen = new Set<string>();
  let majorRoadM: number | null = null;
  let railM: number | null = null;

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.geometry && (tags.highway || tags.railway)) {
      const dist = distanceToLine(point, el.geometry);
      if (tags.railway) railM = Math.min(railM ?? Infinity, dist);
      else majorRoadM = Math.min(majorRoadM ?? Infinity, dist);
      continue;
    }
    const cat = categorize(tags);
    if (!cat) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const key = `${el.type}${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = metres(point, [lon, lat]);
    if (m > RADII[cat]) continue;
    counts[cat] = (counts[cat] ?? 0) + 1;
    nearestM[cat] = Math.min(nearestM[cat] ?? Infinity, m);
    pois.push({ cat, lng: lon, lat, name: tags["name:uk"] ?? tags.name, m: Math.round(m) });
  }

  const c = (k: PoiCategory) => counts[k] ?? 0;
  const near = (k: PoiCategory) => nearestM[k];
  const schoolsN = c("school") + c("kindergarten");
  const parkNear = near("park");

  const indicators: Record<IndicatorKey, number> = {
    transit: clamp(sat(c("transit"), 6) + ((near("transit") ?? 999) < 200 ? 8 : 0)),
    schools: clamp(sat(schoolsN, 4)),
    shops: clamp(sat(c("shop"), 6)),
    parks: clamp(0.5 * sat(c("park"), 2) + 0.5 * (parkNear === undefined ? 0 : 100 * Math.exp(-parkNear / 600))),
    parking: clamp(sat(c("parking"), 4)),
    business: clamp(sat(c("office"), 15)),
    quiet: clamp(
      100 -
        (majorRoadM === null ? 0 : 60 * Math.exp(-majorRoadM / 120)) -
        (railM === null ? 0 : 30 * Math.exp(-railM / 150)) -
        Math.min(20, c("nightlife") * 3),
    ),
  };

  pois.sort((a, b) => a.m - b.m);
  return {
    point,
    indicators,
    facts: {
      counts,
      nearestM: Object.fromEntries(Object.entries(nearestM).map(([k, v]) => [k, Math.round(v as number)])),
      majorRoadM: majorRoadM === null ? null : Math.round(majorRoadM),
      railM: railM === null ? null : Math.round(railM),
    },
    pois: pois.slice(0, 60),
  };
}

/** Straight-line distance × detour factor at typical speeds. An ESTIMATE, labelled as such. */
export function travelEstimate(from: LngLat, centre: LngLat) {
  const km = metres(from, centre) / 1000;
  const road = km * 1.3;
  return { toCentreKm: Math.round(km * 10) / 10, walkMin: Math.round((road / 4.8) * 60), driveMin: Math.max(1, Math.round((road / 24) * 60)) };
}

/**
 * Fallback indicators from nearest-place lookups (Photon) when the Overpass density query is unavailable.
 * Counts are capped by the per-category limit, so scores are conservative; parking, business and
 * noise cannot be measured this way and are returned as null.
 */
export function intelFromNearby(point: LngLat, places: NearbyPlace[]): Omit<LocationIntel, "level" | "kind" | "confidence" | "sourceId" | "fetchedAt" | "method"> {
  const count = (cats: string[], radius: number) => places.filter((p) => cats.includes(p.cat) && p.m <= radius).length;
  const nearestOf = (cat: string) => places.filter((p) => p.cat === cat).sort((a, b) => a.m - b.m)[0]?.m;
  const parkNear = nearestOf("park");
  const transitNear = nearestOf("transit");
  const counts: Partial<Record<PoiCategory, number>> = {
    transit: count(["transit"], 500),
    school: count(["school"], 1000),
    kindergarten: count(["kindergarten"], 1000),
    shop: count(["grocery"], 600),
    park: count(["park"], 1000),
    health: count(["clinic", "pharmacy"], 1000),
  };
  const near: Partial<Record<PoiCategory, number>> = {};
  if (transitNear !== undefined) near.transit = transitNear;
  if (parkNear !== undefined) near.park = parkNear;
  const sch = nearestOf("school");
  if (sch !== undefined) near.school = sch;
  const shop = nearestOf("grocery");
  if (shop !== undefined) near.shop = shop;
  return {
    point,
    indicators: {
      transit: clamp(sat(counts.transit ?? 0, 6) + ((transitNear ?? 999) < 200 ? 8 : 0)),
      schools: clamp(sat((counts.school ?? 0) + (counts.kindergarten ?? 0), 4)),
      shops: clamp(sat(counts.shop ?? 0, 6)),
      parks: clamp(0.5 * sat(counts.park ?? 0, 2) + 0.5 * (parkNear === undefined ? 0 : 100 * Math.exp(-parkNear / 600))),
      parking: null,
      business: null,
      quiet: null,
    },
    facts: { counts, nearestM: near, majorRoadM: null, railM: null },
    pois: places.map((p) => ({ cat: (p.cat === "grocery" ? "shop" : p.cat === "clinic" || p.cat === "pharmacy" ? "health" : p.cat) as PoiCategory, lng: p.point[0], lat: p.point[1], name: p.name, m: p.m })),
  };
}
