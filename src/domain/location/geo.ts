import { metres } from "./intel";
import type { LngLat } from "./types";

/** An address suggestion (street + house number when known). */
export interface AddressSuggestion {
  id: string;
  label: string;
  street?: string;
  housenumber?: string;
  /** Neighbourhood / district as named by the geocoder (not our district id). */
  area?: string;
  city?: string;
  point: LngLat;
  /** true when the suggestion points to a building (has a house number). */
  precise: boolean;
}

/** "Essentials" a buyer checks first. Order = display order. */
export const ESSENTIALS = ["transit", "grocery", "pharmacy", "school", "kindergarten", "clinic", "park"] as const;
export type Essential = (typeof ESSENTIALS)[number];

/** OSM tags (key:value) that map to each essential — used by Photon reverse filters and by Overpass categorisation. */
export const ESSENTIAL_TAGS: Record<Essential, string[]> = {
  transit: ["highway:bus_stop", "railway:tram_stop", "public_transport:platform", "public_transport:stop_position"],
  grocery: ["shop:supermarket", "shop:convenience", "shop:greengrocer", "shop:bakery", "shop:butcher", "shop:deli", "shop:alcohol", "amenity:marketplace"],
  pharmacy: ["amenity:pharmacy"],
  school: ["amenity:school"],
  kindergarten: ["amenity:kindergarten", "amenity:childcare"],
  // includes private clinics, dentists, labs and any other healthcare=* object
  clinic: ["amenity:clinic", "amenity:hospital", "amenity:doctors", "amenity:dentist", "healthcare"],
  park: ["leisure:park", "leisure:garden"],
};

/** Search radius (km) per essential. */
export const ESSENTIAL_RADIUS_KM: Record<Essential, number> = {
  transit: 0.8,
  grocery: 1,
  pharmacy: 1.2,
  school: 1.5,
  kindergarten: 1.5,
  clinic: 2,
  park: 1.5,
};

export interface NearbyPlace {
  cat: Essential;
  name?: string;
  address?: string;
  point: LngLat;
  /** straight-line metres from the subject */
  m: number;
  /** walking minutes at 4.8 km/h with a 1.25 detour factor (ESTIMATE) */
  walkMin: number;
}

export const walkMinutes = (m: number) => Math.max(1, Math.round(((m * 1.25) / 4800) * 60));

/** Minimal Photon GeoJSON feature (komoot/photon). */
export interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    type?: string;
  };
}

/** Pure mapper Photon → suggestion. Streets without numbers are kept (user may pick then type the number). */
export function photonToSuggestion(f: PhotonFeature): AddressSuggestion | null {
  const p = f.properties;
  const street = p.street ?? (p.osm_key === "highway" ? p.name : undefined);
  if (!street && !p.name) return null;
  const head = street ? `${street}${p.housenumber ? `, ${p.housenumber}` : ""}` : (p.name as string);
  const extra = [p.name && street && p.name !== street ? p.name : null, p.district ?? p.locality, p.city].filter(Boolean).join(" · ");
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? head}`,
    label: extra ? `${head} — ${extra}` : head,
    street,
    housenumber: p.housenumber,
    area: p.district ?? p.locality,
    city: p.city,
    point: f.geometry.coordinates,
    precise: !!p.housenumber,
  };
}

/** De-duplicate suggestions that point to the same address. Buildings first. */
export function dedupeSuggestions(list: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  return list
    .filter((s) => {
      const k = `${s.street ?? s.label}|${s.housenumber ?? ""}|${s.city ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => Number(b.precise) - Number(a.precise));
}

export function nearbyFromFeatures(cat: Essential, origin: LngLat, features: PhotonFeature[]): NearbyPlace[] {
  return features
    .map((f) => {
      const m = Math.round(metres(origin, f.geometry.coordinates));
      const p = f.properties;
      return {
        cat,
        name: p.name,
        address: p.street ? `${p.street}${p.housenumber ? `, ${p.housenumber}` : ""}` : undefined,
        point: f.geometry.coordinates,
        m,
        walkMin: walkMinutes(m),
      };
    })
    .filter((x) => x.m <= ESSENTIAL_RADIUS_KM[cat] * 1000)
    .sort((a, b) => a.m - b.m)
    // Same place mapped twice (e.g. a stop on both sides of the street): keep the closest.
    .filter((x, i, arr) => !arr.slice(0, i).some((y) => (y.name ?? "") === (x.name ?? "") && x.name && metres(x.point, y.point) < 80));
}

/** Category of an OSM object for the "essentials" list (broader than ESSENTIAL_TAGS key:value pairs). */
export function essentialOf(tags: Record<string, string> = {}): Essential | null {
  const a = tags.amenity;
  const shop = tags.shop;
  if (tags.highway === "bus_stop" || tags.railway === "tram_stop" || tags.public_transport === "platform" || tags.public_transport === "stop_position") return "transit";
  if (a === "pharmacy" || tags.healthcare === "pharmacy") return "pharmacy";
  if (a === "kindergarten" || a === "childcare") return "kindergarten";
  if (a === "school") return "school";
  if (a === "clinic" || a === "hospital" || a === "doctors" || a === "dentist" || (tags.healthcare && tags.healthcare !== "pharmacy")) return "clinic";
  if (a === "marketplace" || (shop && /^(supermarket|convenience|greengrocer|bakery|butcher|deli|alcohol|general|farm|dairy|frozen_food|seafood)$/.test(shop))) return "grocery";
  if (tags.leisure === "park" || (tags.leisure === "garden" && tags.access !== "private")) return "park";
  return null;
}

/**
 * Merge places from several providers: same category + (same name within 80 m, or any two within 12 m)
 * are one place; keep the closest, cap per category.
 */
export function mergeNearby(lists: NearbyPlace[][], perCat: number): NearbyPlace[] {
  const all = lists.flat().sort((a, b) => a.m - b.m);
  const out: NearbyPlace[] = [];
  const norm = (n?: string) => (n ?? "").toLowerCase().replace(/[«»"'`ʼ’]/g, "").replace(/\s+/g, " ").trim();
  for (const p of all) {
    const dup = out.some(
      (q) => q.cat === p.cat && (metres(q.point, p.point) < 12 || (norm(q.name) && norm(q.name) === norm(p.name) && metres(q.point, p.point) < 80)),
    );
    if (dup) continue;
    if (out.filter((q) => q.cat === p.cat).length >= perCat) continue;
    out.push(p);
  }
  return out;
}
