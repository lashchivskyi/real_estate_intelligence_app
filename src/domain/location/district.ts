import { metres } from "./intel";
import type { CityAdapter, LngLat } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ʼ|’|'/g, "")
    .replace(/\s*(район|district|raion|мікрорайон)\s*/g, " ")
    .trim();

/**
 * District for a point. 1) Administrative names from reverse geocoding (borough / city_district /
 * suburb / neighbourhood) matched against the city's configured districts; 2) else the nearest
 * configured district centre within `maxM`. Returns how it was determined so the UI can say so.
 */
export function matchDistrict(city: CityAdapter, point: LngLat, adminNames: string[] = [], maxM = 2500): { id: string; method: "admin" | "nearest" } | null {
  if (city.districts.length === 0) return null;
  for (const raw of adminNames) {
    const n = norm(raw);
    if (!n) continue;
    const hit = city.districts.find((d) => {
      const a = norm(d.names.uk);
      const b = norm(d.names.en);
      return n === a || n === b || n.startsWith(a) || a.startsWith(n);
    });
    if (hit) return { id: hit.id, method: "admin" };
  }
  const near = city.districts.map((d) => ({ id: d.id, m: metres(point, d.center) })).sort((a, b) => a.m - b.m)[0];
  return near && near.m <= maxM ? { id: near.id, method: "nearest" } : null;
}
