import type { ReportModuleId } from "../location/types";
import type { BuildingType, Condition, Property, PropertyClass } from "./types";

/**
 * Per-class behaviour lives here, so adding a class means adding an adapter,
 * not touching the valuation / report core.
 */
export interface PropertyTypeAdapter {
  id: PropertyClass;
  /** Valuation is only claimed where rules + comps exist. */
  valuationSupported: boolean;
  minComps: number;
  /** Multiplicative adjustments; return 1 when attribute is unknown. */
  adjustments: Array<{
    id: string;
    factor: (p: Pick<Property, "areaSqm" | "floor" | "floorsTotal" | "yearBuilt" | "condition" | "buildingType">) => number;
    /** Attribute needed for this adjustment to be meaningful. */
    needs?: keyof Property;
  }>;
  inspectionChecklistId: string;
  reportModules: ReportModuleId[];
}

const CONDITION_MULT: Record<Condition, number> = {
  shell: 0.8,
  needs_renovation: 0.88,
  cosmetic: 0.95,
  good: 1,
  euro: 1.07,
  new: 1.04,
};

const BUILDING_MULT: Record<BuildingType, number> = {
  historic: 1.1,
  soviet_brick: 1,
  panel: 0.92,
  modern: 1.1,
  other: 1,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const areaFactor = (area: number) => Math.pow(area / 55, -0.12);
export const floorFactor = (floor?: number, total?: number) => {
  if (floor === undefined) return 1;
  if (floor <= 1) return 0.94;
  if (total && total >= 5 && floor === total) return 0.96;
  return 1;
};
export const ageFactor = (year?: number) => (year ? clamp(1 + (year - 1990) * 0.0015, 0.93, 1.06) : 1);

export const residential: PropertyTypeAdapter = {
  id: "residential",
  valuationSupported: true,
  minComps: 5,
  adjustments: [
    { id: "area", factor: (p) => areaFactor(p.areaSqm) },
    { id: "floor", factor: (p) => floorFactor(p.floor, p.floorsTotal), needs: "floor" },
    { id: "age", factor: (p) => ageFactor(p.yearBuilt), needs: "yearBuilt" },
    { id: "condition", factor: (p) => (p.condition ? CONDITION_MULT[p.condition] : 1), needs: "condition" },
    { id: "building", factor: (p) => (p.buildingType ? BUILDING_MULT[p.buildingType] : 1), needs: "buildingType" },
  ],
  inspectionChecklistId: "residential-apartment",
  reportModules: ["value", "legal", "technical", "location", "lifestyle", "investment", "future", "liquidity"],
};

/**
 * Registered with structure but without valuation rules — until data exists
 * the product says «insufficient data» rather than guessing.
 */
const stub = (id: PropertyClass, checklist: string): PropertyTypeAdapter => ({
  id,
  valuationSupported: false,
  minComps: Infinity,
  adjustments: [],
  inspectionChecklistId: checklist,
  reportModules: ["legal", "technical", "location", "future"],
});

export const commercial = stub("commercial", "commercial-generic");
export const land = stub("land", "land-generic");

const REGISTRY: Record<PropertyClass, PropertyTypeAdapter> = { residential, commercial, land };
export const getPropertyAdapter = (cls: PropertyClass) => REGISTRY[cls];
