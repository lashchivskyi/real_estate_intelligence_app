import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { convertFromUah, PACKAGES } from "@/config/packages";
import { distanceToLine, indicatorsFromOsm, metres, travelEstimate, type OsmElement } from "@/domain/location/intel";
import { getCityOrDefault, listCities } from "@/domain/location/registry";
import { buildReport } from "@/domain/report/build";
import { SAMPLE_PROPERTY } from "@/data/samples";
import { mapMonoStatus, verifyMonoSignature } from "@/server/payments/monobank";
import { verifyStripeSignature } from "@/server/payments/stripe";
import { riaInfoToComp } from "@/server/sources/ria";
import { buildQuery } from "@/server/sources/overpass";

const P: [number, number] = [24.0, 49.8238];
const node = (id: number, dLng: number, dLat: number, tags: Record<string, string>): OsmElement => ({ type: "node", id, lon: P[0] + dLng, lat: P[1] + dLat, tags });

describe("OSM location indicators", () => {
  it("counts POIs inside category radii and ignores the rest", () => {
    const els = [
      node(1, 0.001, 0, { highway: "bus_stop" }), // ~70 m
      node(2, 0.002, 0, { railway: "tram_stop" }),
      node(3, 0.02, 0, { highway: "bus_stop" }), // ~1.4 km: outside 500 m
      node(4, 0, 0.003, { amenity: "school" }),
      node(5, 0, 0.004, { amenity: "kindergarten" }),
      node(6, 0.001, 0.001, { shop: "supermarket" }),
      node(7, 0, -0.002, { leisure: "park" }),
      node(8, 0, 0, { amenity: "bench" }), // not a category
    ];
    const r = indicatorsFromOsm(P, els);
    expect(r.facts.counts.transit).toBe(2);
    expect(r.facts.counts.school).toBe(1);
    expect(r.facts.counts.kindergarten).toBe(1);
    expect(r.indicators.transit).toBeGreaterThan(20);
    expect(r.indicators.business).toBe(0);
    expect(r.pois[0].m).toBeLessThanOrEqual(r.pois[r.pois.length - 1].m);
  });
  it("a major road next to the point lowers quiet", () => {
    const road: OsmElement = { type: "way", id: 99, tags: { highway: "primary" }, geometry: [{ lat: P[1] + 0.0003, lon: P[0] - 0.01 }, { lat: P[1] + 0.0003, lon: P[0] + 0.01 }] };
    const calm = indicatorsFromOsm(P, []);
    const loud = indicatorsFromOsm(P, [road]);
    expect(calm.indicators.quiet).toBe(100);
    expect(loud.indicators.quiet).toBeLessThan(70);
    expect(loud.facts.majorRoadM).toBeGreaterThan(25);
    expect(loud.facts.majorRoadM).toBeLessThan(45);
  });
  it("geometry helpers", () => {
    expect(metres([24, 49.8], [24, 49.809])).toBeGreaterThan(990);
    expect(distanceToLine(P, [{ lat: P[1], lon: P[0] - 1 }, { lat: P[1], lon: P[0] + 1 }])).toBeLessThan(1);
    expect(travelEstimate(P, [24.03, 49.84]).walkMin).toBeGreaterThan(30);
  });
  it("builds one Overpass query covering every category", () => {
    const q = buildQuery(P);
    for (const k of ["bus_stop", "school", "supermarket", "park", "parking", "office", "primary", "railway"]) expect(q).toContain(k);
  });
  it("live location indicators replace config profiles in the report", () => {
    const city = getCityOrDefault("lviv");
    const loc = { ...indicatorsFromOsm(P, []), level: "address" as const, kind: "INFERENCE" as const, confidence: 0.7, sourceId: "overpass", fetchedAt: new Date().toISOString(), method: { name: "x", version: "1" } };
    const r = buildReport({ property: SAMPLE_PROPERTY, city, comps: [], dataMode: "demo", location: loc });
    expect(r.indicators?.level).toBe("address");
    expect(r.scores.find((s) => s.id === "location")?.confidence).toBe(0.7);
  });
});

