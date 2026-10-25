import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small server-safe building blocks for the auth pages and the operations UI. */

export function AuthCard({ title, lead, error, children, footer }: { title: string; lead: string; error?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="display text-4xl">{title}</h1>
      <p className="mt-2 text-ink2">{lead}</p>
      <div className="mt-8 rounded-3xl border border-line bg-surface p-6 shadow-card">
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-badbg px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        {children}
      </div>
      {footer && <div className="mt-5 text-center text-sm text-ink2">{footer}</div>}
    </div>
  );
}

export const inputCls = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function TextField({ label, name, type = "text", required, autoComplete, hint, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; autoComplete?: string; hint?: string; defaultValue?: string | number | null; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input name={name} type={type} required={required} autoComplete={autoComplete} defaultValue={defaultValue ?? undefined} placeholder={placeholder} className={inputCls} />
      {hint && <span className="mt-1 block text-xs text-ink2">{hint}</span>}
    </label>
  );
}

export function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue?: string | null; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextArea({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue?: string | null; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea name={name} rows={rows} defaultValue={defaultValue ?? ""} className={inputCls} />
    </label>
  );
}

export function SubmitButton({ children, variant = "primary", name, value, className }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; name?: string; value?: string; className?: string }) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={cn(
        "rounded-full px-5 py-2.5 text-[15px] font-medium transition",
        variant === "primary" && "bg-brand text-brandink hover:brightness-110",
        variant === "secondary" && "border border-line bg-surface hover:border-ink2",
        variant === "danger" && "border border-bad/40 bg-surface text-bad hover:bg-badbg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ title, children, right, className }: { title?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface p-5", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: "warn" | "bad" | "good" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-wider text-ink2">{label}</p>
      <p className={cn("num mt-2 text-3xl font-semibold", tone === "warn" && "text-warn", tone === "bad" && "text-bad", tone === "good" && "text-good")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink2">{hint}</p>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  new: "bg-infobg text-info",
  active: "bg-brand/10 text-brand",
  report_ready: "bg-goodbg text-good",
  closed: "bg-surface2 text-ink2",
  cancelled: "bg-badbg text-bad",
  done: "bg-goodbg text-good",
  in_progress: "bg-brand/10 text-brand",
  awaiting_assignment: "bg-warnbg text-warn",
  not_ordered: "bg-surface2 text-ink2",
};
export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[kind] ?? "bg-surface2 text-ink2")}>{children}</span>;
}

/** Three dots: digital · legal · technical. */
export function ModuleDots({ legal, technical }: { legal: string; technical: string }) {
  const dot = (s: string) => cn("h-2.5 w-2.5 rounded-full", s === "done" ? "bg-good" : s === "in_progress" ? "bg-brand" : s === "awaiting_assignment" ? "bg-warn" : "border border-line");
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className={dot("done")} />
      <span className={dot(legal)} />
      <span className={dot(technical)} />
    </span>
  );
}

export const fmtDate = (d: Date | string | null | undefined, lang: string) => {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return lang === "uk" ? `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}` : `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
