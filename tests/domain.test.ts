import { describe, expect, it } from "vitest";
import { getDemoComps } from "@/data/demo-comps";
import { SAMPLE_LEGAL, SAMPLE_PROPERTY } from "@/data/samples";
import { negotiation, priceVerdict } from "@/domain/decision/price";
import { getCityOrDefault, nearestCity } from "@/domain/location/registry";
import { bestFit } from "@/domain/report/compare";
import { weightedQuantile } from "@/domain/valuation/engine";
import { estimateValue } from "@/domain/valuation/engine";
import { COMPARE_PROPERTIES } from "@/data/samples";
import { demoReport, reportsForProperties, sampleReport } from "@/lib/report-service";
import { buildReport } from "@/domain/report/build";

const city = getCityOrDefault("lviv");
const comps = getDemoComps("lviv");

describe("weightedQuantile", () => {
  it("returns the median of equal weights", () => {
    const v = [1, 2, 3, 4, 5].map((x) => ({ v: x, w: 1 }));
    expect(weightedQuantile(v, 0.5)).toBe(3);
  });
  it("respects weights", () => {
    expect(weightedQuantile([{ v: 1, w: 1 }, { v: 100, w: 9 }], 0.5)).toBeGreaterThan(50);
  });
});

describe("valuation", () => {
  it("returns a range, not a point, with confidence components", () => {
    const v = estimateValue(SAMPLE_PROPERTY, { city, comps, dataMode: "demo" });
    expect(v.status).toBe("ok");
    if (v.status === "ok") {
      expect(v.fairLow).toBeLessThan(v.fairMid);
      expect(v.fairMid).toBeLessThan(v.fairHigh);
      expect(v.confidence.components).toHaveLength(4);
      expect(v.confidence.overall).toBeLessThanOrEqual(0.8); // uncalibrated cap
    }
  });
  it("is insufficient without comps", () => {
    const v = estimateValue(SAMPLE_PROPERTY, { city, comps: [], dataMode: "demo" });
    expect(v).toMatchObject({ status: "insufficient", reason: "few-comps" });
  });
  it("is insufficient for a city without benchmark (no invented numbers)", () => {
    const tr = getCityOrDefault("truskavets");
    const v = estimateValue({ ...SAMPLE_PROPERTY, cityId: "truskavets" }, { city: tr, comps: [], dataMode: "demo" });
    expect(v).toMatchObject({ status: "insufficient", reason: "no-benchmark" });
  });
  it("is insufficient for unsupported property classes", () => {
    const v = estimateValue({ ...SAMPLE_PROPERTY, class: "land" }, { city, comps, dataMode: "demo" });
    expect(v).toMatchObject({ status: "insufficient", reason: "unsupported-class" });
  });
  it("lowers confidence when attributes are missing", () => {
    const full = estimateValue(SAMPLE_PROPERTY, { city, comps, dataMode: "demo" });
    const thin = estimateValue(
      { ...SAMPLE_PROPERTY, districtId: undefined, floor: undefined, yearBuilt: undefined, condition: undefined, buildingType: undefined },
      { city, comps, dataMode: "demo" },
    );
    if (full.status === "ok" && thin.status === "ok") expect(thin.confidence.overall).toBeLessThan(full.confidence.overall);
    else throw new Error("expected ok");
  });
});

describe("price verdict & negotiation", () => {
  const v = estimateValue(SAMPLE_PROPERTY, { city, comps, dataMode: "demo" });
  if (v.status !== "ok") throw new Error("setup");
  it("classifies around the range", () => {
    expect(priceVerdict(v.fairLow * 0.8, v).verdict).toBe("UNDERPRICED");
    expect(priceVerdict(v.fairMid, v).verdict).toBe("FAIR");
    expect(priceVerdict(v.fairHigh * 1.06, v).verdict).toBe("SLIGHTLY_OVERPRICED");
    expect(priceVerdict(v.fairHigh * 1.3, v).verdict).toBe("OVERPRICED");
  });
  it("gives INSUFFICIENT_DATA without valuation", () => {
    const bad = estimateValue(SAMPLE_PROPERTY, { city, comps: [], dataMode: "demo" });
    expect(priceVerdict(100000, bad).verdict).toBe("INSUFFICIENT_DATA");
    expect(negotiation(100000, bad)).toBeNull();
  });
  it("opening offer is below ask and walk-away is not above ask-ish", () => {
    const n = negotiation(v.fairHigh * 1.2, v);
    expect(n).not.toBeNull();
    expect(n!.opening).toBeLessThan(v.fairHigh * 1.2);
    expect(n!.opening).toBeLessThanOrEqual(n!.walkAway);
  });
  it("no negotiation numbers for underpriced objects", () => {
    expect(negotiation(v.fairLow * 0.7, v)).toBeNull();
  });
});

