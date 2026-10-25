import type { CityAdapter, District, Lang } from "../types";

/**
 * Western Ukraine coverage beyond Lviv: regional centres plus the tourist towns with a liquid
 * apartment market (resort apart-hotels, spa towns). Coordinates are geocoded with Nominatim
 * (scripts/geocode-places.mjs, 2026-10). Benchmarks are set ONLY where a dated public figure exists;
 * elsewhere `benchmark: null` and valuations require live DIM.RIA comps — we never invent prices.
 */

type Names = Record<Lang, string>;
const d = (id: string, names: Names, center: [number, number]): District => ({ id, names, center });

const base = (
  c: Pick<CityAdapter, "id" | "names" | "regionId" | "regionNames" | "center" | "marketKind" | "status" | "districts" | "external"> &
    Partial<Pick<CityAdapter, "zoom" | "inspection">> & { valuation?: Partial<CityAdapter["valuation"]> },
): CityAdapter => ({
  countryCode: "UA",
  zoom: c.zoom ?? (c.districts.length ? 12.5 : 13.5),
  timezone: "Europe/Kyiv",
  currency: "USD",
  availableReports: ["value", "location", "lifestyle", "investment", "liquidity", "technical", "legal", "future"],
  inspection: c.inspection ?? { available: true, leadTimeDays: 5 },
  dataSourceIds: ["dom-ria", "drrp", "land-cadastre", "eadb", "osm", "nbu"],
  regulationNotes: c.marketKind === "resort" ? ["apart-hotel-title-check", "land-designation-recreational"] : ["notary-required-for-transfer"],
  ...c,
  valuation: {
    benchmark: null,
    askToSoldDiscount: [0.02, 0.07],
    rentBenchmark: null,
    calibration: "uncalibrated",
    ...c.valuation,
  },
});

const LV = { uk: "Львівська область", en: "Lviv Oblast" };
const IF = { uk: "Івано-Франківська область", en: "Ivano-Frankivsk Oblast" };
const ZK = { uk: "Закарпатська область", en: "Zakarpattia Oblast" };

export const ivanoFrankivsk = base({
  id: "ivano-frankivsk",
  names: { uk: "Івано-Франківськ", en: "Ivano-Frankivsk" },
  regionId: "ua-ivano-frankivsk-oblast",
  regionNames: IF,
  center: [24.7103, 48.9225],
  marketKind: "urban",
  status: "live",
  external: { riaStateName: "Івано-Франківська", riaCityName: "Івано-Франківськ" },
  districts: [
    d("if-centre", { uk: "Центр", en: "Centre" }, [24.7103, 48.9225]),
    d("pasichna", { uk: "Пасічна", en: "Pasichna" }, [24.6961, 48.9428]),
    d("kaskad", { uk: "Каскад", en: "Kaskad" }, [24.7509, 48.9349]),
    d("pozytron", { uk: "Позитрон", en: "Pozytron" }, [24.7425, 48.9404]),
    d("bam", { uk: "БАМ", en: "BAM" }, [24.6873, 48.9058]),
  ],
  valuation: {
    benchmark: {
      value: 1199,
      asOf: "2026-10",
      sourceId: "dom-ria",
      url: "https://dom.ria.com/uk/prodazha-kvartir/ivano-frankovsk/ceny/",
      note: "DIM.RIA average resale asking price per m² (05.10.2026, via 24tv.ua). Fallback only.",
    },
  },
});

export const uzhhorod = base({
  id: "uzhhorod",
  names: { uk: "Ужгород", en: "Uzhhorod" },
  regionId: "ua-zakarpattia-oblast",
  regionNames: ZK,
  center: [22.3023, 48.6224],
  marketKind: "urban",
  status: "live",
  external: { riaStateName: "Закарпатська", riaCityName: "Ужгород" },
  districts: [
    d("uz-centre", { uk: "Центр", en: "Centre" }, [22.3023, 48.6224]),
    d("bozdosh", { uk: "Боздош", en: "Bozdosh" }, [22.2664, 48.6163]),
    d("radvanka", { uk: "Радванка", en: "Radvanka" }, [22.3166, 48.615]),
    d("dravtsi", { uk: "Дравці", en: "Dravtsi" }, [22.3242, 48.5848]),
  ],
  valuation: {
    benchmark: {
      value: 1365,
      asOf: "2026-04",
      sourceId: "dom-ria",
      url: "https://goloskarpat.info/society/69adc4ead1b19/",
      note: "DIM.RIA average resale asking price per m² ($1 360–1 370, spring 2026; LUN: ≈$1 650 for 1-room flats). Fallback only.",
    },
    rentBenchmark: {
      value: 11.9,
      asOf: "2026-05",
      sourceId: "published-report",
      url: "https://gazeta.ua/articles/economics/_cim-zahidnishe-tim-dorozhche-v-uzhgorodi-najdorozhcha-orenda-kvartir-na-tli-skorochennya-propoziciyi/1249565",
      note: "Derived: 1-room rent ≈ 21 500 UAH/month (May 2026) ÷ ~40 m² at ~45 UAH/USD. Assumption-heavy.",
    },
  },
});

export const mukachevo = base({
  id: "mukachevo",
  names: { uk: "Мукачево", en: "Mukachevo" },
  regionId: "ua-zakarpattia-oblast",
  regionNames: ZK,
  center: [22.7185, 48.4421],
  marketKind: "urban",
  status: "beta",
  external: { riaStateName: "Закарпатська", riaCityName: "Мукачево" },
  districts: [
    d("mk-centre", { uk: "Центр", en: "Centre" }, [22.7185, 48.4421]),
    d("palanok", { uk: "Паланок", en: "Palanok" }, [22.6866, 48.4313]),
  ],
});

export const truskavets = base({
  id: "truskavets",
  names: { uk: "Трускавець", en: "Truskavets" },
  regionId: "ua-lviv-oblast",
  regionNames: LV,
  center: [23.506, 49.2782],
  marketKind: "resort",
  status: "beta",
  external: { riaStateName: "Львівська", riaCityName: "Трускавець" },
  districts: [],
});

export const skhidnytsia = base({
  id: "skhidnytsia",
  names: { uk: "Східниця", en: "Skhidnytsia" },
  regionId: "ua-lviv-oblast",
  regionNames: LV,
  center: [23.3503, 49.2276],
  marketKind: "resort",
  status: "beta",
  external: { riaStateName: "Львівська", riaCityName: "Східниця" },
  districts: [],
});

export const bukovel = base({
  id: "bukovel",
  names: { uk: "Буковель (Поляниця)", en: "Bukovel (Polianytsia)" },
  regionId: "ua-ivano-frankivsk-oblast",
  regionNames: IF,
  center: [24.4128, 48.3538],
  marketKind: "resort",
  status: "beta",
  external: { riaStateName: "Івано-Франківська", riaCityName: "Поляниця" },
  districts: [],
});

export const yaremche = base({
  id: "yaremche",
  names: { uk: "Яремче", en: "Yaremche" },
  regionId: "ua-ivano-frankivsk-oblast",
  regionNames: IF,
  center: [24.551, 48.4504],
  marketKind: "resort",
  status: "beta",
  external: { riaStateName: "Івано-Франківська", riaCityName: "Яремче" },
  districts: [],
});
