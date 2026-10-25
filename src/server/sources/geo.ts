import { mergeNearby, type AddressSuggestion, type NearbyPlace } from "@/domain/location/geo";
import type { CityAdapter, LngLat } from "@/domain/location/types";
import { geoapifyConfigured, geoapifyNearby, geoapifySuggest } from "./geoapify";
import { googleConfigured, googleNearby } from "./google-places";
import { overpassEssentials } from "./overpass";
import { nearbyEssentials as photonNearby, suggestAddresses as photonSuggest } from "./photon";

/**
 * Geocoding / POI providers. Address type-ahead: Geoapify (keyed) → Photon.
 * Nearby places: every available provider runs IN PARALLEL and results are merged/deduplicated,
 * because no single open source lists every small shop, private clinic or kindergarten:
 *   Overpass (complete OSM list) + Photon (fast nearest) + Geoapify (keyed) + Google Places (keyed, Google map only).
 */
export async function suggest(q: string, city: CityAdapter): Promise<{ items: AddressSuggestion[]; provider: string } | { error: string }> {
  if (geoapifyConfigured()) {
    const g = await geoapifySuggest(q, city);
    if (!("error" in g)) return { items: g, provider: "geoapify" };
  }
  const p = await photonSuggest(q, city);
  return "error" in p ? p : { items: p, provider: "photon" };
}

export async function nearby(point: LngLat, perCat: number): Promise<{ places: NearbyPlace[]; fetchedAt: string; provider: string } | { error: string }> {
  const jobs: Array<[string, Promise<{ places: NearbyPlace[]; fetchedAt: string } | { error: string }>]> = [
    ["overpass", overpassEssentials(point)],
    ["photon", photonNearby(point, perCat)],
  ];
  if (geoapifyConfigured()) jobs.push(["geoapify", geoapifyNearby(point, perCat)]);
  if (googleConfigured()) jobs.push(["google", googleNearby(point, perCat)]);
  const results = await Promise.all(jobs.map(([, p]) => p));
  const ok = results.map((r, i) => ({ id: jobs[i][0], r })).filter((x): x is { id: string; r: { places: NearbyPlace[]; fetchedAt: string } } => !("error" in x.r));
  if (ok.length === 0) return { error: "no-provider" };
  // Stable provider order for attribution; merge itself keeps the closest duplicate.
  const order = ["google", "geoapify", "overpass", "photon"];
  ok.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return {
    places: mergeNearby(ok.map((x) => x.r.places), perCat),
    fetchedAt: ok[0].r.fetchedAt,
    provider: ok.map((x) => x.id).join("+"),
  };
}