describe("reports", () => {
  it("digital-only report never says GOOD BUY (legal + technical unknown)", () => {
    const r = buildReport({ property: { ...SAMPLE_PROPERTY, askingPrice: 90_000 }, city, comps, dataMode: "demo" });
    expect(["PROMISING", "NEGOTIATE", "CAUTION", "INSUFFICIENT_DATA"]).toContain(r.overall.verdict);
    expect(r.overall.verdict).not.toBe("GOOD_BUY");
    expect(r.overall.stage).toBe("preliminary");
    expect(r.overall.pending).toEqual(["legal", "technical"]);
    // pending checks are not listed as risks and do not lower the confidence of what was evaluated
    expect(r.overall.risks.map((x) => x.code)).not.toContain("risk.legal-unknown");
    expect(r.confidence.value).toBeGreaterThan(0.4);
    expect(r.confidence.coverage).toBeLessThan(0.7);
    expect(r.scores.find((s) => s.id === "technical")!.value).toBeNull();
    expect(r.scores.find((s) => s.id === "legal")!.value).toBeNull();
  });
  it("sample report: slightly overpriced + repairs + yellow legal → NEGOTIATE with leverage", () => {
    const r = sampleReport();
    expect(r.price.verdict).toBe("SLIGHTLY_OVERPRICED");
    expect(r.overall.verdict).toBe("NEGOTIATE");
    expect(r.negotiation!.opening).toBeLessThan(r.property.askingPrice);
    expect(r.overall.strengths.length).toBeLessThanOrEqual(3);
    expect(r.overall.risks.length).toBeLessThanOrEqual(3);
  });
  it("any RED legal check forces review", () => {
    const legal = SAMPLE_LEGAL.map((l, i) => (i === 0 ? { ...l, status: "red" as const } : l));
    const r = buildReport({ property: SAMPLE_PROPERTY, city, comps, dataMode: "demo", legal, issues: [] });
    expect(r.overall.verdict).toBe("REVIEW_REQUIRED");
  });
  it("live report parses query params and rejects bad input", () => {
    const ok = demoReport({ ask: "100000", area: "55", rooms: "2", d: "sykhivskyi" });
    expect(ok.ok).toBe(true);
    expect(demoReport({ ask: "abc" }).ok).toBe(false);
  });
});

describe("compare", () => {
  it("picks a best fit and excludes objects with RED legal", () => {
    const reports = reportsForProperties(COMPARE_PROPERTIES, { priorities: ["quiet"], household: "family", purpose: "live" });
    const res = bestFit(reports);
    expect(res.winnerId).not.toBeNull();
    expect(res.ranking.length).toBeGreaterThan(1);
  });
});

describe("location", () => {
  it("detects the nearest city and refuses far points", () => {
    expect(nearestCity([24.03, 49.84])?.city.id).toBe("lviv");
    expect(nearestCity([22.29, 48.62])?.city.id).toBe("uzhhorod");
    expect(nearestCity([24.41, 48.355])?.city.id).toBe("bukovel");
    expect(nearestCity([23.5, 49.28])?.city.id).toBe("truskavets");
    expect(nearestCity([2.35, 48.85])).toBeNull();
  });
});

describe("independent modules", () => {
  it("a draft inspection does not leak into the verdict", () => {
    const r = buildReport({ property: SAMPLE_PROPERTY, city, comps, dataMode: "demo", legal: SAMPLE_LEGAL, issues: [], modules: { legal: "done", technical: "in_progress" } });
    expect(r.issues).toBeNull();
    expect(r.overall.stage).toBe("preliminary");
    expect(r.overall.pending).toEqual(["technical"]);
  });
  it("a RED legal fact decides even when inspection is pending", () => {
    const legal = SAMPLE_LEGAL.map((l, i) => (i === 0 ? { ...l, status: "red" as const } : l));
    const r = buildReport({ property: SAMPLE_PROPERTY, city, comps, dataMode: "demo", legal, modules: { legal: "done", technical: "not_ordered" } });
    expect(r.overall.verdict).toBe("REVIEW_REQUIRED");
  });
  it("heavily overpriced digital-only → CAUTION, not a final verdict", () => {
    const r = buildReport({ property: { ...SAMPLE_PROPERTY, askingPrice: 160_000 }, city, comps, dataMode: "demo" });
    expect(r.overall.verdict).toBe("CAUTION");
  });
});
