"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, useInView } from "motion/react";
import { XRAY_FINDINGS } from "@/data/xray-findings";
import { cn } from "@/lib/cn";
import { CountUp, motion, useReducedMotion, EASE } from "../motion";
import { useI18n } from "../providers";
import { Button, Pill } from "../ui/primitives";

const InspectionXray = dynamic(() => import("../three/inspection-xray").then((m) => m.InspectionXray), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface2" />,
});

const STEP_MS = 6500;
const CUR = "USD";

/**
 * Scrollable story around the 3D room: the buyer's view first, then one hidden defect per step with
 * the pain it causes, its repair range and what it does to the price. A running total turns findings
 * into a negotiation argument — the value of an inspection in one minute.
 */
export function XrayStory() {
  const { dict, lang, money } = useI18n();
  const d = dict.inspection.xray;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-25% 0px" });
  const reduce = useReducedMotion();

  const findings = XRAY_FINDINGS;
  const steps = 2 + findings.length; // intro + findings + summary

  useEffect(() => {
    if (!inView || !playing || reduce) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % steps), STEP_MS);
    return () => clearTimeout(t);
  }, [inView, playing, reduce, step, steps]);

  const revealed = step === steps - 1 ? findings : findings.slice(0, Math.max(0, step));
  const low = revealed.reduce((a, f) => a + f.repair.low, 0);
  const high = revealed.reduce((a, f) => a + f.repair.high, 0);
  const cur = CUR;
  const labels = useMemo(
    () => findings.map((f) => ({ title: f.title[lang], sub: `${money(f.repair.low, cur)} – ${money(f.repair.high, cur)}`, tone: f.severity === "red" ? ("bad" as const) : ("warn" as const) })),
    [findings, lang, money, cur],
  );
  const finding = step >= 1 && step <= findings.length ? findings[step - 1] : null;
  const go = (s: number) => {
    setStep(s);
    setPlaying(false);
  };

  return (
    <div ref={ref} className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* 3D room */}
        <div className="relative h-[420px] bg-[linear-gradient(180deg,#e9e6df,#d9d4c9)] sm:h-[520px] lg:h-[600px]">
          <InspectionXray step={step} labels={labels} className="h-full w-full" />
          <div className="pointer-events-none absolute left-4 top-4 flex gap-2">
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold shadow-card transition-colors", step === 0 ? "bg-ink text-bg" : "bg-surface/90 text-ink2")}>{d.buyerSees}</span>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold shadow-card transition-colors", step > 0 ? "bg-brand text-brandink" : "bg-surface/90 text-ink2")}>{d.inspectorSees}</span>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-4 text-[11px] text-ink2">{d.illustration}</p>
        </div>

        {/* narrative */}
        <div className="flex flex-col border-t border-line p-6 lg:border-l lg:border-t-0">
          <ol className="flex gap-1.5" aria-label={d.title}>
            {Array.from({ length: steps }).map((_, i) => (
              <li key={i} className="flex-1">
                <button type="button" onClick={() => go(i)} aria-label={`${i + 1}`} aria-current={i === step ? "step" : undefined} className="block h-6 w-full">
                  <span className="relative block h-1 overflow-hidden rounded-full bg-surface2">
                    {i < step && <span className="absolute inset-0 bg-brand" />}
                    {i === step && (
                      <motion.span
                        key={`${step}-${playing}`}
                        className="absolute inset-y-0 left-0 bg-brand"
                        initial={{ width: playing && inView && !reduce ? "0%" : "100%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: playing && inView && !reduce ? STEP_MS / 1000 : 0, ease: "linear" }}
                      />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-4 min-h-[300px] flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35, ease: EASE }}>
                {step === 0 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink2">{d.intro.eyebrow}</p>
                    <h3 className="display mt-2 text-3xl">{d.intro.t}</h3>
                    <p className="mt-3 text-ink2">{d.intro.d}</p>
                    <blockquote className="mt-5 border-l-2 border-accent pl-3 italic">“{d.intro.quote}”</blockquote>
                  </>
                )}
                {finding && (
                  <>
                    <div className="flex items-center gap-2">
                      <Pill tone={finding.severity === "red" ? "bad" : "warn"}>{dict.enums.severity[finding.severity]}</Pill>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink2">{dict.inspection.sections[finding.section]}</span>
                      {finding.licensed && <Pill tone="neutral">{dict.inspection.licensed}</Pill>}
                    </div>
                    <h3 className="display mt-2 text-3xl">{finding.title[lang]}</h3>
                    <p className="mt-3 rounded-xl bg-badbg/60 px-3 py-2 text-sm">
                      <span className="font-semibold">{d.painLabel}: </span>
                      {finding.pain[lang]}
                    </p>
                    <p className="mt-3 text-sm text-ink2">
                      <span className="font-medium text-ink">{d.howLabel}: </span>
                      {finding.how[lang]}
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-ink2">{dict.report.technical.issue.repair}</dt>
                        <dd className="num font-semibold">{`${money(finding.repair.low, cur)} – ${money(finding.repair.high, cur)}`}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-ink2">{dict.report.technical.issue.leverage}</dt>
                        <dd className="font-semibold">{dict.enums.leverage[finding.negotiation]}</dd>
                      </div>
                    </dl>
                  </>
                )}
                {step === steps - 1 && (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.summary.eyebrow}</p>
                    <h3 className="display mt-2 text-3xl">{d.summary.t.replace("{n}", String(findings.length))}</h3>
                    <p className="mt-3 text-ink2">{d.summary.d}</p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* running total: findings → money → negotiation */}
          <div className="mt-5 rounded-2xl bg-ink p-5 text-bg">
            <p className="text-xs uppercase tracking-[0.14em] text-bg/60">{d.totalLabel}</p>
            <p className="num mt-1 text-2xl font-semibold">
              {revealed.length === 0 ? (
                <span className="text-bg/50">{money(0, cur)}</span>
              ) : (
                <>
                  <CountUp key={`l${low}`} value={low} format={(n) => money(Math.round(n), cur)} /> – <CountUp key={`h${high}`} value={high} format={(n) => money(Math.round(n), cur)} />
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-bg/70">{revealed.length === 0 ? d.totalEmpty : d.leverageText.replace("{n}", String(revealed.length))}</p>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0} aria-label={d.prev}>
              ←
            </Button>
            <Button type="button" variant="secondary" onClick={() => setPlaying((p) => !p)}>
              {playing ? d.pause : d.play}
            </Button>
            <Button type="button" onClick={() => go((step + 1) % steps)} className="flex-1">
              {step === steps - 1 ? d.restart : d.next} →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
