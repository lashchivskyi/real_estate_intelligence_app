import type { Lang } from "../location/types";

export type Severity = "green" | "yellow" | "red";
export type Urgency = "immediate" | "within_year" | "monitor";
export type NegotiationImpact = "none" | "low" | "medium" | "high";
export type SpecialistId =
  | "inspector"
  | "lawyer"
  | "surveyor"
  | "electrician"
  | "engineer"
  | "plumber"
  | "hvac"
  | "appraiser";

export type SectionId =
  | "structure"
  | "moisture"
  | "electrical"
  | "plumbing"
  | "heating"
  | "windows"
  | "renovation"
  | "common"
  | "energy";

export interface ChecklistItem {
  id: string;
  /** A conclusion on this item needs a licensed specialist; software never concludes it. */
  licensedOnly?: boolean;
}
export interface ChecklistSection {
  id: SectionId;
  items: ChecklistItem[];
}

/** Residential apartment methodology (labels live in i18n under inspection.items.*). */
export const RESIDENTIAL_APARTMENT_CHECKLIST: ChecklistSection[] = [
  {
    id: "structure",
    items: [
      { id: "cracks", licensedOnly: true },
      { id: "deformation", licensedOnly: true },
      { id: "floors_slabs" },
      { id: "walls_geometry" },
      { id: "ceilings" },
      { id: "roof_foundation", licensedOnly: true },
    ],
  },
  {
    id: "moisture",
    items: [{ id: "humidity_readings" }, { id: "leaks_traces" }, { id: "mold" }, { id: "condensation" }, { id: "thermal_bridges" }],
  },
  {
    id: "electrical",
    items: [
      { id: "panel" },
      { id: "breakers_rcd" },
      { id: "wiring_material" },
      { id: "grounding", licensedOnly: true },
      { id: "sockets_load" },
      { id: "visible_defects" },
    ],
  },
  {
    id: "plumbing",
    items: [{ id: "water_pressure" }, { id: "pipes_material" }, { id: "leak_test" }, { id: "sewage" }, { id: "risers" }],
  },
  {
    id: "heating",
    items: [{ id: "boiler_meter" }, { id: "radiators" }, { id: "ventilation" }, { id: "air_conditioning" }, { id: "energy_efficiency" }],
  },
  { id: "windows", items: [{ id: "sealing" }, { id: "installation" }, { id: "thermal_quality" }, { id: "doors" }] },
  {
    id: "renovation",
    items: [{ id: "geometry" }, { id: "tile" }, { id: "plaster" }, { id: "flooring" }, { id: "hidden_defects" }, { id: "workmanship" }],
  },
  {
    id: "common",
    items: [{ id: "lift" }, { id: "roof_common" }, { id: "basement" }, { id: "facade" }, { id: "stairwell" }, { id: "utilities_mgmt" }],
  },
  // Added after market research (OLX 2026: backup power 68%, autonomous heating 68%, shelter 60% of buyers).
  {
    id: "energy",
    items: [{ id: "backup_power" }, { id: "heating_type" }, { id: "gas_supply" }, { id: "shelter" }, { id: "fire_safety" }, { id: "outage_queue" }],
  },
];

export const CHECKLISTS: Record<string, ChecklistSection[]> = {
  "residential-apartment": RESIDENTIAL_APARTMENT_CHECKLIST,
  // Structure registered, content to be authored with the first inspectors.
  "commercial-generic": [],
  "land-generic": [],
};

export interface RepairEstimate {
  low: number;
  high: number;
  currency: string;
  /** What the range assumes. */
  assumption: Record<Lang, string>;
  sourceId: string;
  /** 0..1 */
  confidence: number;
  asOf: string;
}

export interface InspectionIssue {
  id: string;
  sectionId: SectionId;
  severity: Severity;
  title: Record<Lang, string>;
  explanation: Record<Lang, string>;
  urgency: Urgency;
  repair: RepairEstimate | null;
  specialist: SpecialistId;
  negotiation: NegotiationImpact;
  /** Real inspections attach photos; demo shows an illustration instead. */
  photos: Array<{ src: string; alt: Record<Lang, string> }>;
}

export function sumRepairs(issues: InspectionIssue[]) {
  let low = 0;
  let high = 0;
  let counted = 0;
  for (const i of issues) {
    if (i.repair) {
      low += i.repair.low;
      high += i.repair.high;
      counted++;
    }
  }
  return { low, high, mid: (low + high) / 2, counted, uncosted: issues.filter((i) => i.severity !== "green" && !i.repair).length };
}

/** Which specialist to suggest, driven by risk (not every client needs every expert). */
export function recommendSpecialists(opts: {
  issues: InspectionIssue[];
  legalHasRedOrYellow: boolean;
  buildingAge?: number;
  structuralConcern?: boolean;
}): SpecialistId[] {
  const set = new Set<SpecialistId>();
  for (const i of opts.issues) if (i.severity !== "green") set.add(i.specialist);
  if (opts.legalHasRedOrYellow) set.add("lawyer");
  if (opts.structuralConcern) set.add("engineer");
  if (opts.buildingAge && opts.buildingAge > 50) set.add("electrician");
  return [...set];
}
