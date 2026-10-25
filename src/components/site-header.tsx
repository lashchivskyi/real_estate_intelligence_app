"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AnimatePresence } from "motion/react";
import { motion } from "./motion";
import { DISPLAY_CURRENCIES, useCity, useI18n, type DisplayCurrency } from "./providers";
import { citiesByRegion, listCities, nearestCity } from "@/domain/location/registry";
import { track } from "@/lib/analytics";
import { setLangCookie } from "@/lib/cookie";
import { cn } from "@/lib/cn";
import { AccountLink } from "./account-link";
import { Wordmark } from "./brand/mark";
import type { Lang } from "@/domain/location/types";

export function Logo() {
  return <Wordmark />;
}

function LangSwitch() {
  const { lang, dict } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const go = (to: Lang) => {
    if (to === lang) return;
    track("language_changed", { to });
    setLangCookie(to);
    const rest = pathname.replace(/^\/(uk|en)(?=\/|$)/, "");
    router.push(`/${to}${rest}${window.location.search}`);
  };
  return (
    <div role="group" aria-label={dict.nav.language} className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
      {(["uk", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => go(l)}
          aria-pressed={l === lang}
          className={cn("rounded-full px-2.5 py-1 uppercase transition-colors", l === lang ? "bg-ink text-bg" : "text-ink2 hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const CUR_SIGN: Record<DisplayCurrency, string> = { UAH: "₴", EUR: "€", USD: "$" };

function CurrencySwitch() {
  const { dict, currency, setCurrency } = useI18n();
  return (
    <div role="group" aria-label={dict.nav.currency} className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
      {DISPLAY_CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-pressed={c === currency}
          onClick={() => {
            setCurrency(c);
            track("currency_changed", { to: c });
          }}
          className={cn("rounded-full px-2 py-1 transition-colors", c === currency ? "bg-ink text-bg" : "text-ink2 hover:text-ink")}
        >
          {CUR_SIGN[c]}
          <span className="sr-only"> {c}</span>
        </button>
      ))}
    </div>
  );
}

export function CityPicker({ compact }: { compact?: boolean }) {
  const { lang, dict, f } = useI18n();
  const { cityId, setCityId } = useCity();
  const selectId = useId();
  const [state, setState] = useState<"idle" | "detecting" | "failed" | "none">("idle");
  const [suggest, setSuggest] = useState<string | null>(null);

  const detect = () => {
    if (!navigator.geolocation) return setState("failed");
    setState("detecting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const hit = nearestCity([pos.coords.longitude, pos.coords.latitude]);
        if (!hit) return setState("none");
        track("city_detected", { city: hit.city.id });
        setState("idle");
        if (hit.city.id !== cityId) setSuggest(hit.city.id);
      },
      () => setState("failed"),
      { timeout: 8000, maximumAge: 600000 },
    );
  };
  const suggested = listCities().find((c) => c.id === suggest);

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <label className="sr-only" htmlFor={selectId}>
          {dict.nav.city}
        </label>
        <select
          id={selectId}
          value={cityId}
          onChange={(e) => {
            setCityId(e.target.value);
            track("city_changed", { city: e.target.value });
          }}
          className="h-8 w-32 min-w-0 truncate rounded-full border border-line bg-surface py-1 pl-3 pr-6 text-sm sm:w-36"
        >
          {citiesByRegion().map((g) => (
            <optgroup key={g.regionId} label={g.cities[0].regionNames[lang]}>
              {g.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id === "bukovel" ? (lang === "uk" ? "Буковель" : "Bukovel") : c.names[lang]}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={detect}
          title={dict.nav.detectCity}
          aria-label={dict.nav.detectCity}
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink2 hover:text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>
      <div aria-live="polite">
        <AnimatePresence>
          {(suggested || state !== "idle") && !compact && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute right-0 top-11 z-50 w-72 rounded-xl border border-line bg-surface p-3 text-sm shadow-card"
            >
              {state === "detecting" && dict.nav.detecting}
              {state === "failed" && dict.nav.detectFailed}
              {state === "none" && dict.nav.detectNone}
              {suggested && (
                <div>
                  <p>{f(dict.nav.detected, { city: suggested.names[lang] })}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brandink"
                      onClick={() => {
                        setCityId(suggested.id);
                        setSuggest(null);
                      }}
                    >
                      {dict.nav.apply}
                    </button>
                    <button type="button" className="rounded-full px-3 py-1 text-xs text-ink2 hover:bg-surface2" onClick={() => setSuggest(null)}>
                      {dict.nav.dismiss}
                    </button>
                  </div>
                </div>
              )}
              {(state === "failed" || state === "none") && (
                <button type="button" className="mt-2 text-xs text-ink2 underline" onClick={() => setState("idle")}>
                  {dict.common.close}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const { dict, href } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/check", label: dict.nav.check },
    { to: "/brief", label: dict.nav.brief },
    { to: "/compare", label: dict.nav.compare },
    { to: "/inspection", label: dict.nav.inspection },
    { to: "/services", label: dict.nav.services },
  ];
  const active = (to: string) => pathname === href(to) || pathname.startsWith(`${href(to)}/`);

  return (
    <header role="banner" className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {dict.nav.skip}
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={href("/")} aria-label="Vidomo">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.to}
              href={href(l.to)}
              aria-current={active(l.to) ? "page" : undefined}
              className={cn("rounded-full px-3 py-1.5 text-sm transition-colors", active(l.to) ? "bg-surface2 text-ink" : "text-ink2 hover:text-ink")}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:block">
            <CityPicker />
          </div>
          <CurrencySwitch />
          <LangSwitch />
          <AccountLink />
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-line lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={dict.nav.menu}
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-bg lg:hidden"
            aria-label="Mobile"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              <div className="mb-2 sm:hidden">
                <CityPicker compact />
              </div>
              {links.map((l) => (
                <Link key={l.to} href={href(l.to)} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 hover:bg-surface2">
                  {l.label}
                </Link>
              ))}
              <Link href={href("/report/sample")} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-brand hover:bg-surface2">
                {dict.nav.sample}
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
