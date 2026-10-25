import { getCityOrDefault } from "@/domain/location/registry";
import {
  ageFactor,
  areaFactor,
  floorFactor,
} from "@/domain/property/adapters";
import type { BuildingType, Condition } from "@/domain/property/types";
import type { Comp } from "@/domain/valuation/types";

/**
 * SYNTHETIC comparables for demo/dev. Generated deterministically from the
 * city benchmark + noise. They are NOT real listings or transactions, and
 * every surface that uses them must show the demo banner.
 * Replace with a CompsProvider backed by market_comps (see supabase/migrations).
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONDITION_W: Array<[Condition, number, number]> = [
  ["needs_renovation", 0.18, 0.88],
  ["cosmetic", 0.22, 0.95],
  ["good", 0.3, 1],
  ["euro", 0.22, 1.07],
  ["shell", 0.04, 0.8],
  ["new", 0.04, 1.04],
];
const BUILDING_W: Array<[BuildingType, number, number]> = [
  ["historic", 0.14, 1.1],
  ["soviet_brick", 0.28, 1],
  ["panel", 0.26, 0.92],
  ["modern", 0.28, 1.1],
  ["other", 0.04, 1],
];

function pick<T>(rnd: () => number, table: Array<[T, number, number]>): [T, number] {
  let r = rnd();
  for (const [v, w, m] of table) {
    if ((r -= w) <= 0) return [v, m];
  }
  const last = table[table.length - 1];
  return [last[0], last[2]];
}

export function generateDemoComps(cityId: string, count = 64, seed = 7): Comp[] {
  const city = getCityOrDefault(cityId);
  const base = city.valuation.benchmark?.value;
  if (!base) return [];
  const zones = city.districts.length ? city.districts : [{ id: "", center: city.center, priceMultiplier: 1 }];
  const rnd = mulberry32(seed + cityId.length);
  const out: Comp[] = [];
  for (let i = 0; i < count; i++) {
    const d = zones[Math.floor(rnd() * zones.length)];
    const area = Math.round(26 + rnd() * rnd() * 90 + rnd() * 14);
    const rooms = area < 38 ? 1 : area < 58 ? 2 : area < 82 ? 3 : 4;
    const [buildingType, bm] = pick(rnd, BUILDING_W);
    const yearBuilt =
      buildingType === "historic"
        ? 1890 + Math.floor(rnd() * 40)
        : buildingType === "modern"
          ? 2008 + Math.floor(rnd() * 18)
          : buildingType === "panel"
            ? 1972 + Math.floor(rnd() * 24)
            : 1955 + Math.floor(rnd() * 40);
    const floorsTotal = buildingType === "historic" ? 3 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 13);
    const floor = 1 + Math.floor(rnd() * floorsTotal);
    const [condition, cm] = pick(rnd, CONDITION_W);
    const noise = 1 + (rnd() - 0.5) * 0.14;
    const ppsm = Math.round(
      base * (d.priceMultiplier ?? 1) * bm * cm * areaFactor(area) * floorFactor(floor, floorsTotal) * ageFactor(yearBuilt) * noise,
    );
    out.push({
      id: `demo-${cityId}-${i + 1}`,
      cityId,
      districtId: d.id,
      areaSqm: area,
      rooms,
      floor,
      floorsTotal,
      yearBuilt,
      condition,
      buildingType,
      askPricePerSqm: ppsm,
      askPrice: ppsm * area,
      daysAgo: Math.floor(rnd() * rnd() * 170),
      coords: [d.center[0] + (rnd() - 0.5) * 0.03, d.center[1] + (rnd() - 0.5) * 0.02],
      sourceId: "demo-comps",
    });
  }
  return out;
}

const cache = new Map<string, Comp[]>();
export function getDemoComps(cityId: string): Comp[] {
  let c = cache.get(cityId);
  if (!c) {
    c = generateDemoComps(cityId);
    cache.set(cityId, c);
  }
  return c;
}
