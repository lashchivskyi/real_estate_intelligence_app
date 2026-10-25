import { dedupeSuggestions, walkMinutes, ESSENTIALS, ESSENTIAL_RADIUS_KM, type AddressSuggestion, type Essential, type NearbyPlace } from "@/domain/location/geo";
import { metres } from "@/domain/location/intel";
import type { CityAdapter, LngLat } from "@/domain/location/types";
import { getJson, mapLimit } from "../http";

/**
 * Geoapify (OSM-based, commercial SLA, free tier) — used when GEOAPIFY_API_KEY is set, because the
 * public Photon/Overpass instances throttle bursts. Results may be shown on any map with attribution
 * (unlike Google Places, which requires a Google map).
 * Docs: apidocs.geoapify.com — /v1/geocode/autocomplete, /v2/places.
 */
const KEY = () => process.env.GEOAPIFY_API_KEY;
export const geoapifyConfigured = () => !!KEY();

const CATEGORIES: Record<Essential, string> = {
  transit: "public_transport",
  grocery: "commercial.supermarket,commercial.convenience",
  pharmacy: "healthcare.pharmacy",
  school: "education.school",
  kindergarten: "childcare.kindergarten",
  clinic: "healthcare.clinic_or_praxis,healthcare.hospital,healthcare.dentist",
  park: "leisure.park",
};

interface GFeature {
  geometry: { coordinates: [number, number] };
  properties: { place_id?: string; name?: string; street?: string; housenumber?: string; suburb?: string; district?: string; city?: string; formatted?: string; result_type?: string };
}

export async function geoapifySuggest(q: string, city: CityAdapter, limit = 7): Promise<AddressSuggestion[] | { error: string }> {
  const [lng, lat] = city.center;
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(`${q}, ${city.names.uk}`)}&filter=circle:${lng},${lat},30000&bias=proximity:${lng},${lat}&lang=uk&limit=${limit}&apiKey=${KEY()}`;
  const r = await getJson<{ features: GFeature[] }>(url, { revalidate: 24 * 3600, timeoutMs: 5000 });
  if (!r.ok) return { error: r.error };
  return dedupeSuggestions(
    r.data.features.map((f) => {
      const p = f.properties;
      const head = p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ""}` : (p.name ?? p.formatted ?? "");
      const area = p.suburb ?? p.district;
      return {
        id: p.place_id ?? head,
        label: [head, [area, p.city].filter(Boolean).join(" · ")].filter(Boolean).join(" — "),
        street: p.street,
        housenumber: p.housenumber,
        area,
        city: p.city,
        point: f.geometry.coordinates,
        precise: !!p.housenumber,
      };
    }),
  );
}

export async function geoapifyNearby(point: LngLat, perCat = 3): Promise<{ places: NearbyPlace[]; fetchedAt: string } | { error: string }> {
  const [lng, lat] = point;
  const res = await mapLimit([...ESSENTIALS], 3, async (cat) => {
    const url = `https://api.geoapify.com/v2/places?categories=${CATEGORIES[cat]}&filter=circle:${lng},${lat},${ESSENTIAL_RADIUS_KM[cat] * 1000}&bias=proximity:${lng},${lat}&limit=${perCat}&apiKey=${KEY()}`;
    return { cat, r: await getJson<{ features: GFeature[] }>(url, { revalidate: 7 * 24 * 3600, timeoutMs: 6000 }) };
  });
  if (res.every((x) => !x.r.ok)) return { error: "geoapify-unavailable" };
  const places = res.flatMap(({ cat, r }) =>
    r.ok
      ? r.data.features.map((f) => {
          const m = Math.round(metres(point, f.geometry.coordinates));
          const p = f.properties;
          return { cat, name: p.name, address: p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ""}` : undefined, point: f.geometry.coordinates, m, walkMin: walkMinutes(m) } as NearbyPlace;
        })
      : [],
  );
  return { places: places.sort((a, b) => a.m - b.m), fetchedAt: new Date().toISOString() };
}
