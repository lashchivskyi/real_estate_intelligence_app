import type { BriefDraft } from "./index";
import { PRIORITY_INDICATOR } from "./index";
import type { CityAdapter, District, DistrictProfile } from "../location/types";

export interface DistrictMatch {
  district: District;
  /** 0..100; null when no profile is available offline (live OSM data is used in reports). */
  fit: number | null;
  /** Approx. m² the budget buys at the (uncalibrated) city benchmark × district multiplier; null if unknown. */
  affordableSqm: number | null;
  tight: boolean;
}

const BOOST: Record<string, Array<keyof DistrictProfile>> = {
  family: ["schools", "parks", "quiet"],
  retired: ["quiet", "shops", "parks"],
  single: ["transit", "business", "shops"],
  couple: ["transit", "shops", "parks"],
};

/** Ranks districts for a brief. Pure and explainable: priorities (and household / investing defaults) → weighted indicators. */
export function districtMatches(brief: BriefDraft, city: CityAdapter): DistrictMatch[] {
  const keys = new Map<keyof DistrictProfile, number>();
  (brief.priorities ?? []).forEach((p) => keys.set(PRIORITY_INDICATOR[p], 1.4));
  if (brief.household) BOOST[brief.household]?.forEach((k) => keys.set(k, Math.max(keys.get(k) ?? 0, 1)));
  if (brief.purpose === "invest") ["transit", "business", "shops"].forEach((k) => keys.set(k as keyof DistrictProfile, Math.max(keys.get(k as keyof DistrictProfile) ?? 0, 1.2)));
  if (keys.size === 0) (["transit", "schools", "parks", "quiet", "shops"] as const).forEach((k) => keys.set(k, 1));

  const bench = city.valuation.benchmark?.value;
  return city.districts
    .map((district) => {
      let w = 0;
      let v = 0;
      const profile = district.profile;
      keys.forEach((weight, k) => {
        if (!profile) return;
        w += weight;
        v += weight * profile[k];
      });
      const affordableSqm = bench && brief.budgetMax ? Math.round(brief.budgetMax / (bench * (district.priceMultiplier ?? 1))) : null;
      const needed = brief.areaMin ?? 30;
      return { district, fit: w ? Math.round(v / w) : null, affordableSqm, tight: affordableSqm !== null && affordableSqm < needed };
    })
    .sort((a, b) => Number(a.tight) - Number(b.tight) || (b.fit ?? -1) - (a.fit ?? -1));
}
