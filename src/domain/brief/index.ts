import { z } from "zod";
import type { DistrictProfile } from "../location/types";
import { PROPERTY_CLASSES } from "../property/types";

export const PURPOSES = ["live", "invest", "both"] as const;
export const HOUSEHOLDS = ["single", "couple", "family", "retired"] as const;
export const PRIORITIES = ["schools", "transit", "parks", "quiet", "shops", "parking", "business"] as const;
export const RENOVATION = ["ready", "cosmetic", "renovate"] as const;
export const HORIZONS = ["lt3", "3to7", "gt7"] as const;
export const RISKS = ["low", "medium", "high"] as const;
export const TIMELINES = ["now", "3m", "6m", "exploring"] as const;
export const BRIEF_MARKETS = ["secondary", "primary", "any"] as const;

export type Priority = (typeof PRIORITIES)[number];

/** Priority → which district profile indicator measures it. */
export const PRIORITY_INDICATOR: Record<Priority, keyof DistrictProfile> = {
  schools: "schools",
  transit: "transit",
  parks: "parks",
  quiet: "quiet",
  shops: "shops",
  parking: "parking",
  business: "business",
};

const num = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().positive().optional());

export const briefSchema = z.object({
  cityId: z.string().min(1).default("lviv"),
  purpose: z.enum(PURPOSES),
  propertyClass: z.enum(PROPERTY_CLASSES).default("residential"),
  market: z.enum(BRIEF_MARKETS).default("any"),
  budgetMax: num,
  budgetMin: num,
  currency: z.string().default("USD"),
  areaMin: num,
  areaMax: num,
  rooms: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(1).max(6).optional()),
  household: z.enum(HOUSEHOLDS).optional(),
  priorities: z.array(z.enum(PRIORITIES)).max(7).default([]),
  renovation: z.enum(RENOVATION).optional(),
  horizon: z.enum(HORIZONS).optional(),
  risk: z.enum(RISKS).optional(),
  timeline: z.enum(TIMELINES).optional(),
});
export type Brief = z.infer<typeof briefSchema>;
export type BriefDraft = Partial<Brief>;

export type StepId = "city" | "purpose" | "property" | "budget" | "lifestyle" | "invest" | "condition" | "timeline";

/**
 * Adaptive step list: only asks what the answers so far make relevant.
 * Never more than one question group per screen.
 */
export function stepsFor(draft: BriefDraft): StepId[] {
  const steps: StepId[] = ["city", "purpose", "property", "budget"];
  if (draft.purpose === "live" || draft.purpose === "both") steps.push("lifestyle");
  if (draft.purpose === "invest" || draft.purpose === "both") steps.push("invest");
  steps.push("condition", "timeline");
  return steps;
}

export function stepIsValid(step: StepId, d: BriefDraft): boolean {
  switch (step) {
    case "city":
      return !!d.cityId;
    case "purpose":
      return !!d.purpose;
    case "property":
      return !!d.propertyClass;
    case "budget":
      return !!d.budgetMax && d.budgetMax > 0;
    case "lifestyle":
      return !!d.household;
    case "invest":
      return !!d.risk && !!d.horizon;
    case "condition":
      return !!d.renovation;
    case "timeline":
      return !!d.timeline;
  }
}
