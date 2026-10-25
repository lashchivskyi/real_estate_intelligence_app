"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, useMotionValueEvent, useScroll } from "motion/react";
import { CountUp, Reveal, motion, EASE } from "../motion";
import { useI18n } from "../providers";
import { RangeBar } from "../ui/charts";
import { Pill, toneVar } from "../ui/primitives";
import { cn } from "@/lib/cn";
import { ExplainedTerm } from "../ui/tooltip";
import { pricePosition } from "@/domain/valuation/price-position";

/** Numbers come from the real sample report computation (page.tsx), not typed by hand. */
export interface StoryData {
  ask: number;
  areaSqm: number;
  rooms: number;
  floor: string;
  year: number;
  fairLow: number;
  fairHigh: number;
  fairMid: number;
  comps: number;
  confidencePct: number;
  issues: Array<{ sev: "red" | "yellow" | "green"; title: { uk: string; en: string }; low?: number; high?: number }>;
  repairsLow: number;
  repairsHigh: number;
  legal: Array<{ id: string; status: "green" | "yellow" | "red" | "unknown" }>;
  opening: number;
  walkAway: number;
  currency: string;
}

const STEPS = 5;

/**
 * "How a conclusion is made" — a scroll-driven story in five beats:
 * the listing → the market → the inspection → the registries → the decision.
 * Desktop: sticky stage, the dossier card morphs per beat. Mobile / reduced motion: stacked cards.
 */
