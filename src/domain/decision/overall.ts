import type { ModuleState } from "../cases";
import type { InspectionIssue } from "../inspection";
import { sumRepairs } from "../inspection";
import type { LegalCheck } from "../legal";
import { legalSummary } from "../legal";
import type { Property } from "../property/types";
import type { ValuationResult } from "../valuation/types";
import type { PriceVerdictResult } from "./price";
import type { Msg, OverallVerdict, Subscore } from "./types";

export type PendingModule = "legal" | "technical";

export interface OverallResult {
  verdict: OverallVerdict;
  /** preliminary = at least one check (legal / technical) not done; complete = all done. */
  stage: "preliminary" | "complete";
  /** Checks still needed for a final verdict — shown as a separate block, never as a "risk". */
  pending: PendingModule[];
  reasons: Msg[];
  strengths: Msg[];
  risks: Msg[];
  nextActions: Array<Msg & { action: "legal" | "inspection" | "negotiate" | "seller-questions" | "compare" | "consult" | "brief" }>;
}

interface Input {
  property: Property;
  valuation: ValuationResult;
  price: PriceVerdictResult;
  legal: LegalCheck[];
  issues: InspectionIssue[] | null;
  scores: Subscore[];
  modules: { legal: ModuleState; technical: ModuleState };
}

/** Thresholds (documented in docs/product.md §6). */
export const RULES = {
  heavyRepairShare: 0.15,
  negotiateRepairShare: 0.03,
  heavyOverpricePct: 15,
  suspiciousCheapRatio: 0.85,
  minDigitalConfidence: 0.35,
};

/**
 * Verdict = independent modules combined.
 *  1. Facts first: a RED legal item or heavy technical findings decide immediately, whatever else is pending.
 *  2. All modules done → final verdict (GOOD_BUY / NEGOTIATE …).
 *  3. Otherwise → preliminary verdict from the digital module only (PROMISING / NEGOTIATE / CAUTION /
 *     INSUFFICIENT_DATA). Missing checks are listed in `pending`, they do not degrade the verdict.
 */