describe("DIM.RIA mapping", () => {
  const city = getCityOrDefault("lviv");
  it("maps a listing (priceArr['1'] = USD) to a comp with price per m²", () => {
    const c = riaInfoToComp(
      { realty_id: 1, priceArr: { "1": "93 000", "2": "80 000" }, total_square_meters: 62, rooms_count: 2, floor: 3, floors_count: 9, district_name: "Франківський", latitude: "49.82", longitude: "24.00", publishing_date: "2026-10-01 10:00:00", wall_type: "панель" },
      city,
      new Date("2026-10-21T00:00:00Z"),
    );
    expect(c).not.toBeNull();
    expect(c!.askPricePerSqm).toBe(1500);
    expect(c!.districtId).toBe("frankivskyi");
    expect(c!.daysAgo).toBe(20);
    expect(c!.buildingType).toBe("panel");
    expect(c!.coords).toEqual([24, 49.82]);
  });
  it("rejects listings without price or area", () => {
    expect(riaInfoToComp({ realty_id: 2, total_square_meters: 40 }, city, new Date())).toBeNull();
    expect(riaInfoToComp({ realty_id: 3, priceArr: { "1": "50 000" } }, city, new Date())).toBeNull();
  });
});

describe("cities", () => {
  it("covers Lviv, Ivano-Frankivsk and Zakarpattia regions with resorts", () => {
    const ids = listCities().map((c) => c.id);
    for (const id of ["lviv", "truskavets", "skhidnytsia", "ivano-frankivsk", "bukovel", "yaremche", "uzhhorod", "mukachevo"]) expect(ids).toContain(id);
    expect(new Set(listCities().map((c) => c.regionId)).size).toBe(3);
  });
  it("every benchmark is dated and sourced; resorts without published data have none", () => {
    for (const c of listCities()) {
      if (c.valuation.benchmark) {
        expect(c.valuation.benchmark.asOf).toMatch(/^\d{4}-\d{2}$/);
        expect(c.valuation.benchmark.sourceId).toBeTruthy();
      }
    }
    expect(getCityOrDefault("bukovel").valuation.benchmark).toBeNull();
  });
});

