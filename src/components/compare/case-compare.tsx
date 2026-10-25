"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReportData } from "@/domain/report/build";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { useI18n } from "../providers";
import { Card, Chip } from "../ui/primitives";
import { CompareResults } from "./compare-builder";

export interface CaseOption {
  id: string;
  number: string;
  label: string;
  done: number;
}

/**
 * Comparison of the client's SAVED objects (cases). Each column is the same dossier report the client
 * sees on the case page — with completed legal/technical modules — so numbers match everywhere.
 */
export function CaseCompare({ options, selected, reports }: { options: CaseOption[]; selected: string[]; reports: Array<{ caseId: string; report: ReportData }> }) {
  const { dict, href } = useI18n();
  const d = dict.compare;
  const router = useRouter();
  const [pick, setPick] = useState<string[]>(selected);
  const firstPurpose = reports[0]?.report.brief?.purpose === "invest" ? "invest" : "live";
  const [purpose, setPurpose] = useState<"live" | "invest">(firstPurpose);
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current && reports.length >= 2) {
      tracked.current = true;
      track("comparison_created", { n: reports.length, source: "cases" });
    }
  }, [reports.length]);

  // The purpose only changes the weights of the "best fit" ranking; dossiers themselves don't change.
  const withPurpose = useMemo(() => reports.map(({ report }) => ({ ...report, brief: { priorities: [], ...report.brief, purpose } })), [reports, purpose]);
  const byProperty = useMemo(() => new Map(reports.map(({ caseId, report }) => [report.property.id, { caseId, opt: options.find((o) => o.id === caseId) }])), [reports, options]);

  const toggle = (id: string) => setPick((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 5 ? cur : [...cur, id]));
  const apply = () => router.push(href(`/compare?ids=${pick.join(",")}`));
  const changed = pick.join(",") !== selected.join(",");

  return (
    <div className="space-y-8">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">{d.myObjects}</p>
          <Link href={href("/check")} className="text-sm font-semibold text-brand">
            + {d.addObject}
          </Link>
        </div>
        <p className="mt-1 text-sm text-ink2">{d.pickHint}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((o) => (
            <li key={o.id}>
              <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", pick.includes(o.id) ? "border-brand bg-brand/5" : "border-line hover:border-ink2")}>
                <input type="checkbox" checked={pick.includes(o.id)} onChange={() => toggle(o.id)} className="mt-1" disabled={!pick.includes(o.id) && pick.length >= 5} />
                <span className="min-w-0">
                  <span className="num block text-xs text-ink2">
                    {o.number} · {dict.report.dossierCoverage} {o.done}/3
                  </span>
                  <span className="block truncate text-sm font-medium">{o.label}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={apply} disabled={!changed || pick.length < 2} className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brandink disabled:opacity-40">
            {d.recalc}
          </button>
          {pick.length < 2 && <span className="text-sm text-ink2">{d.pickMin}</span>}
          <span className="ml-auto flex gap-2">
            <Chip active={purpose === "live"} onClick={() => setPurpose("live")}>
              {d.briefLive}
            </Chip>
            <Chip active={purpose === "invest"} onClick={() => setPurpose("invest")}>
              {d.briefInvest}
            </Chip>
          </span>
        </div>
      </Card>

      {reports.length >= 2 ? (
        <CompareResults
          reports={withPurpose}
          nameOf={(pid) => byProperty.get(pid)?.opt?.number ?? "—"}
          sub={(r) => r.property.address ?? r.city.names.uk}
          href={(pid) => href(`/cases/${byProperty.get(pid)?.caseId}`)}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink2">{d.pickMin}</p>
      )}
    </div>
  );
}
