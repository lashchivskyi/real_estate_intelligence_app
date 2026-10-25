import { indicatorsFromOsm, metres, OSM_INDICATOR_METHOD, type LocationIntel, type OsmElement } from "@/domain/location/intel";
import { ESSENTIAL_RADIUS_KM, essentialOf, walkMinutes, type Essential, type NearbyPlace } from "@/domain/location/geo";
import type { LngLat } from "@/domain/location/types";
import { getJson } from "../http";

/**
 * Public Overpass instances are free but often overloaded. We try them in order with a short timeout;
 * production should point OVERPASS_URLS at a self-hosted instance (or a paid mirror).
 */
const ENDPOINTS = (process.env.OVERPASS_URLS ?? "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** One query for every category we score (radii match RADII in domain/location/intel). Nodes+ways only — relations are costly. */
export function buildQuery([lng, lat]: LngLat): string {
  const p = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  return `[out:json][timeout:12];
(
 node["highway"="bus_stop"](around:500,${p});
 node["railway"="tram_stop"](around:500,${p});
 node["public_transport"="platform"](around:500,${p});
 nw["amenity"~"^(school|kindergarten)$"](around:1000,${p});
 nw["shop"~"^(supermarket|convenience|mall)$"](around:600,${p});
 nw["amenity"="marketplace"](around:600,${p});
 nw["leisure"="park"](around:1000,${p});
 nw["amenity"="parking"](around:400,${p});
 nw["office"](around:800,${p});
 nw["amenity"~"^(coworking_space|hospital|clinic|doctors|pharmacy|bar|pub|nightclub)$"](around:1000,${p});
);
out center tags qt;
way["highway"~"^(motorway|trunk|primary|secondary)$"](around:300,${p});
out geom qt;
way["railway"~"^(rail|tram)$"](around:300,${p});
out geom qt;`;
}

/**
 * Address-level location intelligence from OpenStreetMap. The point is rounded (~100 m) so nearby
 * requests share the 7-day cache — respecting the public instances' usage policy.
 */
export async function osmLocationIntel(point: LngLat, level: LocationIntel["level"]): Promise<LocationIntel | { error: string }> {
  const rounded: LngLat = [Math.round(point[0] * 1000) / 1000, Math.round(point[1] * 1000) / 1000];
  const q = encodeURIComponent(buildQuery(rounded));
  let lastError = "no-endpoint";
  // Total time budget across mirrors so a report never waits more than ~8 s for OSM.
  const deadline = Date.now() + 8_000;
  for (const ep of ENDPOINTS) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    const r = await getJson<{ elements: OsmElement[]; remark?: string }>(`${ep}?data=${q}`, { revalidate: 7 * 24 * 3600, timeoutMs: Math.min(6_000, left) });
    if (!r.ok) {
      lastError = r.error;
      continue;
    }
    // Overpass reports server-side timeouts as a 200 with a "remark" and partial data — treat as failure.
    if (r.data.remark && /timed out|runtime error/i.test(r.data.remark)) {
      lastError = "overpass-timeout";
      continue;
    }
    const base = indicatorsFromOsm(point, r.data.elements ?? []);
    return {
      ...base,
      level,
      kind: "INFERENCE",
      // OSM POI presence is fairly reliable in cities; completeness varies in small towns.
      confidence: level === "address" ? 0.7 : 0.5,
      sourceId: "overpass",
      fetchedAt: r.fetchedAt,
      method: { ...OSM_INDICATOR_METHOD },
    };
  }
  return { error: lastError };
}

/**
 * Every essential within its radius (complete list, unlike nearest-N lookups): stops, all food shops,
 * pharmacies, schools, kindergartens incl. private childcare, any healthcare object (private clinics,
 * dentists, labs), parks. Nodes + ways, centre coordinates, 7-day cache.
 */
export async function overpassEssentials(point: LngLat): Promise<{ places: NearbyPlace[]; fetchedAt: string } | { error: string }> {
  const [lng, lat] = point.map((n) => Math.round(n * 1000) / 1000);
  const p = `${lat},${lng}`;
  const r = (cat: Essential) => Math.round(ESSENTIAL_RADIUS_KM[cat] * 1000);
  const q = `[out:json][timeout:12];
(
 node["highway"="bus_stop"](around:${r("transit")},${p});
 node["railway"="tram_stop"](around:${r("transit")},${p});
 nw["shop"~"^(supermarket|convenience|greengrocer|bakery|butcher|deli|alcohol|general|farm|dairy)$"](around:${r("grocery")},${p});
 nw["amenity"="marketplace"](around:${r("grocery")},${p});
 nw["amenity"="pharmacy"](around:${r("pharmacy")},${p});
 nw["amenity"="school"](around:${r("school")},${p});
 nw["amenity"~"^(kindergarten|childcare)$"](around:${r("kindergarten")},${p});
 nw["amenity"~"^(clinic|hospital|doctors|dentist)$"](around:${r("clinic")},${p});
 nw["healthcare"](around:${r("clinic")},${p});
 nw["leisure"="park"](around:${r("park")},${p});
);
out center tags qt;`;
  const deadline = Date.now() + 8_000;
  let lastError = "no-endpoint";
  for (const ep of ENDPOINTS) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    const res = await getJson<{ elements: OsmElement[]; remark?: string }>(`${ep}?data=${encodeURIComponent(q)}`, { revalidate: 7 * 24 * 3600, timeoutMs: Math.min(6_000, left) });
    if (!res.ok) {
      lastError = res.error;
      continue;
    }
    const places: NearbyPlace[] = [];
    for (const el of res.data.elements ?? []) {
      const cat = essentialOf(el.tags);
      const la = el.lat ?? el.center?.lat;
      const lo = el.lon ?? el.center?.lon;
      if (!cat || la === undefined || lo === undefined) continue;
      const m = Math.round(metres(point, [lo, la]));
      if (m > ESSENTIAL_RADIUS_KM[cat] * 1000) continue;
      const t = el.tags ?? {};
      places.push({
        cat,
        name: t["name:uk"] ?? t.name ?? t.brand,
        address: t["addr:street"] ? `${t["addr:street"]}${t["addr:housenumber"] ? `, ${t["addr:housenumber"]}` : ""}` : undefined,
        point: [lo, la],
        m,
        walkMin: walkMinutes(m),
      });
    }
    return { places, fetchedAt: res.fetchedAt };
  }
  return { error: lastError };
}
