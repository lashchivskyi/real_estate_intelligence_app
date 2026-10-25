"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, useInView } from "motion/react";
import { motion, useReducedMotion, EASE } from "../motion";
import { useI18n } from "../providers";
import { cn } from "@/lib/cn";

const R = 150;
const C = 200;
const STEP_MS = 3800;

/**
 * "How we work" as a living cycle: six stages on an orbit, a progress arc that fills to the
 * active stage, a comet that keeps circling (the loop restarts for the next property), and a
 * detail panel with the deliverable, time and who does the work. Auto-advances while visible,
 * pauses on hover/focus; every node is a button.
 */
export function WorkCycle() {
  const { dict } = useI18n();
  const d = dict.home.cycle;
  const steps = d.steps;
  const n = steps.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || paused || reduce) return;
    const t = setInterval(() => setActive((a) => (a + 1) % n), STEP_MS);
    return () => clearInterval(t);
  }, [inView, paused, reduce, n]);

  const angle = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pos = (i: number) => [C + R * Math.cos(angle(i)), C + R * Math.sin(angle(i))] as const;
  const circ = 2 * Math.PI * R;
  const progress = (active + 1) / n;
  const s = steps[active];

  return (
    <section className="relative overflow-hidden border-y border-line/70 bg-surface2/50 py-24" aria-labelledby="cycle-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.eyebrow}</p>
        <h2 id="cycle-title" className="display mt-2 max-w-3xl text-[clamp(2rem,4.2vw,3.2rem)]">
          {d.title}
        </h2>
        <p className="mt-3 max-w-2xl text-ink2">{d.lead}</p>

        <div ref={ref} className="mt-12 grid items-center gap-10 lg:grid-cols-[minmax(0,520px)_1fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          {/* orbit */}
          <div className="relative mx-auto aspect-square w-full max-w-[520px]">
            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <linearGradient id="cyc-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--brand)" />
                  <stop offset="1" stopColor="var(--accent)" />
                </linearGradient>
              </defs>
              <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="2 6" />
              <circle cx={C} cy={C} r={R - 34} fill="none" stroke="var(--line)" strokeWidth="1" opacity="0.6" />
              <motion.circle
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke="url(#cyc-grad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circ}
                transform={`rotate(-90 ${C} ${C})`}
                animate={{ strokeDashoffset: circ * (1 - progress) }}
                transition={{ duration: 0.9, ease: EASE }}
              />
              {/* comet: the loop never stops — the next property is already coming in */}
              <g className="motion-reduce:hidden" style={{ transformOrigin: `${C}px ${C}px`, animation: "vd-orbit 9s linear infinite" }}>
                <circle cx={C} cy={C - R - 18} r="3.5" fill="var(--accent)" />
                <circle cx={C} cy={C - R - 18} r="9" fill="var(--accent)" opacity="0.18" />
              </g>
            </svg>

            {steps.map((st, i) => {
              const [x, y] = pos(i);
              const done = i <= active;
              return (
                <button
                  key={st.t}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-pressed={i === active}
                  aria-label={`${i + 1}. ${st.t}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(x / 400) * 100}%`, top: `${(y / 400) * 100}%` }}
                >
                  <motion.span
                    animate={{ scale: i === active ? 1.12 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className={cn(
                      "num grid h-12 w-12 place-items-center rounded-2xl border text-sm font-semibold shadow-card transition-colors sm:h-14 sm:w-14",
                      i === active ? "border-brand bg-brand text-brandink" : done ? "border-brand/40 bg-surface text-brand" : "border-line bg-surface text-ink2",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </motion.span>
                  <span className={cn("absolute left-1/2 top-full mt-1.5 hidden -translate-x-1/2 whitespace-nowrap text-xs font-medium sm:block", i === active ? "text-ink" : "text-ink2")}>{st.t}</span>
                </button>
              );
            })}

            {/* centre */}
            <div className="absolute inset-[26%] grid place-items-center rounded-full bg-surface text-center shadow-card">
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.35 }} className="px-4">
                  <p className="num text-xs text-ink2">{d.stage} {active + 1}/{n}</p>
                  <p className="display mt-1 text-2xl sm:text-3xl">{s.t}</p>
                  <p className="num mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2.5 py-1 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {s.time}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* detail */}
          <div aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.4, ease: EASE }} className="rounded-3xl border border-line bg-surface p-7 shadow-card">
                <p className="num text-sm text-brand">{String(active + 1).padStart(2, "0")}</p>
                <h3 className="display mt-1 text-3xl">{s.t}</h3>
                <p className="mt-3 text-ink2">{s.d}</p>
                <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink2">{d.labels.out}</dt>
                    <dd className="mt-1 font-medium">{s.out}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink2">{d.labels.time}</dt>
                    <dd className="num mt-1 font-medium">{s.time}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink2">{d.labels.who}</dt>
                    <dd className="mt-1 font-medium">{s.who}</dd>
                  </div>
                </dl>
                <div className="mt-7 h-1 overflow-hidden rounded-full bg-surface2">
                  {!paused && !reduce && inView && <motion.div key={`p${active}`} className="h-full rounded-full bg-brand" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: STEP_MS / 1000, ease: "linear" }} />}
                </div>
              </motion.div>
            </AnimatePresence>
            <ol className="mt-5 flex flex-wrap gap-2 sm:hidden">
              {steps.map((st, i) => (
                <li key={st.t}>
                  <button type="button" onClick={() => setActive(i)} className={cn("rounded-full border px-3 py-1 text-xs", i === active ? "border-brand bg-brand text-brandink" : "border-line")}>
                    {st.t}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
