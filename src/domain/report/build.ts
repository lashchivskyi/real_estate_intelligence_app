import type { Brief } from "../brief";
import { priceVerdict, negotiation, type PriceVerdictResult } from "../decision/price";
import { decide, type OverallResult } from "../decision/overall";
import {
  decisionConfidence,
  investmentScore,
  legalScore,
  lifestyleScore,
  liquidityScore,
  locationScore,
  technicalScore,
  valueScore,
  type DecisionConfidence,
  type ResolvedIndicators,
} from "../decision/scores";
import { watchlist, type WatchItem } from "../decision/watchlist";
import type { Negotiation, Subscore } from "../decision/types";
import { analyzeInvestment, type InvestmentResult } from "../investment";
import { recommendSpecialists, sumRepairs, type InspectionIssue, type SpecialistId } from "../inspection";
import { legalSummary, pendingLegalChecks, type LegalCheck } from "../legal";
import type { ModuleState } from "../cases";
import type { LocationIntel } from "../location/intel";
import type { CityAdapter } from "../location/types";
import type { SourceStatus } from "../provenance";
import type { Property } from "../property/types";
import { estimateValue } from "../valuation/engine";
import type { Comp, ValuationResult } from "../valuation/types";

export interface FxInfo {
  /** UAH per 1 USD (NBU official). */
  uahPerUsd: number;
  date: string;
}

export interface ReportData {
  property: Property;
  city: CityAdapter;
  brief?: Pick<Brief, "priorities" | "household" | "purpose">;
  /** demo = synthetic comparables; live = real listing comps from an API. */
  dataMode: "demo" | "live";
  /** A showcase report with illustrative inspection + legal findings. */
  isSample: boolean;
  generatedAt: string;
  valuation: ValuationResult;
  price: PriceVerdictResult;
  negotiation: Negotiation | null;
  scores: Subscore[];
  confidence: DecisionConfidence;
  overall: OverallResult;
  legal: LegalCheck[];
  issues: InspectionIssue[] | null;
  repairs: ReturnType<typeof sumRepairs> | null;
  investment: InvestmentResult;
  watchlist: WatchItem[];
  specialists: SpecialistId[];
  /** Live OSM location intelligence, when fetched. */
  location: LocationIntel | null;
  indicators: ResolvedIndicators | null;
  /** Per-source runtime status for this report (live / fallback / not configured…). */
  sources: SourceStatus[];
  fx: FxInfo | null;
  /** Independent dossier modules (digital is always done). */
  modules: { digital: "done"; legal: ModuleState; technical: ModuleState };
  /** Set when the report belongs to a case in the operations system. */
  caseRef?: { id: string; number: string };
}

export interface BuildInput {
  property: Property;
  city: CityAdapter;
  comps: Comp[];
  dataMode: "demo" | "live";
  brief?: ReportData["brief"];
  issues?: InspectionIssue[] | null;
  legal?: LegalCheck[];
  isSample?: boolean;
  now?: Date;
  location?: LocationIntel | null;
  /** Median monthly rent per m² from live rent listings. */
  liveRentPerSqm?: number;
  sources?: SourceStatus[];
  fx?: FxInfo | null;
  /** Module states from the case workflow; derived from the evidence when omitted. */
  modules?: { legal: ModuleState; technical: ModuleState };
  caseRef?: ReportData["caseRef"];
}

/** Best available evidence for location indicators: live OSM → district config fallback → none. */
export function resolveIndicators(property: Property, city: CityAdapter, location?: LocationIntel | null): ResolvedIndicators | null {
  if (location) return { values: location.indicators, level: location.level, kind: location.kind, confidence: location.confidence };
  const profile = city.districts.find((d) => d.id === property.districtId)?.profile;
  if (!profile) return null;
  const { oldStock: _omit, ...values } = profile;
  void _omit;
  return { values, level: "config", kind: "INFERENCE", confidence: 0.3 };
}

export function buildReport(input: BuildInput): ReportData {
  const { property, city, comps, dataMode } = input;
  const modules = input.modules ?? {
    legal: input.legal && input.legal.some((l) => l.status !== "unknown") ? ("done" as const) : ("not_ordered" as const),
    technical: input.issues ? ("done" as const) : ("not_ordered" as const),
  };
  // A module's findings count only once it is done (a draft must not leak into the verdict).
  const issues = modules.technical === "done" ? (input.issues ?? null) : null;
  const legal = modules.legal === "done" && input.legal ? input.legal : pendingLegalChecks(property.market);
  const repairs = issues ? sumRepairs(issues) : null;

  const valuation = estimateValue(property, { city, comps, dataMode });
  const price = priceVerdict(property.askingPrice, valuation);
  const nego = negotiation(property.askingPrice, valuation, repairs?.mid ?? 0);
  const investment = analyzeInvestment(property, city, { capex: repairs?.mid ?? 0, liveRentPerSqm: input.liveRentPerSqm });
  const indicators = resolveIndicators(property, city, input.location);

  const scores: Subscore[] = [
    valueScore(property.askingPrice, valuation),
    technicalScore(issues, property.askingPrice),
    legalScore(legal),
    locationScore(indicators),
    lifestyleScore(indicators, input.brief),
    investmentScore(investment),
    liquidityScore(property, valuation, price.ratio),
  ];

  const ls = legalSummary(legal);
  const age = property.yearBuilt ? (input.now ?? new Date()).getFullYear() - property.yearBuilt : undefined;
  return {
    property,
    city,
    brief: input.brief,
    dataMode,
    isSample: input.isSample ?? false,
    generatedAt: (input.now ?? new Date()).toISOString(),
    valuation,
    price,
    negotiation: nego,
    scores,
    confidence: decisionConfidence(scores),
    overall: decide({ property, valuation, price, legal, issues, scores, modules }),
    legal,
    issues,
    repairs,
    investment,
    watchlist: watchlist(property),
    specialists: recommendSpecialists({
      issues: issues ?? [],
      legalHasRedOrYellow: ls.red + ls.yellow > 0,
      buildingAge: age,
    }),
    location: input.location ?? null,
    indicators,
    sources: input.sources ?? [{ sourceId: dataMode === "demo" ? "demo-comps" : "dom-ria", status: dataMode === "demo" ? "demo" : "live" }],
    fx: input.fx ?? null,
    modules: { digital: "done", ...modules },
    caseRef: input.caseRef,
  };
}