export function decide({ property, valuation, price, legal, issues, scores, modules }: Input): OverallResult {
  const legalDone = modules.legal === "done";
  const techDone = modules.technical === "done" && issues !== null;
  const ls = legalSummary(legalDone ? legal : []);
  const repairs = techDone && issues ? sumRepairs(issues) : null;
  const repairShare = repairs ? repairs.mid / property.askingPrice : 0;
  const redIssues = techDone && issues ? issues.filter((i) => i.severity === "red").length : 0;
  const pending: PendingModule[] = [...(legalDone ? [] : (["legal"] as const)), ...(techDone ? [] : (["technical"] as const))];
  const stage: OverallResult["stage"] = pending.length === 0 ? "complete" : "preliminary";
  const digitalConfidence = valuation.status === "ok" ? valuation.confidence.overall : 0;
  const overPct = price.vsRangePct ?? 0;

  const reasons: Msg[] = [];
  let verdict: OverallVerdict;

  if (ls.red > 0) {
    verdict = "REVIEW_REQUIRED";
    reasons.push({ code: "overall.legal-red" });
  } else if (techDone && (repairShare > RULES.heavyRepairShare || redIssues >= 3)) {
    verdict = "HIGH_RISK";
    reasons.push({ code: "overall.tech-heavy", params: { pct: Math.round(repairShare * 100) } });
  } else if (price.verdict === "INSUFFICIENT_DATA" || digitalConfidence < RULES.minDigitalConfidence) {
    verdict = stage === "complete" ? "REVIEW_REQUIRED" : "INSUFFICIENT_DATA";
    reasons.push({ code: "overall.price-insufficient" });
  } else if (stage === "complete") {
    if (price.verdict === "SLIGHTLY_OVERPRICED" || price.verdict === "OVERPRICED" || repairShare > RULES.negotiateRepairShare || ls.yellow > 0) {
      verdict = "NEGOTIATE";
      if (price.verdict === "SLIGHTLY_OVERPRICED" || price.verdict === "OVERPRICED") reasons.push({ code: "overall.negotiate-price" });
      if (repairShare > RULES.negotiateRepairShare) reasons.push({ code: "overall.negotiate-repairs", params: { pct: Math.round(repairShare * 100) } });
      if (ls.yellow > 0) reasons.push({ code: "overall.negotiate-legal" });
    } else {
      verdict = "GOOD_BUY";
      reasons.push({ code: "overall.good" });
    }
  } else {
    // preliminary, digital evidence only
    if (price.verdict === "OVERPRICED" && overPct > RULES.heavyOverpricePct) {
      verdict = "CAUTION";
      reasons.push({ code: "overall.prelim-heavy-over", params: { pct: Math.round(overPct) } });
    } else if (price.verdict === "UNDERPRICED" && price.ratio !== null && price.ratio < RULES.suspiciousCheapRatio) {
      verdict = "CAUTION";
      reasons.push({ code: "overall.prelim-too-cheap", params: { pct: Math.round((1 - price.ratio) * 100) } });
    } else if (price.verdict === "SLIGHTLY_OVERPRICED" || price.verdict === "OVERPRICED" || ls.yellow > 0 || repairShare > RULES.negotiateRepairShare) {
      verdict = "NEGOTIATE";
      if (price.verdict === "SLIGHTLY_OVERPRICED" || price.verdict === "OVERPRICED") reasons.push({ code: "overall.negotiate-price" });
      if (repairShare > RULES.negotiateRepairShare) reasons.push({ code: "overall.negotiate-repairs", params: { pct: Math.round(repairShare * 100) } });
      if (ls.yellow > 0) reasons.push({ code: "overall.negotiate-legal" });
    } else {
      verdict = "PROMISING";
      reasons.push({ code: price.verdict === "UNDERPRICED" ? "overall.prelim-below" : "overall.prelim-fair" });
    }
    reasons.push({ code: `overall.pending.${pending.join("+")}` });
  }
  if (price.verdict === "UNDERPRICED" && verdict !== "CAUTION") reasons.push({ code: "overall.check-why-cheap" });

  // ---- strengths (evidence only) ----
  const strengths: Array<Msg & { w: number }> = [];
  if (price.verdict === "UNDERPRICED" || price.verdict === "FAIR") strengths.push({ code: "strength.price", w: 80 });
  for (const s of scores) if (s.value !== null && s.value >= 70 && s.id !== "value") strengths.push({ code: `strength.${s.id}`, params: { v: s.value }, w: s.value });
  if (legalDone && ls.red === 0 && ls.yellow === 0) strengths.push({ code: "strength.legal-clean", w: 85 });

  // ---- risks (found problems only; "not checked yet" lives in `pending`) ----
  const risks: Array<Msg & { w: number }> = [];
  if (ls.red) risks.push({ code: "risk.legal-red", params: { n: ls.red }, w: 100 });
  if (redIssues) risks.push({ code: "risk.tech-red", params: { n: redIssues }, w: 90 });
  if (repairShare > RULES.negotiateRepairShare) risks.push({ code: "risk.repairs", params: { pct: Math.round(repairShare * 100) }, w: 70 + repairShare * 100 });
  if (price.verdict === "OVERPRICED") risks.push({ code: "risk.overpriced", params: { pct: Math.round(overPct) }, w: 75 });
  if (price.verdict === "SLIGHTLY_OVERPRICED") risks.push({ code: "risk.slightly", params: { pct: Math.round(overPct) }, w: 60 });
  if (ls.yellow) risks.push({ code: "risk.legal-yellow", params: { n: ls.yellow }, w: 65 });
  if (valuation.status === "ok" && valuation.confidence.overall < 0.5) risks.push({ code: "risk.low-confidence", params: { pct: Math.round(valuation.confidence.overall * 100) }, w: 52 });
  if (valuation.status !== "ok") risks.push({ code: "risk.no-valuation", w: 62 });
  if (price.verdict === "UNDERPRICED") risks.push({ code: "risk.too-cheap", w: 55 });
  for (const s of scores) if (s.value !== null && s.value < 45 && s.id !== "value") risks.push({ code: `risk.low-${s.id}`, params: { v: s.value }, w: 45 });

  const top = (list: Array<Msg & { w: number }>) =>
    list
      .sort((a, b) => b.w - a.w)
      .slice(0, 3)
      .map(({ code, params }) => ({ code, params }));

  // ---- next actions ----
  const nextActions: OverallResult["nextActions"] = [];
  if (!techDone) nextActions.push({ code: "action.inspection", action: "inspection" });
  if (!legalDone || ls.yellow || ls.red) nextActions.push({ code: "action.legal", action: "legal" });
  if (price.verdict === "SLIGHTLY_OVERPRICED" || price.verdict === "OVERPRICED" || price.verdict === "FAIR") nextActions.push({ code: "action.negotiate", action: "negotiate" });
  nextActions.push({ code: "action.seller-questions", action: "seller-questions" });
  nextActions.push({ code: "action.compare", action: "compare" });
  if (nextActions.length < 4) nextActions.push({ code: "action.consult", action: "consult" });

  return { verdict, stage, pending, reasons, strengths: top(strengths), risks: top(risks), nextActions: nextActions.slice(0, 5) };
}
