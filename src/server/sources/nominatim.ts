import type { CityAdapter, LngLat } from "@/domain/location/types";
import { getJson } from "../http";

const ENDPOINT = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  addresstype?: string;
}

/**
 * Geocode an address inside a city (bounded viewbox, Ukraine only). Results are cached 30 days —
 * the public instance allows max 1 request/second and requires caching.
 */
export async function geocodeInCity(address: string, city: CityAdapter): Promise<{ point: LngLat; label: string; fetchedAt: string } | { error: string }> {
  const [lng, lat] = city.center;
  const box = [lng - 0.2, lat + 0.13, lng + 0.2, lat - 0.13].join(",");
  const q = `${address}, ${city.names.uk}`;
  const url = `${ENDPOINT}/search?q=${encodeURIComponent(q)}&countrycodes=ua&format=jsonv2&limit=1&viewbox=${box}&bounded=1&accept-language=uk`;
  const r = await getJson<NominatimHit[]>(url, { revalidate: 30 * 24 * 3600 });
  if (!r.ok) return { error: r.error };
  const hit = r.data[0];
  if (!hit) return { error: "not-found" };
  return { point: [Number(hit.lon), Number(hit.lat)], label: hit.display_name, fetchedAt: r.fetchedAt };
}

interface ReverseHit {
  address?: Record<string, string>;
}

/** Administrative area names for a point (borough → city_district → suburb → neighbourhood), cached 30 days. */
export async function reverseAdminNames(point: LngLat): Promise<string[] | { error: string }> {
  const [lng, lat] = point;
  const url = `${ENDPOINT}/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&format=jsonv2&zoom=17&addressdetails=1&accept-language=uk`;
  const r = await getJson<ReverseHit>(url, { revalidate: 30 * 24 * 3600, timeoutMs: 5000 });
  if (!r.ok) return { error: r.error };
  const a = r.data.address ?? {};
  return [a.borough, a.city_district, a.suburb, a.quarter, a.neighbourhood].filter((x): x is string => !!x);
}
