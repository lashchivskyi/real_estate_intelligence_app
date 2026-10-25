import { describe, expect, it } from "vitest";
import { pricePosition } from "@/domain/valuation/price-position";
import { glossary } from "@/i18n/glossary";
import { inspectionVisuals } from "@/data/inspection-visuals";
import { SAMPLE_ISSUES } from "@/data/samples";

describe("market comparison shown to a buyer", () => {
  it("calculates the premium relative to the upper edge, rather than the asking price", () => {
    expect(pricePosition(110_000, 80_000, 100_000)).toEqual({ position: "above", difference: 10_000, percent: 10 });
  });
  it("calculates a discount relative to the lower edge", () => {
    expect(pricePosition(72_000, 80_000, 100_000)).toEqual({ position: "below", difference: 8_000, percent: 10 });
  });
  it.each([80_000, 90_000, 100_000])("does not claim a premium for an in-range price of %s", (ask) => {
    expect(pricePosition(ask, 80_000, 100_000)).toEqual({ position: "within", difference: 0, percent: 0 });
  });
  it("handles a collapsed range without dividing by zero", () => {
    expect(pricePosition(0, 0, 0)).toEqual({ position: "within", difference: 0, percent: 0 });
    expect(Number.isFinite(pricePosition(1, 0, 0).percent)).toBe(true);
  });
});

describe("buyer explanations", () => {
  it("provides the same nonempty glossary in both languages", () => {
    expect(Object.keys(glossary.uk).sort()).toEqual(Object.keys(glossary.en).sort());
    for (const terms of Object.values(glossary)) for (const text of Object.values(terms)) expect(text.trim().length).toBeGreaterThan(20);
  });
  it("has contextual finding and remedy text for every sample inspection item", () => {
    for (const issue of SAMPLE_ISSUES) for (const lang of ["uk", "en"] as const) {
      expect(inspectionVisuals[lang][issue.sectionId].focus.length).toBeGreaterThan(20);
      expect(inspectionVisuals[lang][issue.sectionId].solution.length).toBeGreaterThan(20);
    }
  });
});
