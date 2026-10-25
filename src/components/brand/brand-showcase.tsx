"use client";

import dynamic from "next/dynamic";
import { Reveal, motion } from "../motion";
import { useI18n } from "../providers";
import { Mark } from "./mark";

const Logo3D = dynamic(() => import("../three/logo-3d").then((m) => m.Logo3D), { ssr: false });

const SWATCHES = [
  { k: "ink", hex: "#12151B", fg: "#EEF0F4" },
  { k: "paper", hex: "#F3F1EC", fg: "#12151B" },
  { k: "brand", hex: "#2B45D4", fg: "#FFFFFF" },
  { k: "mint", hex: "#8B9BFF", fg: "#0B0D12" },
  { k: "amber", hex: "#F2B550", fg: "#2A2111" },
  { k: "red", hex: "#C2412F", fg: "#FFFFFF" },
] as const;

/** Construction of the mark in three beats: focus → property → known. */
function Step({ i }: { i: 0 | 1 | 2 }) {
  return (
    <svg viewBox="0 0 32 32" className="h-1/2 w-1/2 overflow-visible" aria-hidden>
      <g fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10V4h6" />
        <path d="M22 4h6v6" />
        <path d="M28 22v6h-6" />
        <path d="M10 28H4v-6" />
      </g>
      {i >= 1 && <path d="M9.5 23.5V15.2L16 9.5l6.5 5.7v8.3Z" fill="none" stroke="var(--brand)" strokeWidth="2.3" strokeLinejoin="round" />}
      {i === 2 && <rect x="14.1" y="16.6" width="3.8" height="3.8" rx="0.7" fill="var(--accent)" />}
    </svg>
  );
}

export function BrandShowcase() {
  const { dict } = useI18n();
  const d = dict.brand;
  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 overflow-hidden rounded-3xl bg-[#0a0c11] p-8 text-[#eef0f4] lg:grid-cols-[1fr_1fr] lg:p-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f2b550]">{d.eyebrow}</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">{d.title}</h1>
          <p className="mt-5 max-w-lg text-white/70">{d.lead}</p>
          <p className="display mt-8 text-2xl text-[#aab6ff]">{d.tagline}</p>
        </div>
        <Logo3D dark className="aspect-square w-full max-w-[460px] justify-self-center" />
      </section>

      <section className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <Reveal>
          <h2 className="display text-3xl">{d.markTitle}</h2>
          <p className="mt-3 text-ink2">{d.markBody}</p>
          <ul className="mt-6 space-y-2 text-sm">
            {d.rules.map((r) => (
              <li key={r} className="flex gap-2.5">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {r}
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="grid grid-cols-3 gap-3">
          {([0, 1, 2] as const).map((i) => (
            <motion.figure key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="grid aspect-square place-items-center rounded-2xl border border-line bg-surface">
              <Step i={i} />
              <figcaption className="text-xs text-ink2">{d.steps[i]}</figcaption>
            </motion.figure>
          ))}
          <div className="col-span-3 grid grid-cols-3 gap-3">
            <div className="group grid aspect-[2/1] place-items-center rounded-2xl bg-[#12151b] [--ink:#eef0f4] [--brand:#8b9bff]">
              <span className="inline-flex items-center gap-2 text-white">
                <Mark size={26} />
                <span className="text-lg font-semibold tracking-[-0.045em]">vidomo</span>
              </span>
            </div>
            <div className="group grid aspect-[2/1] place-items-center rounded-2xl bg-brand [--ink:#ffffff] [--brand:#ffffff]">
              <Mark size={34} />
            </div>
            <div className="group grid aspect-[2/1] place-items-center rounded-2xl border border-line bg-surface">
              <Mark size={20} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="display text-3xl">{d.paletteTitle}</h2>
        <p className="mt-2 max-w-2xl text-ink2">{d.paletteLead}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SWATCHES.map((s, i) => (
            <motion.div key={s.k} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex aspect-[3/4] flex-col justify-end rounded-2xl p-4" style={{ background: s.hex, color: s.fg, border: s.k === "paper" ? "1px solid var(--line)" : undefined }}>
              <span className="num text-xs opacity-80">{s.hex}</span>
              <span className="mt-1 text-sm font-medium leading-snug">{d.palette[s.k]}</span>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden>
          <span className="w-[60%] bg-[#f3f1ec] ring-1 ring-inset ring-line" />
          <span className="w-[30%] bg-[#12151b]" />
          <span className="w-[8%] bg-[#2b45d4]" />
          <span className="w-[2%] bg-[#f2b550]" />
        </div>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="display text-3xl">{d.typeTitle}</h2>
          <p className="mt-3 text-ink2">{d.typeBody}</p>
          <p className="display mt-6 text-5xl">Аа Bb 1 750</p>
          <p className="num mt-2 text-2xl">4 135 000 ₴ · $91 500</p>
        </div>
        <div>
          <h2 className="display text-3xl">{d.voiceTitle}</h2>
          <ul className="mt-4 space-y-3">
            {d.voice.map((v) => (
              <li key={v} className="rounded-xl border border-line bg-surface p-4 text-[15px]">
                {v}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ink2">{d.domainNote}</p>
        </div>
      </section>
    </div>
  );
}
