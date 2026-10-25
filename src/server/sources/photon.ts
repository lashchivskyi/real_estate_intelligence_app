import {
  ESSENTIALS,
  ESSENTIAL_RADIUS_KM,
  ESSENTIAL_TAGS,
  dedupeSuggestions,
  nearbyFromFeatures,
  photonToSuggestion,
  type AddressSuggestion,
  type Essential,
  type NearbyPlace,
  type PhotonFeature,
} from "@/domain/location/geo";
import type { CityAdapter, LngLat } from "@/domain/location/types";
import { getJson, mapLimit } from "../http";

/**
 * Photon (komoot) — OSM-based geocoder with type-ahead and house numbers; no key.
 * Public instance = fair use (throttled when abused): we debounce on the client, cache here,
 * and PHOTON_URL can point to a self-hosted instance (GraphHopper publishes weekly dumps).
 */
const BASE = process.env.PHOTON_URL ?? "https://photon.komoot.io";

type Fc = { features: PhotonFeature[] };

export async function suggestAddresses(q: string, city: CityAdapter, limit = 7): Promise<AddressSuggestion[] | { error: string }> {
  const [lng, lat] = city.center;
  const bbox = [lng - 0.25, lat - 0.16, lng + 0.25, lat + 0.16].map((n) => n.toFixed(4)).join(",");
  const url = `${BASE}/api/?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lng}&bbox=${bbox}&limit=${limit * 2}&lang=default`;
  const r = await getJson<Fc>(url, { revalidate: 24 * 3600, timeoutMs: 5000 });
  if (!r.ok) return { error: r.error };
  return dedupeSuggestions(r.data.features.map(photonToSuggestion).filter((s): s is AddressSuggestion => s !== null)).slice(0, limit);
}

export async function geocodePhoton(q: string, city: CityAdapter): Promise<{ point: LngLat; label: string; fetchedAt: string } | { error: string }> {
  const s = await suggestAddresses(q, city, 3);
  if ("error" in s) return s;
  const hit = s.find((x) => x.precise) ?? s[0];
  return hit ? { point: hit.point, label: hit.label, fetchedAt: new Date().toISOString() } : { error: "not-found" };
}

/**
 * Nearest essentials via Photon reverse with OSM tag filters — one small request per category, cached 7 days.
 * Much lighter than Overpass; the public instance still throttles bursts → self-host or use Geoapify.
 */
export async function nearbyEssentials(point: LngLat, perCat = 3, cats: readonly Essential[] = ESSENTIALS): Promise<{ places: NearbyPlace[]; fetchedAt: string } | { error: string }> {
  const [lng, lat] = point.map((n) => Math.round(n * 10000) / 10000) as LngLat;
  // One request per category (Photon accepts repeated osm_tag = OR) and low concurrency: the public
  // instance throttles bursts. Cached for 7 days per rounded point.
  // Total budget so a throttled instance can't stall a report.
  const deadline = Date.now() + 8000;
  const res = await mapLimit([...cats], 3, async (cat) => {
    const left = deadline - Date.now();
    if (left < 800) return { cat, r: { ok: false as const, error: "budget" } };
    const tags = ESSENTIAL_TAGS[cat].map((t) => `osm_tag=${encodeURIComponent(t)}`).join("&");
    const url = `${BASE}/reverse?lon=${lng}&lat=${lat}&radius=${ESSENTIAL_RADIUS_KM[cat]}&limit=${perCat + 2}&${tags}`;
    const r = await getJson<Fc>(url, { revalidate: 7 * 24 * 3600, timeoutMs: Math.min(4000, left) });
    return { cat, r };
  });
  if (res.every((x) => !x.r.ok)) return { error: res[0] && !res[0].r.ok ? res[0].r.error : "no-data" };
  const places: NearbyPlace[] = [];
  for (const cat of cats) {
    const feats = res.filter((x) => x.cat === cat && x.r.ok).flatMap((x) => (x.r.ok ? x.r.data.features : []));
    const seen = new Set<string>();
    places.push(
      ...nearbyFromFeatures(cat, point, feats)
        .filter((p) => {
          const k = `${p.point[0].toFixed(5)},${p.point[1].toFixed(5)}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, perCat),
    );
  }
  return { places, fetchedAt: new Date().toISOString() };
}
