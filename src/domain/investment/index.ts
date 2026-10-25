import type { CityAdapter } from "../location/types";
import type { Property } from "../property/types";
import { areaFactor } from "../property/adapters";

export type ScenarioId = "conservative" | "base" | "optimistic";

export interface Scenario {
  id: ScenarioId;
  monthlyRent: number;
  vacancyPct: number;
  appreciationPctYear: number;
  grossYieldPct: number;
  netYieldPct: number;
  annualNetCashflow: number;
  /** Cumulative over the horizon: net cash flow + price change − upfront capex. */
  totalReturn5y: number;
  totalReturn5yPct: number;
}

export interface InvestmentResult {
  status: "ok" | "insufficient";
  currency: string;
  purchasePrice: number;
  capex: number;
  scenarios: Scenario[];
  assumptions: {
    maintenancePctPrice: number;
    managementPctRent: number;
    taxPctRent: number;
    horizonYears: number;
    taxNote: "to-verify";
  };
  /** live-comps = median rent/m² of live DIM.RIA rent listings; benchmark = city figure (see its note). */
  rentBasis: "live-comps" | "benchmark" | "none";
  /** Resort markets: long-term rent understates income (short-term letting), data not yet connected. */
  resort: boolean;
}

/** Rental income tax in Ukraine is assumed 18% PIT + 5% military levy; configurable and flagged for verification. */
const ASSUMPTIONS = {
  maintenancePctPrice: 0.01,
  managementPctRent: 0.08,
  taxPctRent: 0.23,
  horizonYears: 5,
  taxNote: "to-verify" as const,
};

const SCENARIO_PARAMS: Record<ScenarioId, { rent: number; vacancy: number; appreciation: number }> = {
  conservative: { rent: 0.88, vacancy: 0.15, appreciation: 0 },
  base: { rent: 1, vacancy: 0.08, appreciation: 0.03 },
  optimistic: { rent: 1.1, vacancy: 0.04, appreciation: 0.06 },
};

export function analyzeInvestment(
  property: Property,
  city: CityAdapter,
  opts: { capex?: number; purchasePrice?: number; liveRentPerSqm?: number } = {},
): InvestmentResult {
  const rentPerSqm = opts.liveRentPerSqm ?? city.valuation.rentBenchmark?.value ?? null;
  const price = opts.purchasePrice ?? property.askingPrice;
  const capex = opts.capex ?? 0;
  const base = {
    currency: property.currency,
    purchasePrice: price,
    capex,
    assumptions: ASSUMPTIONS,
    rentBasis: (opts.liveRentPerSqm ? "live-comps" : rentPerSqm ? "benchmark" : "none") as InvestmentResult["rentBasis"],
    resort: city.marketKind === "resort",
  };
  if (!rentPerSqm) return { ...base, status: "insufficient", scenarios: [] };

  const district = city.districts.find((d) => d.id === property.districtId);
  // A live rent median already reflects location; the district multiplier only adjusts a city benchmark.
  const distRent = opts.liveRentPerSqm ? 1 : 1 + ((district?.priceMultiplier ?? 1) - 1) * 0.5;
  const marketRent = rentPerSqm * property.areaSqm * areaFactor(property.areaSqm) * distRent;

  const scenarios = (Object.keys(SCENARIO_PARAMS) as ScenarioId[]).map((id): Scenario => {
    const p = SCENARIO_PARAMS[id];
    const monthlyRent = marketRent * p.rent;
    const gross = monthlyRent * 12;
    const effective = gross * (1 - p.vacancy);
    const net =
      effective - effective * ASSUMPTIONS.managementPctRent - effective * ASSUMPTIONS.taxPctRent - price * ASSUMPTIONS.maintenancePctPrice;
    const appreciation = price * (Math.pow(1 + p.appreciation, ASSUMPTIONS.horizonYears) - 1);
    const total = net * ASSUMPTIONS.horizonYears + appreciation - capex;
    return {
      id,
      monthlyRent: Math.round(monthlyRent),
      vacancyPct: p.vacancy * 100,
      appreciationPctYear: p.appreciation * 100,
      grossYieldPct: (gross / price) * 100,
      netYieldPct: (net / (price + capex)) * 100,
      annualNetCashflow: Math.round(net),
      totalReturn5y: Math.round(total),
      totalReturn5yPct: (total / (price + capex)) * 100,
    };
  });

  return { ...base, status: "ok", scenarios };
}
