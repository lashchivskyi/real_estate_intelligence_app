"use client";

import type { OverallVerdict, PriceVerdict } from "@/domain/decision/types";
import type { Severity } from "@/domain/inspection";
import type { LegalStatus } from "@/domain/legal";
import type { ReactNode } from "react";
import { Reveal } from "../motion";
import type { Tone } from "../ui/primitives";

export const verdictTone: Record<OverallVerdict, Tone> = {
  GOOD_BUY: "good",
  NEGOTIATE: "warn",
  HIGH_RISK: "bad",
  REVIEW_REQUIRED: "bad",
  PROMISING: "good",
  CAUTION: "warn",
  INSUFFICIENT_DATA: "neutral",
};
export const priceTone: Record<PriceVerdict, Tone> = {
  UNDERPRICED: "info",
  FAIR: "good",
  SLIGHTLY_OVERPRICED: "warn",
  OVERPRICED: "bad",
  INSUFFICIENT_DATA: "neutral",
};
export const severityTone: Record<Severity, Tone> = { green: "good", yellow: "warn", red: "bad" };
export const legalTone: Record<LegalStatus, Tone> = { green: "good", yellow: "warn", red: "bad", unknown: "neutral" };
export const scoreTone = (v: number | null): Tone => (v === null ? "neutral" : v >= 70 ? "good" : v >= 45 ? "warn" : "bad");

export function VerdictIcon({ verdict, size = 22 }: { verdict: OverallVerdict; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  switch (verdict) {
    case "GOOD_BUY":
    case "PROMISING":
      return (
        <svg {...common}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case "NEGOTIATE":
      return (
        <svg {...common}>
          <path d="M7 7h10M7 7l3-3M7 7l3 3M17 17H7M17 17l-3-3M17 17l-3 3" />
        </svg>
      );
    case "HIGH_RISK":
    case "CAUTION":
      return (
        <svg {...common}>
          <path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M5.6 5.6l12.8 12.8" />
        </svg>
      );
  }
}

export function SectionShell({ id, title, lead, right, children }: { id: string; title: string; lead?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32">
      <Reveal>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="display text-2xl sm:text-3xl">{title}</h2>
            {lead && <p className="mt-1.5 text-sm text-ink2">{lead}</p>}
          </div>
          {right}
        </div>
      </Reveal>
      {children}
    </section>
  );
}

