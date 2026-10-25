"use client";

import { useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "../providers";

const GROUP = " "; // narrow no-break space: "1 250 000" — the Ukrainian convention, readable at a glance

/** "1250000" → "1 250 000" (digits only; decimals optional). */
export function groupDigits(raw: string, decimals = false, decimalSep = ","): string {
  const clean = raw.replace(decimals ? /[^\d.,]/g : /\D/g, "");
  if (!decimals) return clean.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
  const [i, ...rest] = clean.replace(",", ".").split(".");
  const int = (i || "").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, GROUP);
  return rest.length ? `${int}${decimalSep}${rest.join("").slice(0, 2)}` : int;
}

/** Plain machine value from the formatted string. */
export const ungroup = (s: string) => s.replace(/[^\d.,]/g, "").replace(",", ".");

/** Human scale hint: 1 250 000 → "≈ 1,25 млн" / "≈ 1.25 M". */
export function scaleHint(n: number, lang: "uk" | "en"): string | null {
  if (!Number.isFinite(n) || n < 1000) return null;
  const f = (v: number) => (Math.round(v * 100) / 100).toString().replace(".", lang === "uk" ? "," : ".");
  if (n >= 1_000_000) return `≈ ${f(n / 1_000_000)} ${lang === "uk" ? "млн" : "M"}`;
  return `≈ ${f(n / 1000)} ${lang === "uk" ? "тис." : "K"}`;
}

/**
 * Number field with live thousands grouping. Keeps the caret on the same digit while reformatting,
 * submits the raw number through a hidden input (`name`), and shows a scale hint ("≈ 1,25 млн").
 */
export function NumberInput({
  name,
  defaultValue = "",
  value: controlled,
  onValueChange,
  decimals = false,
  hint = true,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> & {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (raw: string) => void;
  decimals?: boolean;
  hint?: boolean;
}) {
  const { lang } = useI18n();
  const [inner, setInner] = useState(() => groupDigits(defaultValue, decimals));
  const shown = controlled !== undefined ? groupDigits(controlled, decimals) : inner;
  const ref = useRef<HTMLInputElement>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/[^\d.,]/g, "").length;
    const next = groupDigits(el.value, decimals, lang === "uk" ? "," : ".");
    if (controlled === undefined) setInner(next);
    onValueChange?.(ungroup(next));
    // restore caret after the same number of digits
    requestAnimationFrame(() => {
      if (!ref.current) return;
      let count = 0;
      let pos = 0;
      while (pos < next.length && count < digitsBefore) {
        if (/[\d.,]/.test(next[pos])) count++;
        pos++;
      }
      ref.current.setSelectionRange(pos, pos);
    });
  };

  const raw = ungroup(shown);
  const scale = hint ? scaleHint(Number(raw), lang) : null;
  return (
    <div className="relative">
      <input
        {...rest}
        ref={ref}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        autoComplete="off"
        value={shown}
        onChange={onChange}
        className={cn(
          "num w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] tracking-tight text-ink placeholder:text-ink2/60 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25",
          scale && "pr-24",
          className,
        )}
      />
      {scale && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink2">{scale}</span>}
      {name && <input type="hidden" name={name} value={raw} />}
    </div>
  );
}