describe("payments", () => {
  it("prices are set in UAH; other currencies are display conversions", () => {
    expect(PACKAGES.find((p) => p.id === "full")?.priceUah).toBe(14900);
    expect(convertFromUah(14900, 45.2)).toBe(330);
  });
  it("maps monobank statuses", () => {
    expect(mapMonoStatus("success")).toBe("paid");
    expect(mapMonoStatus("processing")).toBe("pending");
    expect(mapMonoStatus("failure")).toBe("failed");
    expect(mapMonoStatus("weird")).toBe("unknown");
  });
  it("verifies monobank ECDSA X-Sign and rejects tampering", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const body = JSON.stringify({ invoiceId: "inv1", status: "success" });
    const sig = sign("sha256", Buffer.from(body), privateKey).toString("base64");
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(verifyMonoSignature(body, sig, pem)).toBe(true);
    expect(verifyMonoSignature(body.replace("success", "failure"), sig, pem)).toBe(false);
  });
  it("verifies Stripe signatures with tolerance", () => {
    const secret = "whsec_test";
    const payload = '{"id":"evt_1"}';
    const t = 1_800_000_000;
    const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${t},v1=${v1}`, secret, t + 10)).toBe(true);
    expect(verifyStripeSignature(payload, `t=${t},v1=${v1}`, secret, t + 1000)).toBe(false);
    expect(verifyStripeSignature(payload + " ", `t=${t},v1=${v1}`, secret, t)).toBe(false);
  });
});

import { dedupeSuggestions, nearbyFromFeatures, photonToSuggestion, walkMinutes, type PhotonFeature } from "@/domain/location/geo";
import { intelFromNearby } from "@/domain/location/intel";

describe("Photon address suggestions & nearest places", () => {
  const f = (props: PhotonFeature["properties"], c: [number, number] = [24.0236, 49.8438]): PhotonFeature => ({ geometry: { coordinates: c }, properties: props });
  it("maps a building with house number to a precise suggestion", () => {
    const s = photonToSuggestion(f({ osm_type: "W", osm_id: 1, street: "Городоцька вулиця", housenumber: "12", district: "Середмістя", city: "Львів" }));
    expect(s?.precise).toBe(true);
    expect(s?.label).toBe("Городоцька вулиця, 12 — Середмістя · Львів");
  });
  it("keeps streets without numbers but ranks buildings first and dedupes", () => {
    const a = photonToSuggestion(f({ osm_type: "W", osm_id: 2, osm_key: "highway", name: "Городоцька вулиця", city: "Львів" }))!;
    const b = photonToSuggestion(f({ osm_type: "W", osm_id: 1, street: "Городоцька вулиця", housenumber: "12", city: "Львів" }))!;
    const b2 = photonToSuggestion(f({ osm_type: "N", osm_id: 9, name: "Швейна", street: "Городоцька вулиця", housenumber: "12", city: "Львів" }))!;
    const out = dedupeSuggestions([a, b, b2]);
    expect(out).toHaveLength(2);
    expect(out[0].precise).toBe(true);
  });
  it("computes distances, walking time and drops places outside the radius", () => {
    const origin: [number, number] = [24.0, 49.8];
    const res = nearbyFromFeatures("pharmacy", origin, [f({ name: "A" }, [24.0, 49.801]), f({ name: "Far" }, [24.0, 49.83])]);
    expect(res).toHaveLength(1);
    expect(res[0].m).toBeGreaterThan(100);
    expect(res[0].walkMin).toBe(walkMinutes(res[0].m));
  });
  it("fallback indicators from nearest places leave unmeasurable ones null", () => {
    const origin: [number, number] = [24.0, 49.8];
    const places = nearbyFromFeatures("transit", origin, [f({}, [24.0, 49.8005]), f({}, [24.001, 49.8])]);
    const intel = intelFromNearby(origin, places);
    expect(intel.indicators.transit).toBeGreaterThan(0);
    expect(intel.indicators.quiet).toBeNull();
    expect(intel.indicators.parking).toBeNull();
  });
});

import { groupDigits, scaleHint, ungroup } from "@/components/ui/number-input";
import { sniff } from "@/server/storage";

describe("number input formatting", () => {
  it("groups thousands with narrow no-break spaces and parses back", () => {
    expect(groupDigits("1250000")).toBe("1\u202f250\u202f000");
    expect(groupDigits("abc100 000")).toBe("100\u202f000");
    expect(ungroup(groupDigits("4500000"))).toBe("4500000");
    expect(groupDigits("62,55", true)).toBe("62,55");
  });
  it("gives a human scale hint", () => {
    expect(scaleHint(1_250_000, "uk")).toBe("≈ 1,25 млн");
    expect(scaleHint(95_000, "en")).toBe("≈ 95 K");
    expect(scaleHint(500, "uk")).toBeNull();
  });
});

describe("upload type sniffing", () => {
  const b = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)]);
  it("detects by magic bytes, not by name", () => {
    expect(sniff(b(0x25, 0x50, 0x44, 0x46))).toBe("pdf");
    expect(sniff(b(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniff(b(0x89, 0x50, 0x4e, 0x47))).toBe("png");
    expect(sniff(new TextEncoder().encode("....ftypheic........"))).toBe("heic");
    expect(sniff(new TextEncoder().encode("MZ executable......"))).toBeNull();
  });
});

describe("nearby dedupe", () => {
  it("keeps one entry for the same named place mapped twice nearby", () => {
    const f = (c: [number, number]) => ({ geometry: { coordinates: c }, properties: { name: "ТЦ Магнус" } });
    const r = nearbyFromFeatures("transit", [24.0, 49.8], [f([24.0005, 49.8]), f([24.0006, 49.8001])]);
    expect(r).toHaveLength(1);
  });
});

import { matchDistrict } from "@/domain/location/district";
import { getCityOrDefault as gc } from "@/domain/location/registry";
describe("district detection", () => {
  const lviv = gc("lviv");
  it("matches administrative names from reverse geocoding", () => {
    expect(matchDistrict(lviv, [24.0236, 49.8437], ["Галицький район", "Середмістя"])).toEqual({ id: "halytskyi", method: "admin" });
    expect(matchDistrict(lviv, [24.05, 49.8], ["Шувар", "Козельники", "Сихівський район"])?.id).toBe("sykhivskyi");
  });
  it("falls back to the nearest district centre, refuses far points", () => {
    expect(matchDistrict(lviv, lviv.districts[0].center, [])?.method).toBe("nearest");
    expect(matchDistrict(lviv, [25.5, 49.0], [])).toBeNull();
  });
});
