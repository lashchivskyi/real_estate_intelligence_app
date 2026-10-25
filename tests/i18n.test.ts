import { describe, expect, it } from "vitest";
import { uk } from "@/i18n/uk";
import { en } from "@/i18n/en";
import { msgText } from "@/i18n";
import { sampleReport } from "@/lib/report-service";

function keys(o: unknown, prefix = ""): string[] {
  if (Array.isArray(o)) return [`${prefix}[${o.length}]`, ...o.flatMap((x, i) => keys(x, `${prefix}[${i}]`))];
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

describe("i18n", () => {
  it("uk and en have identical key structure (incl. array lengths)", () => {
    expect(keys(en).sort()).toEqual(keys(uk).sort());
  });
  it("no empty strings", () => {
    const empties = (o: unknown, p = ""): string[] =>
      typeof o === "string" ? (o.trim() === "" && !p.endsWith(".hh.") && !p.endsWith('hh.""') ? [p] : []) : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => empties(v, `${p}.${k}`)) : [];
    expect(empties(uk)).toEqual([]);
    expect(empties(en)).toEqual([]);
  });
  it("placeholders match between languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const walk = (a: unknown, b: unknown, p: string) => {
      if (typeof a === "string" && typeof b === "string") expect(ph(a), p).toBe(ph(b));
      else if (a && b && typeof a === "object") Object.keys(a).forEach((k) => walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${p}.${k}`));
    };
    walk(uk, en, "");
  });
  it("every message code emitted by the sample report is translated in both languages", () => {
    const r = sampleReport();
    const msgs = [
      r.price.reason,
      ...r.overall.reasons,
      ...r.overall.strengths,
      ...r.overall.risks,
      ...r.overall.nextActions,
      ...r.watchlist,
      ...r.scores.flatMap((s) => s.drivers),
      ...(r.negotiation?.basis ?? []),
    ];
    for (const m of msgs) {
      expect((uk.msg as Record<string, string>)[m.code], `uk ${m.code}`).toBeTruthy();
      expect((en.msg as Record<string, string>)[m.code], `en ${m.code}`).toBeTruthy();
      expect(msgText(uk, "uk", m)).not.toMatch(/\{\w+\}/);
      expect(msgText(en, "en", m)).not.toMatch(/\{\w+\}/);
    }
  });
});

import { formatMoney, formatNumber } from "@/i18n";
describe("formatting", () => {
  it("is deterministic across runtimes", () => {
    expect(formatMoney(104000, "USD", "en")).toBe("$104,000");
    expect(formatMoney(104000, "USD", "uk")).toBe("104\u00a0000\u00a0$");
    expect(formatMoney(14310, "UAH", "uk")).toBe("14\u00a0310\u00a0₴");
    expect(formatNumber(3.5, "uk", 1)).toBe("3,5");
    expect(formatNumber(-1234.5, "en", 1)).toBe("−1,234.5");
  });
});
