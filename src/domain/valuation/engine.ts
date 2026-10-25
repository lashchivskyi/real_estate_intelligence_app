import type { CityAdapter } from "../location/types";
import { metres } from "../location/intel";
import { getPropertyAdapter } from "../property/adapters";
import type { Property } from "../property/types";
import {
  VALUATION_METHOD,
  type Comp,
  type Confidence,
  type UsedComp,
  type ValuationResult,
} from "./types";

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const round500 = (n: number) => Math.round(n / 500) * 500;

export function weightedQuantile(values: Array<{ v: number; w: number }>, q: number): number {
  const s = [...values].sort((a, b) => a.v - b.v);
  const total = s.reduce((acc, x) => acc + x.w, 0);
  if (s.length === 0 || total === 0) return NaN;
  // Midpoint-cumulative positions, linear interpolation between neighbours.
  let cum = 0;
  const pos = s.map((x) => {
    const p = (cum + x.w / 2) / total;
    cum += x.w;
    return p;
  });
  if (q <= pos[0]) return s[0].v;
  if (q >= pos[pos.length - 1]) return s[s.length - 1].v;
  for (let i = 1; i < pos.length; i++) {
    if (q <= pos[i]) {
      const t = (q - pos[i - 1]) / (pos[i] - pos[i - 1]);
      return s[i - 1].v + t * (s[i].v - s[i - 1].v);
    }
  }
  return s[s.length - 1].v;
}

export interface ValuationOptions {
  city: CityAdapter;
  comps: Comp[];
  dataMode: "demo" | "live";
}

/** Provided attributes that narrow uncertainty; absent ones are reported as `missing`. */
const COVERAGE_FIELDS: Array<keyof Property> = [
  "districtId",
  "rooms",
  "floor",
  "floorsTotal",
  "yearBuilt",
  "condition",
  "buildingType",
];

