import type { Property } from "../property/types";
import type { SectionId } from "../inspection";
import type { Msg } from "./types";

export interface WatchItem extends Msg {
  section: SectionId;
}

/**
 * Pre-inspection hints derived from public attributes (INFERENCE, not findings).
 * They tell the buyer what to look at — they do not claim a defect exists.
 */
export function watchlist(p: Property): WatchItem[] {
  const out: WatchItem[] = [];
  const year = p.yearBuilt;
  if ((year && year < 1995) || p.buildingType === "historic" || p.buildingType === "soviet_brick" || p.buildingType === "panel") {
    out.push({ code: "watch.wiring", section: "electrical" });
    out.push({ code: "watch.pipes", section: "plumbing" });
  }
  if (p.buildingType === "historic" || (year && year < 1945)) out.push({ code: "watch.historic", section: "structure" });
  if (p.buildingType === "panel") out.push({ code: "watch.panel", section: "moisture" });
  if (p.floor !== undefined && p.floor <= 1) out.push({ code: "watch.first-floor", section: "moisture" });
  if (p.floor !== undefined && p.floorsTotal && p.floor === p.floorsTotal && p.floorsTotal >= 3) out.push({ code: "watch.top-floor", section: "moisture" });
  if (p.market === "primary" || p.buildingType === "modern") out.push({ code: "watch.new-build", section: "renovation" });
  if (p.condition === "euro" || p.condition === "new") out.push({ code: "watch.cosmetic-hides", section: "renovation" });
  if (p.condition === "shell" || p.condition === "needs_renovation") out.push({ code: "watch.systems-unknown", section: "electrical" });
  return out;
}
