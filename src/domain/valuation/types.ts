import type { BuildingType, Condition } from "../property/types";
import type { LngLat } from "../location/types";

export interface Comp {
  id: string;
  cityId: string;
  districtId: string;
  areaSqm: number;
  rooms: number;
  floor?: number;
  floorsTotal?: number;
  yearBuilt?: number;
  condition?: Condition;
  buildingType?: BuildingType;
  askPricePerSqm: number;
  askPrice: number;
  /** Age of the observation in days at `now`. */
  daysAgo: number;
  coords?: LngLat;
  sourceId: string;
}

export interface UsedComp {
  comp: Comp;
  /** 0..1 similarity × freshness weight. */
  weight: number;
  adjustedPricePerSqm: number;
}

export interface ConfidenceComponent {
  id: "count" | "dispersion" | "freshness" | "coverage";
  /** 0..1 */
  score: number;
  detail: Record<string, number | string>;
}

export interface Confidence {
  /** 0..1 */
  overall: number;
  components: ConfidenceComponent[];
  /** Multiplier applied because benchmarks/adjustments are not yet calibrated against real sales. */
  calibrationFactor: number;
}

export type ValuationResult =
  | {
      status: "insufficient";
      reason: "no-benchmark" | "unsupported-class" | "few-comps";
      compsFound: number;
      minComps: number;
      missing: string[];
      method: { name: string; version: string };
    }
  | {
      status: "ok";
      currency: string;
      /** Estimated fair transaction range for the whole property. */
      fairLow: number;
      fairMid: number;
      fairHigh: number;
      /** Market-ask range (before ask→sold discount), per m². */
      askPerSqmLow: number;
      askPerSqmHigh: number;
      confidence: Confidence;
      used: UsedComp[];
      /** Attributes that were not provided and therefore widened uncertainty. */
      missing: string[];
      medianCompAgeDays: number;
      dataMode: "demo" | "live";
      calibration: "uncalibrated" | "calibrated";
      method: { name: string; version: string };
    };

export const VALUATION_METHOD = { name: "cma-weighted-quantile", version: "0.1.0" } as const;
