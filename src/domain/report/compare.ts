import { PRIORITY_INDICATOR } from "../brief";
import { SCORE_WEIGHTS } from "../decision/scores";
import type { SubscoreId } from "../decision/types";
import type { ReportData } from "./build";

export interface FitResult {
  id: string;
  /** 0..100 fit for the brief, or null if nothing could be evaluated. */
  fit: number | null;
  /** Share of weighted evidence available (0..1). Penalizes unknown modules instead of ignoring them. */
  coverage: number;
  excluded: "legal-red" | "no-valuation" | null;
  drivers: Array<{ id: SubscoreId; weight: number; value: number | null }>;
}

/** Weights shift with the brief's purpose; unknown subscores lower coverage rather than being treated as average. */
export function fitWeights(purpose?: "live" | "invest" | "both"): Record<SubscoreId, number> {
  const w = { ...SCORE_WEIGHTS };
  if (purpose === "invest") {
    w.investment = 0.28;
    w.liquidity = 0.17;
    w.lifestyle = 0.0;
    w.location = 0.08;
    w.value = 0.25;
  } else if (purpose === "live") {
    w.lifestyle = 0.15;
    w.location = 0.15;
    w.investment = 0.03;
    w.liquidity = 0.07;
  }
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  (Object.keys(w) as SubscoreId[]).forEach((k) => (w[k] /= sum));
  return w;
}

export function fitForBrief(r: ReportData): FitResult {
  const w = fitWeights(r.brief?.purpose);
  let acc = 0;
  let known = 0;
  const drivers: FitResult["drivers"] = [];
  for (const s of r.scores) {
    drivers.push({ id: s.id, weight: w[s.id], value: s.value });
    if (s.value !== null && w[s.id] > 0) {
      acc += w[s.id] * s.value;
      known += w[s.id];
    }
  }
  const excluded = r.legal.some((l) => l.status === "red") ? "legal-red" : r.valuation.status !== "ok" ? "no-valuation" : null;
  return {
    id: r.property.id,
    fit: known > 0 ? Math.round(acc / known) : null,
    coverage: known,
    excluded,
    drivers,
  };
}

export interface BestFit {
  winnerId: string | null;
  /** Ranking (best first) among non-excluded objects. */
  ranking: Array<{ id: string; fit: number; coverage: number }>;
  reason: "ok" | "tie" | "not-enough-data";
  /** Subscores where the winner leads the runner-up the most. */
  leads: SubscoreId[];
  fits: FitResult[];
}

export function bestFit(reports: ReportData[]): BestFit {
  const fits = reports.map(fitForBrief);
  const ranked = fits
    .filter((f) => f.fit !== null && !f.excluded)
    .map((f) => ({ id: f.id, fit: f.fit as number, coverage: f.coverage }))
    // Prefer higher fit; a small bonus for evidence coverage so thin evidence doesn't win on a lucky number.
    .sort((a, b) => b.fit + b.coverage * 6 - (a.fit + a.coverage * 6));
  if (ranked.length === 0) return { winnerId: null, ranking: [], reason: "not-enough-data", leads: [], fits };
  const tie = ranked.length > 1 && Math.abs(ranked[0].fit - ranked[1].fit) < 3;
  const win = reports.find((r) => r.property.id === ranked[0].id);
  const run = ranked[1] && reports.find((r) => r.property.id === ranked[1].id);
  const leads: SubscoreId[] = [];
  if (win && run) {
    const diffs = win.scores
      .map((s, i) => ({ id: s.id, d: (s.value ?? 0) - (run.scores[i].value ?? 0), ok: s.value !== null && run.scores[i].value !== null }))
      .filter((x) => x.ok && x.d > 4)
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    diffs.forEach((x) => leads.push(x.id));
  }
  return { winnerId: ranked[0].id, ranking: ranked, reason: tie ? "tie" : "ok", leads, fits };
}

// Re-exported for UI use.
export { PRIORITY_INDICATOR };
