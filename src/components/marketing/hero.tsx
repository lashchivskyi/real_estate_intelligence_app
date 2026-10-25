"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import type { ScanPhase } from "../three/city-scan";
import { MaskLine, Reveal, motion, useReducedMotion, EASE } from "../motion";
import { useI18n } from "../providers";
import { cn } from "@/lib/cn";

const CityScan = dynamic(() => import("../three/city-scan").then((m) => m.CityScan), { ssr: false });

const PHASES: ScanPhase[] = ["scan", "market", "inspect", "verdict"];
const PHASE_COLOR: Record<ScanPhase, string> = { scan: "#c9d2e6", market: "#8b9bff", inspect: "#f07a68", verdict: "#f2b550" };

/**
 * Dark, full-bleed hero. The Three.js "city scan" tells how we work (scan → market → inspection →
 * verdict); the HUD on the right narrates the current phase in words, so the animation is never decoration.
 */
export function Hero() {
  const { dict, href } = useI18n();
  const d = dict.home;
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<ScanPhase>("scan");

  return (
    <section className="relative isolate overflow-hidden bg-[#0a0c11] text-[#eef0f4]" style={{ colorScheme: "dark" }}>
      {/* fallback glow if WebGL is unavailable, and depth behind the canvas */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_70%_45%,rgba(139,155,255,0.16),transparent_70%)]" />
      <CityScan className="absolute inset-0 -z-10 opacity-95" onPhase={setPhase} />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[#0a0c11] via-[#0a0c11]/75 to-transparent lg:via-[#0a0c11]/40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#0a0c11] to-transparent" />

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Reveal y={8}>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f2b550]" />
              {d.eyebrow}
            </p>
          </Reveal>
          <h1 className="display text-[clamp(2.3rem,5.2vw,4.1rem)]">
            <MaskLine delay={0.05}>{d.heroLine1}</MaskLine>
            <MaskLine delay={0.18} className="text-[#aab6ff]">
              {d.heroLine2}
            </MaskLine>
          </h1>
          <Reveal delay={0.45}>
            <p className="mt-6 max-w-xl text-lg text-white/70">{d.heroSub}</p>
          </Reveal>

          <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-2">
            {[
              { to: "/check", t: d.cta1Title, b: d.cta1Body, c: d.cta1Button, primary: true },
              { to: "/brief", t: d.cta2Title, b: d.cta2Body, c: d.cta2Button, primary: false },
            ].map((x, i) => (
              <motion.div key={x.to} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.55 + i * 0.12, ease: EASE }}>
                <Link
                  href={href(x.to)}
                  className={cn(
                    "group flex h-full flex-col justify-between rounded-2xl border p-5 backdrop-blur transition-all hover:-translate-y-0.5",
                    x.primary ? "border-white bg-white text-[#12151b] hover:shadow-[0_10px_40px_-12px_rgba(139,155,255,0.8)]" : "border-white/15 bg-white/[0.06] hover:border-white/35",
                  )}
                >
                  <div>
                    <p className="text-lg font-semibold">{x.t}</p>
                    <p className={cn("mt-1.5 text-sm", x.primary ? "text-[#12151b]/65" : "text-white/60")}>{x.b}</p>
                  </div>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                    {x.c}
                    <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>

          <Reveal delay={0.9}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {[d.trust1, d.trust2, d.trust3].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f2b550" strokeWidth="2.5" aria-hidden>
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* HUD: narrates the scene */}
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1, duration: 0.8, ease: EASE }}
          className="self-end justify-self-end rounded-2xl border border-white/10 bg-[#0a0c11]/70 p-5 backdrop-blur-md lg:mb-6 lg:w-[360px]"
          aria-live="polite"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">{d.hud.title}</p>
          <ol className="mt-4 grid grid-cols-4 gap-1.5">
            {PHASES.map((p) => (
              <li key={p} className="relative h-1 overflow-hidden rounded-full bg-white/10">
                {PHASES.indexOf(p) <= PHASES.indexOf(phase) && (
                  <motion.span layoutId={`hud-${p}`} className="absolute inset-0 rounded-full" style={{ background: PHASE_COLOR[p] }} initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6 }} />
                )}
              </li>
            ))}
          </ol>
          <AnimatePresence mode="wait">
            <motion.div key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }} className="mt-4 min-h-[88px]">
              <p className="flex items-center gap-2 font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: PHASE_COLOR[phase] }} />
                {d.hud.phases[phase].t}
              </p>
              <p className="mt-1.5 text-sm text-white/65">{d.hud.phases[phase].d}</p>
            </motion.div>
          </AnimatePresence>
        </motion.aside>
      </div>
    </section>
  );
}
