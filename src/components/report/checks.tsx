"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPackage } from "@/config/packages";
import type { ModuleState } from "@/domain/cases";
import type { ReportData } from "@/domain/report/build";
import { cn } from "@/lib/cn";
import { motion } from "../motion";
import { useI18n } from "../providers";
import { Button, Pill } from "../ui/primitives";
import { ProvenanceBadge } from "../ui/provenance";
import { LegalSection, TechnicalSection } from "./report-modules";
import { SectionShell } from "./shared";
import { requestModuleAction } from "@/server/actions/ops";

type Order = (v: "inspection" | "legal" | "consult") => void;
type ModuleKey = "digital" | "legal" | "technical";

const STATE_TONE: Record<ModuleState | "done", "good" | "info" | "neutral"> = {
  done: "good",
  in_progress: "info",
  awaiting_assignment: "info",
  not_ordered: "neutral",
};

/** Report query string (client-only, after mount) → checkout links attach the order to THIS property. */
function useReportQuery(): string {
  const [q, setQ] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the URL after hydration
    if (window.location.pathname.endsWith("/report")) setQ(window.location.search.slice(1));
  }, []);
  return q;
}
const checkoutPath = (pkg: string, q: string) => `/checkout?package=${pkg}${q ? `&r=${encodeURIComponent(q)}` : ""}`;

/** Three independent modules of the dossier, each with its own state — shown above the verdict. */
export function DossierProgress({ r }: { r: ReportData }) {
  const { dict } = useI18n();
  const d = dict.report.dossier;
  const items: Array<{ key: ModuleKey; state: ModuleState | "done" }> = [
    { key: "digital", state: "done" },
    { key: "legal", state: r.modules.legal },
    { key: "technical", state: r.modules.technical },
  ];
  return (
    <section aria-label={d.title} className="no-print">
      <ol className="grid gap-3 sm:grid-cols-3">
        {items.map((it, i) => (
          <motion.li
            key={it.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={cn("flex items-start gap-3 rounded-2xl border p-4", it.state === "done" ? "border-line bg-surface" : "border-dashed border-line bg-surface/60")}
          >
            <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold", it.state === "done" ? "bg-good text-white" : it.state === "not_ordered" ? "border-2 border-dashed border-line text-ink2" : "bg-brand/15 text-brand")}>
              {it.state === "done" ? "✓" : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{d.modules[it.key]}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2">
                <Pill tone={STATE_TONE[it.state]}>{d.states[it.state]}</Pill>
              </span>
              {it.state === "not_ordered" && it.key !== "digital" &&
                (r.caseRef ? (
                  <div className="mt-2">
                    <RequestModule caseId={r.caseRef.id} module={it.key === "legal" ? "legal" : "inspection"} label={`${d.add} →`} className="text-sm font-semibold text-brand hover:underline" />
                  </div>
                ) : (
                  <a href="#checks" className="mt-2 inline-block text-sm font-semibold text-brand hover:underline">
                    {d.add} →
                  </a>
                ))}
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

function PendingCheck({ kind, state, onOrder, r, q }: { kind: "legal" | "technical"; state: ModuleState; onOrder: Order; r: ReportData; q: string }) {
  const { dict, moneyExact, m, href } = useI18n();
  const d = dict.report.checks[kind];
  const pkg = getPackage(kind === "legal" ? "legal" : "inspection");
  const orderHref = href(checkoutPath(kind === "legal" ? "legal" : "inspection", q));
  const inWork = state === "in_progress" || state === "awaiting_assignment";
  return (
    <div className={cn("flex h-full flex-col rounded-2xl border bg-surface p-6", inWork ? "border-brand/40" : "border-dashed border-line")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-semibold">{d.title}</h3>
        <Pill tone={inWork ? "info" : "neutral"}>{dict.report.dossier.states[state]}</Pill>
      </div>
      <p className="mt-2 text-sm text-ink2">{d.why}</p>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-ink2">{dict.report.checks.whatWeCheck}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {d.items.map((x) => (
          <li key={x} className="flex gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.4" className="mt-0.5 shrink-0" aria-hidden>
              <path d="M5 12l5 5L20 7" />
            </svg>
            {x}
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-xl bg-surface2 px-4 py-3 text-sm">
        <span className="font-semibold">{dict.report.checks.canChange} </span>
        {d.impact}
      </div>

      {kind === "technical" && r.watchlist.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink2">
            {dict.report.technical.watchTitle} <ProvenanceBadge kind="INFERENCE" className="ml-1" />
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink2">
            {r.watchlist.slice(0, 4).map((w) => (
              <li key={w.code}>· {m(w)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        {inWork ? (
          <p className="text-sm text-ink2">{d.inWork}</p>
        ) : (
          <>
            <span className="text-sm">
              {pkg?.priceUah && <span className="num text-lg font-semibold">{moneyExact(pkg.priceUah, "UAH")}</span>}
              <span className="ml-2 text-ink2">· {d.time}</span>
            </span>
            <div className="no-print flex gap-2">
              <Button variant="secondary" onClick={() => onOrder(kind === "legal" ? "legal" : "inspection")}>
                {dict.report.checks.ask}
              </Button>
              {r.caseRef ? (
                <RequestModule caseId={r.caseRef.id} module={kind === "legal" ? "legal" : "inspection"} label={dict.report.checks.order} />
              ) : (
                <Link href={orderHref} className="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-[15px] font-medium text-brandink hover:brightness-110">
                  {dict.report.checks.order}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * "Checks for the final decision": legal and technical modules. A finished module shows its results;
 * a pending one explains what it covers and what it can change — it never degrades the digital findings.
 */
export function ChecksSection({ r, onOrder }: { r: ReportData; onOrder: Order }) {
  const { dict, href } = useI18n();
  const q = useReportQuery();
  const d = dict.report.checks;
  const legalDone = r.modules.legal === "done";
  const techDone = r.modules.technical === "done";
  const bothPending = !legalDone && !techDone;
  return (
    <SectionShell id="checks" title={d.title} lead={bothPending ? d.leadPending : d.lead}>
      {bothPending && !r.caseRef && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-4 text-bg">
          <p className="max-w-2xl text-sm">
            <span className="font-semibold">{d.bundleTitle} </span>
            {d.bundleBody}
          </p>
          <Link href={href(checkoutPath("full", q))} className="rounded-full bg-bg px-5 py-2 text-sm font-semibold text-ink">
            {d.bundleCta}
          </Link>
        </div>
      )}
      <div className={cn("grid gap-5", !legalDone || !techDone ? "lg:grid-cols-2" : "")}>
        {!legalDone && <PendingCheck kind="legal" state={r.modules.legal} onOrder={onOrder} r={r} q={q} />}
        {!techDone && <PendingCheck kind="technical" state={r.modules.technical} onOrder={onOrder} r={r} q={q} />}
      </div>
      {legalDone && (
        <div className="mt-6">
          <LegalSection r={r} onOrder={() => onOrder("legal")} />
        </div>
      )}
      {techDone && (
        <div className="mt-6">
          <TechnicalSection r={r} onOrder={() => onOrder("inspection")} />
        </div>
      )}
    </SectionShell>
  );
}

/** Inside a case: ordering a module is a request to the manager on the same case (no new checkout). */
export function RequestModule({ caseId, module, label, className }: { caseId: string; module: "legal" | "inspection"; label: string; className?: string }) {
  const { lang } = useI18n();
  return (
    <form action={requestModuleAction}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="module" value={module} />
      <button type="submit" className={className ?? "inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-[15px] font-medium text-brandink hover:brightness-110"}>
        {label}
      </button>
    </form>
  );
}
