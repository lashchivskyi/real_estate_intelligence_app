import { z } from "zod";

export const PROPERTY_CLASSES = ["residential", "commercial", "land"] as const;
export type PropertyClass = (typeof PROPERTY_CLASSES)[number];

export const SUBTYPES = {
  residential: ["apartment", "house", "townhouse"],
  commercial: ["office", "retail", "warehouse", "hospitality", "industrial"],
  land: ["residential_land", "commercial_land", "development_land", "agricultural"],
} as const satisfies Record<PropertyClass, readonly string[]>;

export const CONDITIONS = ["shell", "needs_renovation", "cosmetic", "good", "euro", "new"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const BUILDING_TYPES = ["historic", "soviet_brick", "panel", "modern", "other"] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const MARKETS = ["secondary", "primary"] as const;
export type Market = (typeof MARKETS)[number];

/** Canonical property record — every input path (URL, address, manual, PDF) normalizes into this. */
export interface Property {
  id: string;
  class: PropertyClass;
  subtype: string;
  cityId: string;
  districtId?: string;
  address?: string;
  /** Geocoded point (lng, lat) when the address was resolved. */
  coords?: [number, number];
  sourceUrl?: string;
  market: Market;
  askingPrice: number;
  currency: string;
  areaSqm: number;
  rooms?: number;
  floor?: number;
  floorsTotal?: number;
  yearBuilt?: number;
  condition?: Condition;
  buildingType?: BuildingType;
}

const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(min).max(max).optional(),
  );

/** Form / query-string input for a residential apartment. */
export const apartmentInputSchema = z.object({
  cityId: z.string().min(1).default("lviv"),
  districtId: z.string().optional(),
  address: z.string().max(200).optional(),
  sourceUrl: z.string().url().max(500).optional().or(z.literal("").transform(() => undefined)),
  market: z.enum(MARKETS).default("secondary"),
  askingPrice: z.coerce.number().min(1000).max(50_000_000),
  areaSqm: z.coerce.number().min(10).max(1000),
  rooms: optInt(1, 10),
  floor: optInt(0, 100),
  floorsTotal: optInt(1, 100),
  yearBuilt: optInt(1700, 2100),
  condition: z.enum(CONDITIONS).optional(),
  buildingType: z.enum(BUILDING_TYPES).optional(),
});
export type ApartmentInput = z.infer<typeof apartmentInputSchema>;

export function toProperty(input: ApartmentInput, currency: string, id = "p1"): Property {
  return {
    id,
    class: "residential",
    subtype: "apartment",
    currency,
    ...input,
  };
}
