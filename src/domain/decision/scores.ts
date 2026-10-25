import type { Brief } from "../brief";
import { PRIORITY_INDICATOR } from "../brief";
import type { InvestmentResult } from "../investment";
import { sumRepairs, type InspectionIssue } from "../inspection";
import type { LegalCheck } from "../legal";
import { legalSummary } from "../legal";
import { INDICATOR_KEYS, type IndicatorKey } from "../location/types";
import type { LocationIntel } from "../location/intel";
import type { DataKind } from "../provenance";
import type { Property } from "../property/types";
import type { ValuationResult } from "../valuation/types";
import type { Driver, SubscoreId, Subscore } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const r = (n: number) => Math.round(n);

function interp(points: Array<[number, number]>, x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

export const SCORE_WEIGHTS: Record<SubscoreId, number> = {
  value: 0.25,
  technical: 0.2,
  legal: 0.2,
  location: 0.1,
  lifestyle: 0.05,
  investment: 0.1,
  liquidity: 0.1,
};

const empty = (id: SubscoreId, missing: string[], kind: Subscore["kind"] = "INFERENCE"): Subscore => ({
  id,
  value: null,
  confidence: 0,
  kind,
  drivers: [],
  missing,
});

export function valueScore(ask: number, v: ValuationResult): Subscore {
  if (v.status !== "ok") return empty("value", ["comps"], "ESTIMATE");
  const ratio = ask / v.fairMid;
  const value = r(interp([[0.85, 92], [1, 70], [1.1, 45], [1.25, 15]], ratio));
  const drivers: Driver[] = [
    { code: "driver.value.ratio", params: { pct: Math.abs(Math.round((ratio - 1) * 1000) / 10), dir: ratio > 1 ? "above" : "below" }, delta: value - 70, kind: "ESTIMATE" },
  ];
  return { id: "value", value, confidence: v.confidence.overall, kind: "ESTIMATE", drivers, missing: v.missing.map((m) => `attr.${m}`) };
}

export function technicalScore(issues: InspectionIssue[] | null, ask: number): Subscore {
  if (!issues) return empty("technical", ["inspection"], "FACT");
  let value = 100;
  const drivers: Driver[] = [];
  for (const i of issues) {
    const d = i.severity === "red" ? -25 : i.severity === "yellow" ? -8 : 0;
    if (d) {
      value += d;
      drivers.push({ code: "driver.tech.issue", params: { title: i.title.en, titleUk: i.title.uk, sev: i.severity }, delta: d, kind: "FACT" });
    }
  }
  const rep = sumRepairs(issues);
  if (rep.mid / ask > 0.1) {
    value -= 10;
    drivers.push({ code: "driver.tech.repairShare", params: { pct: r((rep.mid / ask) * 100) }, delta: -10, kind: "ESTIMATE" });
  }
  return { id: "technical", value: r(clamp(value)), confidence: 0.85, kind: "FACT", drivers, missing: [] };
}

export function legalScore(checks: LegalCheck[]): Subscore {
  const s = legalSummary(checks);
  if (s.unknown === s.total) return empty("legal", ["registry-extract"], "FACT");
  let value = 95;
  const drivers: Driver[] = [];
  if (s.red) {
    value = 10;
    drivers.push({ code: "driver.legal.red", params: { n: s.red }, delta: -85, kind: "FACT" });
  } else if (s.yellow) {
    value = 95 - s.yellow * 20;
    drivers.push({ code: "driver.legal.yellow", params: { n: s.yellow }, delta: -20 * s.yellow, kind: "FACT" });
  } else {
    drivers.push({ code: "driver.legal.green", params: { n: s.green }, delta: 0, kind: "FACT" });
  }
  return {
    id: "legal",
    value: r(clamp(value)),
    confidence: 0.8 * ((s.total - s.unknown) / s.total),
    kind: "FACT",
    drivers,
    missing: s.unknown ? ["registry-extract"] : [],
  };
}

const LOCATION_WEIGHTS: Record<IndicatorKey, number> = {
  transit: 0.22, schools: 0.14, shops: 0.15, parks: 0.1, quiet: 0.15, business: 0.1, parking: 0.14,
};

/** Indicators for the property, from the best available evidence (see report/build resolveIndicators). */
export interface ResolvedIndicators {
  values: Record<IndicatorKey, number | null>;
  level: LocationIntel["level"];
  kind: DataKind;
  confidence: number;
}

const locMissing = (ind: ResolvedIndicators) => {
  const base = ind.level === "address" ? [] : ind.level === "config" ? ["poi-address-level", "travel-times"] : ["poi-address-level"];
  return ind.values.quiet === null ? [...base, "noise"] : base;
};

export function locationScore(ind: ResolvedIndicators | null): Subscore {
  if (!ind) return empty("location", ["district"]);
  let sum = 0;
  let wsum = 0;
  const known = INDICATOR_KEYS.filter((k) => ind.values[k] !== null);
  if (known.length === 0) return empty("location", ["poi-address-level"]);
  for (const k of known) {
    sum += (ind.values[k] as number) * LOCATION_WEIGHTS[k];
    wsum += LOCATION_WEIGHTS[k];
  }
  sum /= wsum;
  const sorted = known.map((k) => [k, ind.values[k] as number] as const).sort((a, b) => b[1] - a[1]);
  const drivers: Driver[] = [
    ...sorted.slice(0, 2).map(([k, v]): Driver => ({ code: "driver.loc.high", params: { k, v }, delta: v - 60, kind: ind.kind })),
    ...sorted.slice(-1).map(([k, v]): Driver => ({ code: "driver.loc.low", params: { k, v }, delta: v - 60, kind: ind.kind })),
  ];
  return { id: "location", value: r(sum), confidence: ind.confidence, kind: "INFERENCE", drivers, missing: locMissing(ind) };
}

const HOUSEHOLD_BOOST: Partial<Record<NonNullable<Brief["household"]>, IndicatorKey[]>> = {
  family: ["schools", "parks", "quiet"],
  retired: ["quiet", "shops", "parks"],
  single: ["transit", "business", "shops"],
  couple: ["transit", "shops", "parks"],
};

export function lifestyleScore(ind: ResolvedIndicators | null, brief?: Pick<Brief, "priorities" | "household">): Subscore {
  if (!brief || (brief.priorities.length === 0 && !brief.household)) return empty("lifestyle", ["brief"]);
  if (!ind) return empty("lifestyle", ["district"]);
  const keys = new Set<IndicatorKey>(brief.priorities.map((p) => PRIORITY_INDICATOR[p] as IndicatorKey));
  const boost = new Set(brief.household ? HOUSEHOLD_BOOST[brief.household] ?? [] : []);
  boost.forEach((k) => keys.add(k));
  if (keys.size === 0) return empty("lifestyle", ["brief"]);

  let wsum = 0;
  let vsum = 0;
  const drivers: Driver[] = [];
  keys.forEach((k) => {
    const w = (brief.priorities.some((p) => PRIORITY_INDICATOR[p] === k) ? 1 : 0.6) * (boost.has(k) ? 1.25 : 1);
    const v = ind.values[k];
    if (v === null) return;
    wsum += w;
    vsum += w * v;
    drivers.push({ code: "driver.life.k", params: { k, v, hh: brief.household ?? "" }, delta: v - 60, kind: "INFERENCE" });
  });
  if (wsum === 0) return empty("lifestyle", ["poi-address-level"]);
  drivers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { id: "lifestyle", value: r(vsum / wsum), confidence: ind.confidence, kind: "INFERENCE", drivers: drivers.slice(0, 4), missing: locMissing(ind) };
}

export function investmentScore(inv: InvestmentResult): Subscore {
  const base = inv.scenarios.find((s) => s.id === "base");
  if (inv.status !== "ok" || !base) return empty("investment", ["rent-data"], "ESTIMATE");
  const value = r(clamp(interp([[1, 10], [3, 30], [5, 65], [7, 90]], base.netYieldPct)));
  return {
    id: "investment",
    value,
    confidence: 0.3,
    kind: "ESTIMATE",
    drivers: [{ code: "driver.inv.yield", params: { y: Math.round(base.netYieldPct * 10) / 10 }, delta: value - 50, kind: "ESTIMATE" }],
    missing: ["rent-comps", "days-on-market"],
  };
}

export function liquidityScore(property: Property, v: ValuationResult, priceRatio: number | null): Subscore {
  if (v.status !== "ok") return empty("liquidity", ["comps", "days-on-market"]);
  let value = 50;
  const drivers: Driver[] = [];
  const rooms = property.rooms ?? 0;
  if (rooms === 1 || rooms === 2) {
    value += 15;
    drivers.push({ code: "driver.liq.rooms", delta: 15, kind: "INFERENCE" });
  } else if (rooms === 3) {
    value += 6;
    drivers.push({ code: "driver.liq.rooms3", delta: 6, kind: "INFERENCE" });
  }
  const depth = Math.min(20, v.used.length);
  value += depth;
  drivers.push({ code: "driver.liq.depth", params: { n: v.used.length }, delta: depth, kind: "INFERENCE" });
  if (priceRatio && priceRatio > 1.08) {
    value -= 15;
    drivers.push({ code: "driver.liq.overpriced", delta: -15, kind: "INFERENCE" });
  }
  return { id: "liquidity", value: r(clamp(value)), confidence: 0.3, kind: "INFERENCE", drivers, missing: ["days-on-market", "absorption-rate"] };
}

export interface DecisionConfidence {
  /** 0..1 confidence in what IS evaluated (weighted over available subscores only). */
  value: number;
  /** 0..1 share of the full dossier's weight that is evidenced. */
  coverage: number;
  missingModules: SubscoreId[];
}

/**
 * Two separate numbers: how sure we are about what we evaluated (value), and how much of the dossier
 * is evaluated at all (coverage). Missing modules lower coverage, never the confidence of the rest.
 */
export function decisionConfidence(scores: Subscore[]): DecisionConfidence {
  let acc = 0;
  let known = 0;
  const missingModules: SubscoreId[] = [];
  for (const s of scores) {
    if (s.value === null) missingModules.push(s.id);
    else {
      acc += SCORE_WEIGHTS[s.id] * s.confidence;
      known += SCORE_WEIGHTS[s.id];
    }
  }
  return { value: known ? acc / known : 0, coverage: known, missingModules };
}
