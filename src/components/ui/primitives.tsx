import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-medium transition-[background,transform,box-shadow,border-color,filter] duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brandink hover:brightness-110 shadow-[0_6px_20px_-8px_var(--brand)]",
  secondary: "border border-line bg-surface text-ink hover:border-ink2",
  ghost: "text-ink2 hover:text-ink hover:bg-surface2",
};

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cn(base, variants[variant], className)} {...p} />;
}

export function LinkButton({
  variant = "primary",
  className,
  href,
  children,
  ...p
}: { variant?: Variant; className?: string; href: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={cn(base, variants[variant], className)} {...p}>
      {children}
    </Link>
  );
}

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-print rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6", className)} {...p}>
      {children}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, lead, id }: { eyebrow?: string; title: string; lead?: string; id?: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>}
      <h2 id={id} className="display text-3xl sm:text-4xl">
        {title}
      </h2>
      {lead && <p className="mt-3 text-ink2">{lead}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink2/60 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function Field({ label, hint, optional, children, htmlFor }: { label: string; hint?: string; optional?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink2">{optional}</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink2">{hint}</p>}
    </div>
  );
}
export const Input = (p: ComponentProps<"input">) => <input {...p} className={cn(inputCls, p.className)} />;
export const Select = (p: ComponentProps<"select">) => <select {...p} className={cn(inputCls, "pr-8", p.className)} />;
export const Textarea = (p: ComponentProps<"textarea">) => <textarea {...p} className={cn(inputCls, "min-h-24", p.className)} />;

export function Chip({ active, children, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-colors",
        active ? "border-brand bg-brand text-brandink" : "border-line bg-surface text-ink hover:border-ink2",
        className,
      )}
      {...p}
    >
      {children}
    </button>
  );
}

export type Tone = "good" | "warn" | "bad" | "info" | "neutral";
export const toneText: Record<Tone, string> = { good: "text-good", warn: "text-warn", bad: "text-bad", info: "text-info", neutral: "text-ink2" };
export const toneBg: Record<Tone, string> = { good: "bg-goodbg", warn: "bg-warnbg", bad: "bg-badbg", info: "bg-infobg", neutral: "bg-surface2" };
export const toneBorder: Record<Tone, string> = { good: "border-good", warn: "border-warn", bad: "border-bad", info: "border-info", neutral: "border-line" };
export const toneVar: Record<Tone, string> = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", info: "var(--info)", neutral: "var(--ink-2)" };

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", toneBg[tone], toneText[tone], className)}>{children}</span>;
}
