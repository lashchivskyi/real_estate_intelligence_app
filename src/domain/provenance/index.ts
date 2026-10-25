/**
 * Provenance: every important value says what kind of knowledge it is
 * (FACT / INFERENCE / ESTIMATE), where it came from and how sure we are.
 */

export type DataKind = "FACT" | "INFERENCE" | "ESTIMATE";

export type LegalNote =
  | "allowed"
  | "allowed-with-attribution"
  | "license-required"
  | "forbidden"
  | "to-verify";

export interface DataSourceDescriptor {
  id: string;
  name: string;
  url?: string;
  license: string;
  access: "official" | "open-data" | "licensed-api" | "partner" | "manual" | "internal";
  legalNote: LegalNote;
  status: "verified" | "to-verify" | "not-connected" | "demo";
}

export interface Provenanced<T> {
  kind: DataKind;
  value: T;
  /** Value as received from the source, before transformation. */
  raw?: unknown;
  sourceId: string;
  /** ISO timestamp the value was fetched or computed. */
  fetchedAt: string;
  /** 0..1 */
  confidence: number;
  method?: { name: string; version: string };
}

const make =
  (kind: DataKind) =>
  <T>(
    value: T,
    meta: Omit<Provenanced<T>, "kind" | "value" | "fetchedAt"> & { fetchedAt?: string },
  ): Provenanced<T> => ({
    kind,
    value,
    ...meta,
    fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
  });

export const fact = make("FACT");
export const inference = make("INFERENCE");
export const estimate = make("ESTIMATE");

/** Runtime status of a source for one report — shown to the user in "Sources & methodology". */
export interface SourceStatus {
  sourceId: string;
  status: "live" | "fallback" | "demo" | "not-configured" | "error" | "not-connected";
  fetchedAt?: string;
  /** Short machine detail, e.g. "24 comps", "HTTP 429". */
  detail?: string;
}

/** Registry of sources the product knows about (see docs/data-sources.md). */
export const SOURCES: Record<string, DataSourceDescriptor> = {
  "user-input": {
    id: "user-input",
    name: "Provided by the user",
    license: "n/a",
    access: "internal",
    legalNote: "allowed",
    status: "verified",
  },
  "demo-comps": {
    id: "demo-comps",
    name: "Synthetic demo comparables",
    license: "n/a (generated)",
    access: "internal",
    legalNote: "allowed",
    status: "demo",
  },
  "city-config": {
    id: "city-config",
    name: "City adapter configuration (uncalibrated benchmarks)",
    license: "n/a",
    access: "internal",
    legalNote: "allowed",
    status: "demo",
  },
  lun: {
    id: "lun",
    name: "LUN market statistics",
    url: "https://lun.ua/stat",
    license: "public reports; listing-level data requires an agreement",
    access: "partner",
    legalNote: "license-required",
    status: "to-verify",
  },
  "dom-ria": {
    id: "dom-ria",
    name: "DIM.RIA API (listings: search + info)",
    url: "https://developers.ria.com",
    license: "API terms (key required)",
    access: "licensed-api",
    legalNote: "license-required",
    status: "verified",
  },
  drrp: {
    id: "drrp",
    name: "State Register of Property Rights (DRRP)",
    license: "statutory access",
    access: "official",
    legalNote: "to-verify",
    status: "not-connected",
  },
  "land-cadastre": {
    id: "land-cadastre",
    name: "State Land Cadastre (Derzhgeokadastr open dataset)",
    url: "https://data.gov.ua",
    license: "open data, attribution required",
    access: "open-data",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  eadb: {
    id: "eadb",
    name: "Unified State Electronic Construction System (EDESSB)",
    url: "https://e-construction.gov.ua",
    license: "public registry",
    access: "official",
    legalNote: "to-verify",
    status: "not-connected",
  },
  osm: {
    id: "osm",
    name: "OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    license: "ODbL",
    access: "open-data",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  nbu: {
    id: "nbu",
    name: "National Bank of Ukraine — official exchange rate API",
    url: "https://bank.gov.ua/ua/open-data/api-dev",
    license: "open data",
    access: "open-data",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  overpass: {
    id: "overpass",
    name: "OpenStreetMap via Overpass API (POI, roads, rail)",
    url: "https://overpass-api.de",
    license: "ODbL; public instance usage policy (cache, low volume)",
    access: "open-data",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  photon: {
    id: "photon",
    name: "Photon geocoder & nearest places (komoot, OpenStreetMap data)",
    url: "https://photon.komoot.io",
    license: "ODbL data; fair-use public instance (self-host for production)",
    access: "open-data",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  google: {
    id: "google",
    name: "Google Places API (shown on Google Maps)",
    url: "https://developers.google.com/maps/documentation/places/web-service",
    license: "Google Maps Platform terms: display on a Google map with attribution, limited caching",
    access: "licensed-api",
    legalNote: "license-required",
    status: "verified",
  },
  geoapify: {
    id: "geoapify",
    name: "Geoapify Places & Autocomplete (OpenStreetMap data, SLA)",
    url: "https://www.geoapify.com",
    license: "commercial API; OSM data under ODbL; display on any map with attribution",
    access: "licensed-api",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  nominatim: {
    id: "nominatim",
    name: "Nominatim geocoder (OpenStreetMap)",
    url: "https://nominatim.org",
    license: "ODbL; max 1 req/s, identifying User-Agent, caching required",
    access: "open-data",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  "published-report": {
    id: "published-report",
    name: "Published market report (dated, cited)",
    license: "citation",
    access: "manual",
    legalNote: "allowed-with-attribution",
    status: "verified",
  },
  routing: {
    id: "routing",
    name: "Travel-time estimate (straight-line × detour factor)",
    license: "n/a",
    access: "internal",
    legalNote: "allowed",
    status: "verified",
  },
  inspection: {
    id: "inspection",
    name: "On-site technical inspection",
    license: "ours",
    access: "internal",
    legalNote: "allowed",
    status: "demo",
  },
  "repair-price-list": {
    id: "repair-price-list",
    name: "Repair price list (internal, uncalibrated)",
    license: "ours",
    access: "internal",
    legalNote: "allowed",
    status: "demo",
  },
};