export function estimateValue(property: Property, { city, comps, dataMode }: ValuationOptions): ValuationResult {
  const adapter = getPropertyAdapter(property.class);
  const method = { ...VALUATION_METHOD };
  const missing = COVERAGE_FIELDS.filter((f) => property[f] === undefined || property[f] === null).map(String);

  if (!adapter.valuationSupported) {
    return { status: "insufficient", reason: "unsupported-class", compsFound: 0, minComps: adapter.minComps, missing, method };
  }
  if (comps.length === 0 && !city.valuation.benchmark) {
    return { status: "insufficient", reason: "no-benchmark", compsFound: 0, minComps: adapter.minComps, missing, method };
  }

  const districtMult = (id?: string) => city.districts.find((d) => d.id === id)?.priceMultiplier;
  const subjDistrict = districtMult(property.districtId);

  const used: UsedComp[] = [];
  for (const c of comps) {
    if (c.cityId !== property.cityId || c.daysAgo > 180) continue;
    const areaRatio = c.areaSqm / property.areaSqm;
    if (areaRatio < 0.65 || areaRatio > 1.35) continue;
    if (property.rooms !== undefined && Math.abs(c.rooms - property.rooms) > 1) continue;

    // Similarity × freshness.
    let w = Math.exp(-Math.abs(Math.log(areaRatio)) / 0.25);
    if (property.rooms !== undefined) w *= c.rooms === property.rooms ? 1 : 0.7;
    if (property.districtId) w *= c.districtId === property.districtId ? 1 : 0.65;
    if (property.buildingType && c.buildingType) w *= property.buildingType === c.buildingType ? 1 : 0.85;
    // Geocoded subject + geolocated comp: distance decay (half weight at ~1.7 km).
    if (property.coords && c.coords) w *= Math.exp(-metres(property.coords, c.coords) / 2500);
    w *= Math.exp(-c.daysAgo / 120);

    // Normalize the comp to the subject: subject factor / comp factor.
    let ppsm = c.askPricePerSqm;
    const cd = districtMult(c.districtId);
    if (subjDistrict && cd) ppsm *= subjDistrict / cd;
    for (const adj of adapter.adjustments) {
      if (adj.needs && (property[adj.needs] === undefined || property[adj.needs] === null)) continue;
      const fs = adj.factor(property);
      const fc = adj.factor({
        areaSqm: c.areaSqm,
        floor: c.floor,
        floorsTotal: c.floorsTotal,
        yearBuilt: c.yearBuilt,
        condition: c.condition,
        buildingType: c.buildingType,
      });
      ppsm *= fs / fc;
    }
    used.push({ comp: c, weight: w, adjustedPricePerSqm: ppsm });
  }

  if (used.length < adapter.minComps) {
    return { status: "insufficient", reason: "few-comps", compsFound: used.length, minComps: adapter.minComps, missing, method };
  }

  const pts = used.map((u) => ({ v: u.adjustedPricePerSqm, w: u.weight }));
  const p25 = weightedQuantile(pts, 0.25);
  const p50 = weightedQuantile(pts, 0.5);
  const p75 = weightedQuantile(pts, 0.75);

  // ---- confidence (each component is shown to the user) ----
  const totalW = used.reduce((a, u) => a + u.weight, 0);
  const effN = (totalW * totalW) / used.reduce((a, u) => a + u.weight * u.weight, 0);
  const iqrRel = (p75 - p25) / p50;
  const freshness = used.reduce((a, u) => a + u.weight * Math.exp(-u.comp.daysAgo / 120), 0) / totalW;
  const coverage = 1 - missing.length / COVERAGE_FIELDS.length;
  // Live listing comps are real but still asking prices with uncalibrated adjustments; demo comps are synthetic.
  let calibrationFactor = city.valuation.calibration === "calibrated" && dataMode === "live" ? 1 : dataMode === "live" ? 0.9 : 0.8;
  // Demo comps are generated from a published benchmark: an old benchmark lowers confidence further.
  const asOf = city.valuation.benchmark?.asOf;
  if (dataMode === "demo" && asOf) {
    const months = (Date.now() - new Date(`${asOf}-01`).getTime()) / (30.4 * 86_400_000);
    if (months > 6) calibrationFactor *= 0.8;
  }

  const components: Confidence["components"] = [
    { id: "count", score: clamp(effN / 10), detail: { effectiveComps: Math.round(effN * 10) / 10, found: used.length } },
    { id: "dispersion", score: clamp(1 - iqrRel / 0.3), detail: { iqrPct: Math.round(iqrRel * 1000) / 10 } },
    { id: "freshness", score: clamp(freshness), detail: { medianAgeDays: 0 } },
    { id: "coverage", score: clamp(coverage), detail: { provided: COVERAGE_FIELDS.length - missing.length, of: COVERAGE_FIELDS.length } },
  ];
  const overall = clamp(
    (0.3 * components[0].score + 0.25 * components[1].score + 0.15 * components[2].score + 0.3 * components[3].score) *
      calibrationFactor,
  );

  const ages = used.map((u) => u.comp.daysAgo).sort((a, b) => a - b);
  const medianAge = ages[Math.floor(ages.length / 2)];
  components[2].detail = { medianAgeDays: medianAge };

  // ---- fair transaction range: ask distribution minus typical ask→sold discount, widened by uncertainty ----
  const [dMin, dMax] = city.valuation.askToSoldDiscount;
  const widen = 0.03 * (1 - overall);
  const area = property.areaSqm;
  const fairLow = round500(p25 * (1 - dMax) * (1 - widen) * area);
  const fairHigh = round500(p75 * (1 - dMin) * (1 + widen) * area);
  const fairMid = round500(p50 * (1 - (dMin + dMax) / 2) * area);

  return {
    status: "ok",
    currency: property.currency,
    fairLow,
    fairMid,
    fairHigh,
    askPerSqmLow: Math.round(p25),
    askPerSqmHigh: Math.round(p75),
    confidence: { overall, components, calibrationFactor },
    used: used.sort((a, b) => b.weight - a.weight),
    missing,
    medianCompAgeDays: medianAge,
    dataMode,
    calibration: city.valuation.calibration,
    method,
  };
}
