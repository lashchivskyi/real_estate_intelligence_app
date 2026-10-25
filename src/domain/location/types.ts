export type Lang = "uk" | "en";
export type LngLat = [lng: number, lat: number];

/** Country → Region → City → District → Neighborhood → Street → Property */
export type LocationLevel =
  | "country"
  | "region"
  | "city"
  | "district"
  | "neighborhood"
  | "street"
  | "property";

export interface LocationNode {
  id: string;
  level: LocationLevel;
  parentId?: string;
  names: Record<Lang, string>;
  center?: LngLat;
}

/** Location indicators, 0..100. Computed live from OSM (see server/sources/overpass); config values are only a fallback. */
export interface DistrictProfile {
  transit: number;
  schools: number;
  parks: number;
  quiet: number;
  shops: number;
  parking: number;
  business: number;
  /** Rough share of old building stock where wiring/plumbing are typical concerns. */
  oldStock: number;
}
export type IndicatorKey = Exclude<keyof DistrictProfile, "oldStock">;
export const INDICATOR_KEYS: IndicatorKey[] = ["transit", "schools", "shops", "parks", "quiet", "parking", "business"];

export interface District {
  id: string;
  names: Record<Lang, string>;
  /** Geocoded via Nominatim (scripts/geocode-places.mjs). */
  center: LngLat;
  /** Price multiplier vs city benchmark — UNCALIBRATED fallback, used only without live comps. */
  priceMultiplier?: number;
  /** Offline fallback profile; live OSM indicators take precedence. */
  profile?: DistrictProfile;
}

/** live = full service; beta = service available, market data only from live sources (no offline benchmark). */
export type CityStatus = "live" | "beta" | "coming-soon";
/** Resort markets behave differently (short-term rental, seasonality, apart-hotels). */
export type MarketKind = "urban" | "resort";

export type ReportModuleId =
  | "value"
  | "legal"
  | "technical"
  | "location"
  | "lifestyle"
  | "investment"
  | "future"
  | "liquidity";

export interface Benchmark {
  value: number;
  /** ISO month the figure refers to. */
  asOf: string;
  sourceId: string;
  url?: string;
  note: string;
}

export interface CityAdapter {
  id: string;
  countryCode: string;
  regionId: string;
  names: Record<Lang, string>;
  regionNames: Record<Lang, string>;
  center: LngLat;
  zoom: number;
  timezone: string;
  /** Currency in which the local market quotes prices. */
  currency: "USD" | "EUR" | "UAH" | "PLN";
  status: CityStatus;
  marketKind: MarketKind;
  districts: District[];
  /** Which report modules can be produced here today. */
  availableReports: ReportModuleId[];
  /** Names used to resolve ids in external APIs at runtime (no hardcoded foreign ids). */
  external: { riaStateName: string; riaCityName: string };
  valuation: {
    /** Published figure used only when live comps are unavailable. Null = none; we never invent one. */
    benchmark: Benchmark | null;
    /** Share by which asking prices typically exceed sale prices (min..max). */
    askToSoldDiscount: [number, number];
    rentBenchmark: Benchmark | null;
    calibration: "uncalibrated" | "calibrated";
  };
  inspection: { available: boolean; leadTimeDays: number | null };
  /** Data source ids (see SOURCES) that are intended for this city. */
  dataSourceIds: string[];
  regulationNotes: string[];
}
