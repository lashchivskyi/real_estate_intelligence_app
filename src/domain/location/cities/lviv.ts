import type { CityAdapter } from "../types";

/**
 * Lviv — first live city. District multipliers and profiles are
 * UNCALIBRATED working assumptions to be replaced by real comps and
 * municipal/OSM-derived indicators (see docs/data-sources.md).
 * Benchmark derives from public LUN medians (Q2 2026: 1-room resale ≈ $67–73k).
 */
export const lviv: CityAdapter = {
  id: "lviv",
  countryCode: "UA",
  regionId: "ua-lviv-oblast",
  names: { uk: "Львів", en: "Lviv" },
  regionNames: { uk: "Львівська область", en: "Lviv Oblast" },
  center: [24.0297, 49.8397],
  zoom: 12,
  timezone: "Europe/Kyiv",
  currency: "USD",
  status: "live",
  marketKind: "urban",
  external: { riaStateName: "Львівська", riaCityName: "Львів" },
  availableReports: ["value", "location", "lifestyle", "investment", "liquidity", "technical", "legal", "future"],
  valuation: {
    benchmark: {
      value: 1629,
      asOf: "2026-09",
      sourceId: "dom-ria",
      url: "https://dom.ria.com/uk/prodazha-kvartir/lvov/ceny/",
      note: "DIM.RIA average resale ASKING price per m² (14.09.2026, 4 444 active listings). Fallback only — live DIM.RIA comps replace it.",
    },
    askToSoldDiscount: [0.02, 0.06],
    rentBenchmark: {
      value: 9.5,
      asOf: "2026-06",
      sourceId: "city-config",
      note: "Assumption (USD/m²/month ≈ 17 000 UAH for a 40 m² 1-room); published 2026 figures range 16 500–26 900 UAH. Replaced by live DIM.RIA rent comps when configured.",
    },
    calibration: "uncalibrated",
  },
  inspection: { available: true, leadTimeDays: 3 },
  dataSourceIds: ["lun", "dom-ria", "drrp", "land-cadastre", "eadb", "osm", "nbu"],
  regulationNotes: ["martial-law-registry-access", "notary-required-for-transfer"],
  districts: [
    {
      id: "halytskyi",
      names: { uk: "Галицький", en: "Halytskyi" },
      center: [24.0315, 49.8419],
      priceMultiplier: 1.18,
      profile: { transit: 92, schools: 78, parks: 70, quiet: 38, shops: 90, parking: 25, business: 92, oldStock: 85 },
    },
    {
      id: "shevchenkivskyi",
      names: { uk: "Шевченківський", en: "Shevchenkivskyi" },
      center: [24.0094, 49.8553],
      priceMultiplier: 1.05,
      profile: { transit: 72, schools: 80, parks: 82, quiet: 66, shops: 78, parking: 55, business: 62, oldStock: 45 },
    },
    {
      id: "frankivskyi",
      names: { uk: "Франківський", en: "Frankivskyi" },
      center: [24.0, 49.8238],
      priceMultiplier: 1.02,
      profile: { transit: 78, schools: 76, parks: 64, quiet: 55, shops: 82, parking: 45, business: 70, oldStock: 60 },
    },
    {
      id: "lychakivskyi",
      names: { uk: "Личаківський", en: "Lychakivskyi" },
      center: [24.0702, 49.8301],
      priceMultiplier: 0.98,
      profile: { transit: 66, schools: 70, parks: 85, quiet: 70, shops: 68, parking: 58, business: 48, oldStock: 55 },
    },
    {
      id: "sykhivskyi",
      names: { uk: "Сихівський", en: "Sykhivskyi" },
      center: [24.0613, 49.7872],
      priceMultiplier: 0.93,
      profile: { transit: 60, schools: 82, parks: 62, quiet: 72, shops: 80, parking: 52, business: 40, oldStock: 25 },
    },
    {
      id: "zaliznychnyi",
      names: { uk: "Залізничний", en: "Zaliznychnyi" },
      center: [23.9885, 49.8369],
      priceMultiplier: 0.92,
      profile: { transit: 74, schools: 68, parks: 55, quiet: 45, shops: 74, parking: 48, business: 55, oldStock: 55 },
    },
  ],
};
