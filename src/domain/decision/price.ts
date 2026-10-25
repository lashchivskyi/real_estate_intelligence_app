import type { ValuationResult } from "../valuation/types";
import type { Msg, Negotiation, PriceVerdict } from "./types";

export const MIN_CONFIDENCE_FOR_VERDICT = 0.3;
export const MIN_CONFIDENCE_FOR_NEGOTIATION = 0.4;

const round500 = (n: number) => Math.round(n / 500) * 500;

export interface PriceVerdictResult {
  verdict: PriceVerdict;
  /** ask / fair mid, when computable. */
  ratio: number | null;
  /** Percent by which ask sits above (+) / below (−) the fair range. */
  vsRangePct: number | null;
  reason: Msg;
}

export function priceVerdict(ask: number, v: ValuationResult): PriceVerdictResult {
  if (v.status !== "ok") {
    return { verdict: "INSUFFICIENT_DATA", ratio: null, vsRangePct: null, reason: { code: `price.insufficient.${v.reason}` } };
  }
  if (v.confidence.overall < MIN_CONFIDENCE_FOR_VERDICT) {
    return { verdict: "INSUFFICIENT_DATA", ratio: ask / v.fairMid, vsRangePct: null, reason: { code: "price.insufficient.low-confidence" } };
  }
  const ratio = ask / v.fairMid;
  const vsRangePct = ask > v.fairHigh ? (ask / v.fairHigh - 1) * 100 : ask < v.fairLow ? (ask / v.fairLow - 1) * 100 : 0;
  const params = { pct: Math.abs(Math.round(vsRangePct * 10) / 10) };

  if (ask < v.fairLow * 0.95) return { verdict: "UNDERPRICED", ratio, vsRangePct, reason: { code: "price.under", params } };
  if (ask <= v.fairHigh * 1.03) {
    return { verdict: "FAIR", ratio, vsRangePct, reason: { code: ask < v.fairLow ? "price.fair.low" : "price.fair", params } };
  }
  if (ask <= v.fairHigh * 1.1) return { verdict: "SLIGHTLY_OVERPRICED", ratio, vsRangePct, reason: { code: "price.slightly", params } };
  return { verdict: "OVERPRICED", ratio, vsRangePct, reason: { code: "price.over", params } };
}

/**
 * Negotiation numbers exist only with evidence: an `ok` valuation above the
 * confidence floor. Repairs found on inspection are added as extra leverage.
 */
export function negotiation(ask: number, v: ValuationResult, repairMid = 0): Negotiation | null {
  if (v.status !== "ok" || v.confidence.overall < MIN_CONFIDENCE_FOR_NEGOTIATION) return null;
  const verdict = priceVerdict(ask, v).verdict;
  if (verdict === "UNDERPRICED" || verdict === "INSUFFICIENT_DATA") return null;

  const basis: Msg[] = [{ code: "nego.basis.range" }];
  let opening = verdict === "FAIR" ? Math.min(ask, v.fairMid) * 0.985 : v.fairLow * 0.975;
  if (repairMid > 0) {
    opening = Math.min(opening, v.fairMid - repairMid * 0.6);
    basis.push({ code: "nego.basis.repairs" });
  }
  opening = Math.max(opening, v.fairLow * 0.85);
  return {
    ask,
    fairLow: v.fairLow,
    fairHigh: v.fairHigh,
    opening: round500(Math.min(opening, ask)),
    walkAway: round500(Math.max(v.fairHigh, Math.min(ask, v.fairHigh * 1.02))),
    currency: v.currency,
    basis,
  };
}
