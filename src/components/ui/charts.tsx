"use client";

import { useId } from "react";
import { motion, useReducedMotion, CountUp, EASE } from "../motion";
import { useI18n } from "../providers";
import { toneVar, type Tone } from "./primitives";
import { ExplainedTerm } from "./tooltip";
import type { GlossaryTerm } from "@/i18n/glossary";

/* ------------------------------ RangeBar ------------------------------ */
export interface RangeMarker {
  value: number;
  label: string;
  tone: Tone;
  /** Marker above the track (default) or below. */
  below?: boolean;
}

/**
 * Directly labelled comparison rows share a price scale; labels never overlap the markers.
 */
export function RangeBar({ low, high, mid, currency, markers = [], height = 92 }: { low: number; high: number; mid?: number; currency: string; markers?: RangeMarker[]; height?: number }) {
  const { money, lang } = useI18n();
  const all = [low, high, ...markers.map((m) => m.value)];
  const span = Math.max(Math.max(...all) - Math.min(...all), Math.abs(high) * 0.1, 1);
  const min = Math.max(0, Math.min(...all) - span * 0.15);
  const max = Math.max(...all) + span * 0.15;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const market = lang === "uk" ? "Оцінка ринку" : "Market estimate";
  return (
    <figure className="w-full space-y-4" style={{ minHeight: height }} aria-label={market}>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <span className="font-medium"><ExplainedTerm term="fairRange">{market}</ExplainedTerm></span>
          <span className="num font-semibold">{money(low, currency)} – {money(high, currency)}</span>
        </div>
        <div className="relative h-5 rounded bg-surface2" aria-hidden="true">
          <div className="absolute inset-y-0 min-w-0.5 rounded border border-brand bg-brand/25" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
          {mid !== undefined && <span className="absolute inset-y-0 w-0.5 bg-brand" style={{ left: `${pct(mid)}%` }} />}
        </div>
      </div>
      {markers.map((m, i) => (
        <div key={m.label + i}>
          <div className="mb-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{m.label}</span>
            <span className="num font-semibold" style={{ color: toneVar[m.tone] }}>{money(m.value, currency)}</span>
          </div>
          <div className="relative h-5 rounded bg-surface2" aria-hidden="true">
            <span className="absolute inset-y-0 rounded border border-dashed border-brand/50 bg-brand/10" style={{ left: `${pct(low)}%`, width: `${pct(high) - pct(low)}%` }} />
            <span className="absolute -top-1 bottom-0 w-px bg-ink2/30" style={{ left: `${pct(m.value)}%` }} />
            <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-surface" style={{ left: `${pct(m.value)}%`, background: toneVar[m.tone] }} />
          </div>
        </div>
      ))}
      <figcaption className="border-t border-line pt-2 text-xs text-ink2">
        <div className="num flex justify-between gap-3"><span>{money(Math.round(min), currency)}</span><span>{money(Math.round(max), currency)}</span></div>
        <p className="mt-1">{lang === "uk" ? "Спільна шкала цін · показано фрагмент, не від нуля" : "Shared price scale · zoomed range, does not start at zero"}</p>
      </figcaption>
    </figure>
  );
}

/* --------------------------- ConfidenceMeter --------------------------- */
export function ConfidenceMeter({ value, components }: { value: number; components?: Array<{ label: string; score: number; detail?: string; term?: GlossaryTerm }> }) {
  const { num } = useI18n();
  const reduce = useReducedMotion();
  const tone: Tone = value >= 0.65 ? "good" : value >= 0.4 ? "warn" : "bad";
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <CountUp value={value * 100} format={(n) => `${num(n)}%`} className="num text-2xl font-semibold" />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: toneVar[tone] }}
          initial={{ width: reduce ? `${value * 100}%` : 0 }}
          whileInView={{ width: `${value * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </div>
      {components && (
        <ul className="mt-4 space-y-2.5">
          {components.map((c) => (
            <li key={c.label} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink2">{c.term ? <ExplainedTerm term={c.term}>{c.label}</ExplainedTerm> : c.label}</span>
                <span className="num text-ink2">{c.detail}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface2">
                <motion.div
                  className="h-full rounded-full bg-ink2/70"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${c.score * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ ScoreRing ------------------------------ */
export function ScoreRing({ value, size = 84, label }: { value: number | null; size?: number; label?: string }) {
  const { num } = useI18n();
  const reduce = useReducedMotion();
  const id = useId();
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const tone: Tone = value === null ? "neutral" : value >= 70 ? "good" : value >= 45 ? "warn" : "bad";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ? `${label}: ${value ?? "—"}` : undefined}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={5} strokeDasharray={value === null ? "3 5" : undefined} />
        {value !== null && (
          <motion.circle
            key={id}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={toneVar[tone]}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: reduce ? c * (1 - value / 100) : c }}
            whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: EASE }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {value === null ? <span className="text-ink2">—</span> : <CountUp value={value} format={(n) => num(n)} className="num text-lg font-semibold" />}
      </div>
    </div>
  );
}
