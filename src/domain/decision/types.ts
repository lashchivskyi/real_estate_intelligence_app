import type { DataKind } from "../provenance";

/** Structured, translatable message: domain returns codes, UI turns them into text. */
export interface Msg {
  code: string;
  params?: Record<string, string | number>;
}

export type PriceVerdict = "UNDERPRICED" | "FAIR" | "SLIGHTLY_OVERPRICED" | "OVERPRICED" | "INSUFFICIENT_DATA";
/**
 * Final verdicts (all modules done): GOOD_BUY | NEGOTIATE | HIGH_RISK | REVIEW_REQUIRED.
 * Preliminary verdicts (digital only, checks pending): PROMISING | NEGOTIATE | CAUTION | INSUFFICIENT_DATA.
 * A RED finding from a completed module overrides either (REVIEW_REQUIRED / HIGH_RISK).
 */
export type OverallVerdict = "GOOD_BUY" | "NEGOTIATE" | "HIGH_RISK" | "REVIEW_REQUIRED" | "PROMISING" | "CAUTION" | "INSUFFICIENT_DATA";

export type SubscoreId = "value" | "technical" | "legal" | "location" | "lifestyle" | "investment" | "liquidity";

export interface Driver extends Msg {
  /** Points this factor added to (+) or removed from (−) the score. */
  delta: number;
  kind: DataKind;
}

export interface Subscore {
  id: SubscoreId;
  /** 0..100, or null when there is not enough data (never shown as 0). */
  value: number | null;
  /** 0..1 how much we trust the number. */
  confidence: number;
  kind: DataKind;
  drivers: Driver[];
  /** Codes of the data that would make the score possible / better. */
  missing: string[];
}

export interface Negotiation {
  ask: number;
  fairLow: number;
  fairHigh: number;
  opening: number;
  walkAway: number;
  currency: string;
  /** What the numbers rest on. */
  basis: Msg[];
}