export function DecisionStory({ data }: { data: StoryData }) {
  const { dict, href } = useI18n();
  const d = dict.home.story;
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(STEPS - 1, Math.max(0, Math.floor(v * STEPS * 0.999)))));

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + ((el.offsetHeight - window.innerHeight) * (i + 0.5)) / STEPS, behavior: "smooth" });
  };

  return (
    <section aria-labelledby="story-title" className="border-b border-line/70">
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.eyebrow}</p>
          <h2 id="story-title" className="display mt-2 max-w-3xl text-[clamp(2rem,4.2vw,3.2rem)]">
            {d.title}
          </h2>
          <p className="mt-3 max-w-2xl text-ink2">{d.lead}</p>
        </Reveal>
      </div>

      {/* desktop: sticky scrollytelling */}
      <div ref={ref} className="relative hidden lg:motion-safe:block" style={{ height: `${STEPS * 85}vh` }}>
        <div className="sticky top-16 mx-auto grid h-[calc(100vh-4rem)] max-w-7xl grid-cols-[0.85fr_1.15fr] items-center gap-12 px-6">
          <ol className="space-y-1">
            {d.steps.map((s, i) => (
              <li key={s.t}>
                <button type="button" onClick={() => jump(i)} aria-current={step === i ? "step" : undefined} className="group flex w-full gap-4 rounded-2xl p-4 text-left transition-colors hover:bg-surface2/60">
                  <span className="relative mt-1 h-10 w-1 shrink-0 overflow-hidden rounded-full bg-line">
                    <motion.span className="absolute inset-x-0 top-0 rounded-full bg-brand" animate={{ height: step > i ? "100%" : step === i ? "60%" : "0%" }} transition={{ duration: 0.5, ease: EASE }} />
                  </span>
                  <span>
                    <span className={cn("num block text-xs", step === i ? "text-brand" : "text-ink2")}>{String(i + 1).padStart(2, "0")}</span>
                    <span className={cn("block text-xl font-semibold transition-colors", step === i ? "text-ink" : "text-ink2")}>{s.t}</span>
                    <motion.span className="block overflow-hidden text-sm text-ink2" animate={{ height: step === i ? "auto" : 0, opacity: step === i ? 1 : 0 }} transition={{ duration: 0.35 }}>
                      {s.d}
                    </motion.span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.98 }} transition={{ duration: 0.45, ease: EASE }}>
                <StoryCard step={step} data={data} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* mobile: stacked */}
      <div className="mx-auto max-w-2xl space-y-10 px-4 py-12 lg:motion-safe:hidden">
        {d.steps.map((s, i) => (
          <Reveal key={s.t}>
            <p className="num text-xs text-brand">{String(i + 1).padStart(2, "0")}</p>
            <h3 className="text-xl font-semibold">{s.t}</h3>
            <p className="mb-4 mt-1 text-sm text-ink2">{s.d}</p>
            <StoryCard step={i} data={data} />
          </Reveal>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6">
        <Link href={href("/report/sample")} className="inline-flex items-center gap-2 font-semibold text-brand hover:underline">
          {d.cta} →
        </Link>
      </div>
    </section>
  );
}

function CardShell({ label, tone = "neutral", children }: { label: string; tone?: "neutral" | "info" | "bad" | "good" | "warn"; children: React.ReactNode }) {
  const { dict } = useI18n();
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink2">
          <span className="h-2 w-2 rounded-full" style={{ background: toneVar[tone] }} />
          {label}
        </span>
        <Pill tone="info">{dict.common.sample}</Pill>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function StoryCard({ step, data }: { step: number; data: StoryData }) {
  const { dict, lang, money, num, f } = useI18n();
  const d = dict.home.story;
  const cur = data.currency;
  const comparison = pricePosition(data.ask, data.fairLow, data.fairHigh);
  const marketTitle = comparison.position === "above"
    ? (lang === "uk" ? "Продавець просить більше за оцінку ринку" : "The asking price is above the market estimate")
    : comparison.position === "below"
      ? (lang === "uk" ? "Ціна продавця нижча за оцінку ринку" : "The asking price is below the market estimate")
      : (lang === "uk" ? "Ціна продавця в межах оцінки ринку" : "The asking price is within the market estimate");

  if (step === 0)
    return (
      <CardShell label={d.labels.listing}>
        <div className="grid gap-5 sm:grid-cols-[1fr_1.1fr]">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#d9d3c3,#efe9dc_45%,#cfc7b2)]">
            <div className="absolute bottom-0 left-[12%] h-[62%] w-[34%] rounded-t-md bg-[#bfb59d]" />
            <div className="absolute bottom-0 left-[50%] h-[78%] w-[38%] rounded-t-md bg-[#a99f86]" />
            {[0, 1, 2].map((r) => (
              <div key={r} className="absolute left-[56%] h-[9%] w-[8%] rounded-sm bg-[#e6eef0]" style={{ bottom: `${18 + r * 20}%` }} />
            ))}
            <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-medium text-[#0e1a16]">{d.listingBadge}</span>
          </div>
          <div>
            <p className="num text-4xl font-semibold">{money(data.ask, cur)}</p>
            <p className="num mt-2 text-sm text-ink2">
              {data.areaSqm} {dict.common.sqm} · {data.rooms} {lang === "uk" ? "кімн." : "rooms"} · {data.floor} · {data.year}
            </p>
            <blockquote className="mt-5 border-l-2 border-line pl-3 text-[15px] italic text-ink2">“{d.sellerQuote}”</blockquote>
            <p className="mt-5 text-sm">{d.listingNote}</p>
          </div>
        </div>
      </CardShell>
    );

  if (step === 1)
    return (
      <CardShell label={d.labels.market} tone="info">
        <h3 className="text-xl font-semibold leading-snug">{marketTitle}</h3>
        {comparison.position !== "within" && <p className="mt-2 text-sm text-ink2">
          <span className="num font-semibold text-ink">{money(comparison.difference, cur)} ({num(comparison.percent, 1)}%)</span>{" "}
          {comparison.position === "above" ? (lang === "uk" ? "понад верхню межу — аргумент для торгу." : "above the upper end — a reason to negotiate.") : (lang === "uk" ? "нижче нижньої межі — варто перевірити причину." : "below the lower end — check the reason.")}
        </p>}
        <div className="mt-5 rounded-2xl border border-line bg-bg p-4">
          <RangeBar low={data.fairLow} high={data.fairHigh} currency={cur} markers={[{ value: data.ask, label: d.ask, tone: comparison.position === "within" ? "info" : "warn" }]} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink2"><ExplainedTerm term="comps">{d.compsUsed}</ExplainedTerm></p>
            <CountUp value={data.comps} format={(n) => String(Math.round(n))} className="num text-2xl font-semibold" />
          </div>
          <div>
            <p className="text-xs text-ink2"><ExplainedTerm term="confidence">{d.confidence}</ExplainedTerm></p>
            <CountUp value={data.confidencePct} format={(n) => `${Math.round(n)}%`} className="num text-2xl font-semibold" />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink2">{lang === "uk" ? "Демонстраційний розрахунок за цінами оголошень. Остаточна ціна залежить від стану та перевірок об’єкта." : "Demonstration based on asking prices. The final price depends on condition and property checks."}</p>
      </CardShell>
    );

  if (step === 2)
    return (
      <CardShell label={d.labels.inspection} tone="bad">
        <ul className="space-y-2.5">
          {data.issues.map((x, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.12 }} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5" style={{ borderLeft: `4px solid ${toneVar[x.sev === "red" ? "bad" : x.sev === "yellow" ? "warn" : "good"]}` }}>
              <Pill tone={x.sev === "red" ? "bad" : x.sev === "yellow" ? "warn" : "good"}>{dict.enums.severity[x.sev]}</Pill>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.title[lang]}</span>
              {x.low !== undefined && <span className="num shrink-0 text-xs text-ink2">{money(x.low, cur)}–{money(x.high ?? x.low, cur)}</span>}
            </motion.li>
          ))}
        </ul>
        <div className="mt-5 flex items-end justify-between border-t border-line pt-4">
          <span className="text-sm text-ink2">{d.repairs}</span>
          <span className="num text-2xl font-semibold">
            <CountUp value={data.repairsLow} format={(n) => money(Math.round(n), cur)} /> – <CountUp value={data.repairsHigh} format={(n) => money(Math.round(n), cur)} />
          </span>
        </div>
      </CardShell>
    );

  if (step === 3)
    return (
      <CardShell label={d.labels.registries} tone="warn">
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.legal.map((l, i) => (
            <motion.li key={l.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.07 }} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: toneVar[l.status === "green" ? "good" : l.status === "yellow" ? "warn" : l.status === "red" ? "bad" : "neutral"] }} />
              {dict.report.legal.checks[l.id as keyof typeof dict.report.legal.checks]}
            </motion.li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ink2">{dict.report.legal.requiresReview}</p>
      </CardShell>
    );

  const saving = data.ask - data.opening;
  return (
    <CardShell label={d.labels.decision} tone="warn">
      <p className="display text-5xl text-warn">{dict.report.verdicts.NEGOTIATE}</p>
      <div className="mt-6 grid grid-cols-2 gap-5">
        <div>
          <p className="text-xs text-ink2">{dict.report.nego.opening}</p>
          <p className="num text-3xl font-semibold text-good">{money(data.opening, cur)}</p>
        </div>
        <div>
          <p className="text-xs text-ink2">{dict.report.nego.walkAway}</p>
          <p className="num text-3xl font-semibold">{money(data.walkAway, cur)}</p>
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-goodbg px-4 py-3">
        <p className="text-sm">{f(d.savingLabel, {})}</p>
        <CountUp value={saving} format={(n) => money(Math.round(n / 100) * 100, cur)} className="num text-3xl font-semibold text-good" />
      </div>
      <p className="mt-3 text-xs text-ink2">{d.decisionNote}</p>
    </CardShell>
  );
}
