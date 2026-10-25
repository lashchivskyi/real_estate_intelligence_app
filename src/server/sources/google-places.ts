import { ESSENTIALS, ESSENTIAL_RADIUS_KM, walkMinutes, type Essential, type NearbyPlace } from "@/domain/location/geo";
import { metres } from "@/domain/location/intel";
import type { LngLat } from "@/domain/location/types";
import { mapLimit } from "../http";

/**
 * Google Places API (New) — best coverage of the private sector in Ukraine (small shops, private
 * clinics, dentists, private kindergartens). Google's terms allow showing Places data only on a
 * Google map, so this provider is enabled ONLY when the browser Google Maps key is also configured
 * (the UI then renders Google Maps instead of MapLibre).
 * Docs: developers.google.com/maps/documentation/places/web-service/nearby-search
 */
const KEY = () => process.env.GOOGLE_MAPS_API_KEY;
export const googleConfigured = () => !!KEY() && !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

/** Table A types per essential; the first type is a conservative fallback if a request is rejected. */
const TYPES: Record<Essential, string[]> = {
  transit: ["transit_station", "bus_stop", "bus_station", "light_rail_station"],
  grocery: ["supermarket", "grocery_store", "convenience_store", "market"],
  pharmacy: ["pharmacy", "drugstore"],
  school: ["school", "primary_school", "secondary_school"],
  kindergarten: ["preschool"],
  clinic: ["doctor", "hospital", "dental_clinic", "dentist", "medical_lab"],
  park: ["park"],
};

interface GPlace {
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
}

async function search(point: LngLat, cat: Essential, types: string[], max: number): Promise<GPlace[] | null> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY() ?? "",
      "X-Goog-FieldMask": "places.displayName,places.location,places.shortFormattedAddress",
    },
    body: JSON.stringify({
      includedTypes: types,
      maxResultCount: Math.min(20, max),
      rankPreference: "DISTANCE",
      languageCode: "uk",
      locationRestriction: { circle: { center: { latitude: point[1], longitude: point[0] }, radius: ESSENTIAL_RADIUS_KM[cat] * 1000 } },
    }),
    // Places content may not be cached beyond the terms (place IDs excepted) — keep it short.
    next: { revalidate: 3600 },
  } as RequestInit);
  if (!res.ok) return null;
  const j = (await res.json()) as { places?: GPlace[] };
  return j.places ?? [];
}

export async function googleNearby(point: LngLat, perCat: number): Promise<{ places: NearbyPlace[]; fetchedAt: string } | { error: string }> {
  const res = await mapLimit([...ESSENTIALS], 4, async (cat) => {
    const list = (await search(point, cat, TYPES[cat], perCat)) ?? (await search(point, cat, TYPES[cat].slice(0, 1), perCat));
    return { cat, list };
  });
  if (res.every((r) => r.list === null)) return { error: "google-unavailable" };
  const places = res.flatMap(({ cat, list }) =>
    (list ?? [])
      .filter((g) => g.location)
      .map((g): NearbyPlace => {
        const pt: LngLat = [g.location!.longitude, g.location!.latitude];
        const m = Math.round(metres(point, pt));
        return { cat, name: g.displayName?.text, address: g.shortFormattedAddress ?? g.formattedAddress, point: pt, m, walkMin: walkMinutes(m) };
      }),
  );
  return { places, fetchedAt: new Date().toISOString() };
}
