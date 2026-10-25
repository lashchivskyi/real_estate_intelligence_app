import type { Lang } from "@/domain/location/types";
import type { Msg } from "@/domain/decision/types";
import { uk } from "./uk";

export type Dictionary = typeof uk;

export const LANGS: Lang[] = ["uk", "en"];
export const DEFAULT_LANG: Lang = "uk";
export const isLang = (v: string | undefined | null): v is Lang => v === "uk" || v === "en";

/** Lazy per-language import keeps the other language out of the server bundle for that request. */
export async function getDictionary(lang: Lang): Promise<Dictionary> {
  return lang === "en" ? (await import("./en")).en : uk;
}

export function fmt(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Translate a domain message ({code, params}). Falls back to the code so gaps are visible, never silent. */
export function msgText(dict: Dictionary, lang: Lang, m: Msg): string {
  const table = dict.msg as Record<string, string>;
  const tpl = table[m.code];
  if (!tpl) return m.code;
  const p: Record<string, string | number> = { ...(m.params ?? {}) };
  if (lang === "uk" && typeof p.titleUk === "string") p.title = p.titleUk;
  delete p.titleUk;
  const enums = dict.enums as unknown as Record<string, Record<string, string>>;
  if (typeof p.k === "string" && enums.indicator[p.k]) p.k = enums.indicator[p.k];
  if (typeof p.hh === "string" && p.hh in enums.hh) p.hh = enums.hh[p.hh];
  if (typeof p.dir === "string" && p.dir in enums.dir) p.dir = enums.dir[p.dir];
  return fmt(tpl, p);
}

export function missingText(dict: Dictionary, code: string): string {
  const table = dict.msg as Record<string, string>;
  return table[code.startsWith("attr.") ? code : `missing.${code}`] ?? code;
}

export const localeTag = (lang: Lang) => (lang === "uk" ? "uk-UA" : "en-GB");

/**
 * Deterministic number formatting. Intl output differs between Node's ICU and browsers
 * (U+00A0 vs U+202F, "грн" vs "₴"), which breaks hydration — so we format ourselves.
 */
const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", UAH: "₴", PLN: "zł" };

export function formatNumber(value: number, lang: Lang, digits = 0): string {
  const neg = value < 0;
  const fixed = Math.abs(value).toFixed(digits);
  const [int, frac] = fixed.split(".");
  const group = lang === "uk" ? " " : ",";
  const dec = lang === "uk" ? "," : ".";
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  const trimmed = frac ? frac.replace(/0+$/, "") : "";
  return `${neg ? "−" : ""}${grouped}${trimmed ? dec + trimmed : ""}`;
}

export function formatMoney(value: number, currency: string, lang: Lang): string {
  const n = formatNumber(Math.round(value), lang);
  const sym = SYMBOL[currency] ?? currency;
  if (currency === "UAH") return `${n} ${sym}`;
  return lang === "uk" ? `${n} ${sym}` : `${sym}${n}`;
}
