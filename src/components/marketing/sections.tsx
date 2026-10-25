"use client";

import Link from "next/link";
import { useState } from "react";
import { Collapse, CountUp, Reveal, motion } from "../motion";
import { useCity, useI18n } from "../providers";
import { ProvenanceBadge } from "../ui/provenance";
import { Card, LinkButton, Pill, SectionTitle } from "../ui/primitives";
import { GRID_PACKAGES } from "@/config/packages";
import { citiesByRegion, listCities } from "@/domain/location/registry";
import { cn } from "@/lib/cn";

const wrap = "mx-auto max-w-7xl px-4 sm:px-6";

/** Age of a "YYYY-MM" figure in months, relative to when this module loaded. */
const NOW = new Date();
const monthsSince = (asOf: string) => {
  const [y, m] = asOf.split("-").map(Number);
  return (NOW.getFullYear() - y) * 12 + (NOW.getMonth() + 1 - m);
};

export function KnowMore() {
  const { dict } = useI18n();
  return (
    <section className={`${wrap} py-24`}>
      <Reveal>
        <h2 className="display max-w-4xl text-[clamp(1.9rem,4.4vw,3.4rem)]">{dict.home.knowMoreTitle}</h2>
      </Reveal>
      <Reveal delay={0.12}>
        <p className="mt-6 max-w-2xl text-lg text-ink2">{dict.home.knowMoreBody}</p>
      </Reveal>
    </section>
  );
}

