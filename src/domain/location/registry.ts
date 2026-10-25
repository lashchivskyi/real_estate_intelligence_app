import type { CityAdapter, LngLat } from "./types";
import { lviv } from "./cities/lviv";
import { bukovel, ivanoFrankivsk, mukachevo, skhidnytsia, truskavets, uzhhorod, yaremche } from "./cities/west-ukraine";

/**
 * Adding a city = add an adapter file and register it here.
 * Nothing else in the product references a concrete city.
 */
const ADAPTERS: CityAdapter[] = [lviv, truskavets, skhidnytsia, ivanoFrankivsk, bukovel, yaremche, uzhhorod, mukachevo];

export const DEFAULT_CITY_ID = "lviv";

export const listCities = (): CityAdapter[] => ADAPTERS;
export const getCity = (id: string | undefined | null): CityAdapter | undefined =>
  ADAPTERS.find((c) => c.id === id);
export const getCityOrDefault = (id: string | undefined | null): CityAdapter =>
  getCity(id) ?? (getCity(DEFAULT_CITY_ID) as CityAdapter);

export function haversineKm(a: LngLat, b: LngLat): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nearest registered city within `maxKm`; null otherwise (no forced match). */
export function nearestCity(point: LngLat, maxKm = 40): { city: CityAdapter; km: number } | null {
  let best: { city: CityAdapter; km: number } | null = null;
  for (const city of ADAPTERS) {
    const km = haversineKm(point, city.center);
    if (!best || km < best.km) best = { city, km };
  }
  return best && best.km <= maxKm ? best : null;
}

/** Cities grouped by region, in registry order (for selectors). */
export function citiesByRegion(): Array<{ regionId: string; cities: CityAdapter[] }> {
  const out: Array<{ regionId: string; cities: CityAdapter[] }> = [];
  for (const c of ADAPTERS) {
    const g = out.find((x) => x.regionId === c.regionId);
    if (g) g.cities.push(c);
    else out.push({ regionId: c.regionId, cities: [c] });
  }
  return out;
}
