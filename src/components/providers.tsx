"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fmt, formatMoney, formatNumber, missingText, msgText, type Dictionary } from "@/i18n";
import type { Msg } from "@/domain/decision/types";
import type { Lang } from "@/domain/location/types";
import { DEFAULT_CITY_ID, getCityOrDefault } from "@/domain/location/registry";

export type DisplayCurrency = "UAH" | "EUR" | "USD";
export const DISPLAY_CURRENCIES: DisplayCurrency[] = ["UAH", "EUR", "USD"];
/** UAH per 1 unit of currency (NBU official). */
export type Rates = Partial<Record<"USD" | "EUR", number>>;

interface I18n {
  lang: Lang;
  dict: Dictionary;
  /** Translate a domain message. */
  m: (msg: Msg) => string;
  missing: (code: string) => string;
  f: typeof fmt;
  /** Format an amount given in `currency`, converted to the visitor's display currency (NBU rates). */
  money: (v: number, currency: string) => string;
  /** Format without conversion (e.g. the exact amount that will be charged). */
  moneyExact: (v: number, currency: string) => string;
  num: (v: number, digits?: number) => string;
  /** Prefix a path with the current locale. */
  href: (path: string) => string;
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  rates: Rates;
}

const I18nCtx = createContext<I18n | null>(null);
const CUR_KEY = "bi.currency";

const toUah = (v: number, from: string, rates: Rates): number | null =>
  from === "UAH" ? v : from === "USD" || from === "EUR" ? (rates[from] ? v * (rates[from] as number) : null) : null;

/** Converted figures are estimates: round so they don't look falsely precise. */
const roundConverted = (v: number) => (Math.abs(v) >= 10_000 ? Math.round(v / 100) * 100 : Math.abs(v) >= 1000 ? Math.round(v / 10) * 10 : Math.round(v));

export function I18nProvider({ lang, dict, rates = {}, children }: { lang: Lang; dict: Dictionary; rates?: Rates; children: ReactNode }) {
  // Always start with UAH (matches the server render), then apply the saved preference.
  const [currency, setCur] = useState<DisplayCurrency>("UAH");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUR_KEY) as DisplayCurrency | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate preference after mount to keep SSR markup stable
      if (saved && DISPLAY_CURRENCIES.includes(saved)) setCur(saved);
    } catch {
      /* storage blocked */
    }
  }, []);
  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCur(c);
    try {
      localStorage.setItem(CUR_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      dict,
      m: (msg) => msgText(dict, lang, msg),
      missing: (c) => missingText(dict, c),
      f: fmt,
      money: (v, c) => {
        if (c === currency) return formatMoney(v, c, lang);
        const uah = toUah(v, c, rates);
        if (uah === null) return formatMoney(v, c, lang);
        const target = currency === "UAH" ? uah : rates[currency] ? uah / (rates[currency] as number) : null;
        return target === null ? formatMoney(v, c, lang) : formatMoney(roundConverted(target), currency, lang);
      },
      moneyExact: (v, c) => formatMoney(v, c, lang),
      num: (v, d) => formatNumber(v, lang, d),
      href: (p) => `/${lang}${p === "/" ? "" : p}`,
      currency,
      setCurrency,
      rates,
    }),
    [lang, dict, currency, setCurrency, rates],
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(I18nCtx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}

/* ---- selected city (manual choice always wins; geolocation only suggests) ---- */
interface CityCtx {
  cityId: string;
  setCityId: (id: string) => void;
}
const CityCtxObj = createContext<CityCtx>({ cityId: DEFAULT_CITY_ID, setCityId: () => {} });
const KEY = "bi.city";

export function CityProvider({ children }: { children: ReactNode }) {
  const [cityId, setId] = useState(DEFAULT_CITY_ID);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount to keep SSR markup stable
      if (saved && getCityOrDefault(saved).id === saved) setId(saved);
    } catch {
      /* storage may be blocked */
    }
  }, []);
  const setCityId = useCallback((id: string) => {
    setId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(() => ({ cityId, setCityId }), [cityId, setCityId]);
  return <CityCtxObj.Provider value={value}>{children}</CityCtxObj.Provider>;
}
export const useCity = () => useContext(CityCtxObj);