export function Dossier() {
  const { dict } = useI18n();
  return (
    <section className={`${wrap} py-24`}>
      <SectionTitle title={dict.home.dossierTitle} lead={dict.home.dossierSub} />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {dict.home.modules.map((m, i) => (
          <motion.div
            key={m.t}
            className="group bg-surface p-6 transition-colors hover:bg-surface2"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-6% 0px" }}
            transition={{ duration: 0.5, delay: (i % 4) * 0.07 }}
          >
            <p className="num text-xs text-brand">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-3 text-lg font-semibold">{m.t}</h3>
            <p className="mt-1.5 text-sm text-ink2">{m.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Honesty() {
  const { dict } = useI18n();
  return (
    <section className="bg-ink py-24 text-bg">
      <div className={wrap}>
        <div className="max-w-3xl">
          <Reveal>
            <h2 className="display text-4xl">{dict.home.honestyTitle}</h2>
            <p className="mt-4 text-bg/70">{dict.home.honestyBody}</p>
          </Reveal>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {dict.home.honesty.map((h, i) => (
            <Reveal key={h.k} delay={i * 0.1}>
              <div className="h-full rounded-2xl border border-bg/15 bg-bg/5 p-6">
                <div className="[&_*]:!border-bg/50 [&_*]:!text-bg">
                  <ProvenanceBadge kind={h.k as "FACT" | "INFERENCE" | "ESTIMATE"} />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{h.t}</h3>
                <p className="mt-2 text-sm text-bg/70">{h.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CityPanel() {
  const { dict, lang, f, money, href } = useI18n();
  const { cityId, setCityId } = useCity();
  const groups = citiesByRegion();
  const city = listCities().find((c) => c.id === cityId) ?? listCities()[0];
  const d = dict.home;
  const bench = city.valuation.benchmark;
  return (
    <section className={`${wrap} py-24`}>
      <SectionTitle title={d.cityTitle} lead={d.cityBody} />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.regionId}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink2">{g.cities[0].regionNames[lang]}</p>
              <div className="flex flex-wrap gap-2">
                {g.cities.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCityId(c.id)}
                    aria-pressed={c.id === cityId}
                    className={cn(
                      "relative rounded-full border px-4 py-2 text-sm transition-colors",
                      c.id === cityId ? "border-brand text-brandink" : "border-line bg-surface hover:border-ink2",
                    )}
                  >
                    {c.id === cityId && <motion.span layoutId="city-pill" className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                    <span className="relative">
                      {c.names[lang]}
                      {c.marketKind === "resort" && <span className="ml-1.5 opacity-70">· {dict.nav.resort}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Card key={city.id} className="relative overflow-hidden">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="display text-3xl">{city.names[lang]}</h3>
              <Pill tone={city.status === "live" ? "good" : "info"}>{city.status === "live" ? d.cityLive : d.cityBeta}</Pill>
              {city.marketKind === "resort" && <Pill tone="warn">{d.cityResort}</Pill>}
            </div>
            <dl className="mt-6 grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink2">{d.cityBench}</dt>
                <dd className="mt-1">
                  {bench ? (
                    <>
                      <CountUp value={bench.value} format={(n) => money(n, city.currency)} className="num text-2xl font-semibold" />
                      <span className="ml-1 text-xs text-ink2">/ {dict.common.sqm}</span>
                    </>
                  ) : (
                    <span className="text-sm text-ink2">{d.cityNoBench}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink2">{d.cityDistricts}</dt>
                <dd className="num mt-1 text-2xl font-semibold">{city.districts.length || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink2">{d.cityInspection}</dt>
                <dd className="mt-1 text-sm font-medium">
                  {city.inspection.available ? f(d.cityInspectionYes, { days: city.inspection.leadTimeDays ?? "—" }) : d.cityInspectionNo}
                </dd>
              </div>
            </dl>
            {bench && monthsSince(bench.asOf) > 6 && (
              <p className="mt-5 inline-flex rounded-full bg-warnbg px-2.5 py-1 text-xs font-medium text-warn">{d.cityStale}</p>
            )}
            {bench && (
              <p className="mt-3 text-xs text-ink2">
                {d.cityBenchNote}
              </p>
            )}
            {city.districts.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {city.districts.map((x) => (
                  <span key={x.id} className="rounded-full border border-line bg-surface2 px-3 py-1 text-sm">
                    {x.names[lang]}
                  </span>
                ))}
              </div>
            )}
            <LinkButton href={href("/check")} className="mt-7">
              {dict.nav.check}
            </LinkButton>
          </motion.div>
        </Card>
      </div>
    </section>
  );
}

export function PackagesTeaser() {
  const { dict, href, money } = useI18n();
  return (
    <section className="border-y border-line/70 bg-surface2/40 py-24">
      <div className={wrap}>
        <SectionTitle title={dict.home.pkgTitle} lead={dict.home.pkgSub} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {GRID_PACKAGES.map((p, i) => {
            const t = dict.services.packages[p.id];
            return (
              <Reveal key={p.id} delay={i * 0.06}>
                <Link href={href("/services")} className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-card">
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-1 text-sm text-ink2">{t.for}</p>
                  <p className="num mt-auto pt-6 text-sm text-ink2">
                    {p.priceUah ? `${dict.services.from} ${money(p.priceUah, "UAH")}` : dict.services.contact}
                  </p>
                </Link>
              </Reveal>
            );
          })}
        </div>
        <LinkButton href={href("/services")} variant="secondary" className="mt-8">
          {dict.home.pkgCta}
        </LinkButton>
      </div>
    </section>
  );
}

export function Faq() {
  const { dict } = useI18n();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className={`${wrap} py-24`}>
      <SectionTitle title={dict.home.faqTitle} />
      <div className="max-w-3xl divide-y divide-line border-y border-line">
        {dict.home.faq.map((x, i) => (
          <div key={x.q}>
            <button
              type="button"
              aria-expanded={open === i}
              aria-controls={`faq-${i}`}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-medium"
            >
              {x.q}
              <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="text-2xl leading-none text-brand" aria-hidden>
                +
              </motion.span>
            </button>
            <Collapse open={open === i} id={`faq-${i}`}>
              <p className="pb-5 text-ink2">{x.a}</p>
            </Collapse>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  const { dict, href } = useI18n();
  return (
    <section className={`${wrap} pb-8`}>
      <Reveal>
        <div className="rounded-3xl bg-brand px-6 py-14 text-center text-brandink sm:px-12">
          <h2 className="display text-4xl sm:text-5xl">{dict.home.finalTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-brandink/80">{dict.home.finalBody}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={href("/check")} className="rounded-full bg-brandink px-6 py-3 font-semibold text-brand transition-transform hover:scale-[1.03]">
              {dict.home.cta1Button}
            </Link>
            <Link href={href("/brief")} className="rounded-full border border-brandink/40 px-6 py-3 font-semibold transition-colors hover:bg-brandink/10">
              {dict.home.cta2Button}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
