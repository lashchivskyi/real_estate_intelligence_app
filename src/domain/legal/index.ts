import type { Lang } from "../location/types";
import type { DataKind } from "../provenance";

export type LegalStatus = "green" | "yellow" | "red" | "unknown";

export type LegalCheckId =
  | "ownership"
  | "encumbrances"
  | "mortgage"
  | "restrictions"
  | "redevelopment"
  | "land_plot"
  | "permits"
  | "developer";

export interface LegalCheck {
  id: LegalCheckId;
  status: LegalStatus;
  /** FACT only with a dated registry extract; otherwise INFERENCE or unknown. */
  kind: DataKind | null;
  sourceId: string;
  note?: Record<Lang, string>;
  /** Always true: the product never issues a legal conclusion. */
  requiresProfessionalReview: true;
}

/** Which checks apply to which market (primary market adds permits + developer). */
export function applicableLegalChecks(market: "primary" | "secondary"): LegalCheckId[] {
  const base: LegalCheckId[] = ["ownership", "encumbrances", "mortgage", "restrictions", "redevelopment", "land_plot"];
  return market === "primary" ? [...base, "permits", "developer"] : base;
}

export const pendingLegalChecks = (market: "primary" | "secondary"): LegalCheck[] =>
  applicableLegalChecks(market).map((id) => ({
    id,
    status: "unknown",
    kind: null,
    sourceId: id === "permits" ? "eadb" : id === "land_plot" ? "land-cadastre" : "drrp",
    requiresProfessionalReview: true,
  }));

export function legalSummary(checks: LegalCheck[]) {
  const known = checks.filter((c) => c.status !== "unknown");
  return {
    red: checks.filter((c) => c.status === "red").length,
    yellow: checks.filter((c) => c.status === "yellow").length,
    green: checks.filter((c) => c.status === "green").length,
    unknown: checks.length - known.length,
    total: checks.length,
  };
}
