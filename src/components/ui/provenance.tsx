"use client";

import type { DataKind } from "@/domain/provenance";
import { useI18n } from "../providers";
import { cn } from "@/lib/cn";
import { HelpTooltip } from "./tooltip";

/** FACT = solid outline, INFERENCE = dashed, ESTIMATE = double. Never colour-only. */
const style: Record<DataKind, string> = {
  FACT: "border-solid border-ink/70 text-ink",
  INFERENCE: "border-dashed border-ink2 text-ink2",
  ESTIMATE: "border-double border-[3px] border-info text-info",
};
const icon: Record<DataKind, string> = { FACT: "●", INFERENCE: "◐", ESTIMATE: "≈" };

export function ProvenanceBadge({ kind, className, interactive = true }: { kind: DataKind; className?: string; interactive?: boolean }) {
  const { dict } = useI18n();
  const hint = dict.kinds[`${kind}_HINT` as const];
  return (
    <span className="inline-flex items-center">
      <span
        className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wide", style[kind], className)}
      >
        <span aria-hidden>{icon[kind]}</span>
        {dict.kinds[kind]}
      </span>
      {interactive && <HelpTooltip label={dict.kinds[kind]}>{hint}</HelpTooltip>}
    </span>
  );
}
