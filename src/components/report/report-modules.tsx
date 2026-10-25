"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SOURCES } from "@/domain/provenance";
import type { InspectionIssue, Severity } from "@/domain/inspection";
import type { ReportData } from "@/domain/report/build";
import type { DistrictProfile } from "@/domain/location/types";
import { cn } from "@/lib/cn";
import { Collapse, CountUp, motion, useReducedMotion, EASE } from "../motion";
import { useI18n } from "../providers";
import { Button, Card, Chip, Pill, toneBg, toneText, toneVar } from "../ui/primitives";
import { ProvenanceBadge } from "../ui/provenance";
import { legalTone, SectionShell, severityTone } from "./shared";
import { LocationExplorer } from "../map/location-explorer";
import { IssueVisual } from "../inspection/issue-visual";
import { ExplainedTerm, TechnicalText } from "../ui/tooltip";
import type { GlossaryTerm } from "@/i18n/glossary";


/* ------------------------------- LEGAL ------------------------------- */
export function LegalSection({ r, onOrder }: { r: ReportData; onOrder: () => void }) {
  const { dict, lang } = useI18n();
  const d = dict.report;
  const allUnknown = r.legal.every((l) => l.status === "unknown");
  return (
    <SectionShell id="legal" title={d.sections.legal} lead={d.legal.lead} right={<Pill tone="warn">{d.legal.requiresReview}</Pill>}>
      <Card className="!p-0">
        <ul className="divide-y divide-line">
          {r.legal.map((c, i) => {
            const tone = legalTone[c.status];
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={c.status === "unknown" ? { border: "2px dashed var(--ink-2)" } : { background: toneVar[tone] }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.legal.checks[c.id]}</p>
                  {c.note && <p className="mt-0.5 text-sm text-ink2">{c.note[lang]}</p>}
                  <p className="mt-0.5 text-xs text-ink2">{dict.report.legal.source.replace("{source}", SOURCES[c.sourceId]?.name ?? c.sourceId)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {c.kind && <ProvenanceBadge kind={c.kind} />}
                  <Pill tone={tone}>{d.legal.status[c.status]}</Pill>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </Card>
      {allUnknown && (
        <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line p-4">
          <p className="max-w-xl text-sm text-ink2">{d.legal.pendingBody}</p>
          <Button variant="secondary" onClick={onOrder}>
            {d.actions.orderLegal}
          </Button>
        </div>
      )}
    </SectionShell>
  );
}

/* ------------------------------ TECHNICAL ------------------------------ */
export function IssueCard({ issue, defaultOpen = false }: { issue: InspectionIssue; defaultOpen?: boolean }) {
  const { dict, lang, money } = useI18n();
  const t = dict.report.technical.issue;
  const [open, setOpen] = useState(defaultOpen);
  const tone = severityTone[issue.severity];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface" style={{ borderLeft: `4px solid ${toneVar[tone]}` }}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <Pill tone={tone}>{dict.enums.severity[issue.severity]}</Pill>
        <span className="min-w-0 flex-1 font-medium">{issue.title[lang]}</span>
        {issue.repair && (
          <span className="num hidden text-sm text-ink2 sm:inline">
            {money(issue.repair.low, issue.repair.currency)}–{money(issue.repair.high, issue.repair.currency)}
          </span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} aria-hidden className="text-ink2">
          ▾
        </motion.span>
      </button>
      <Collapse open={open}>
        <div className="grid gap-5 px-4 pb-5 pt-1 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-[15px]"><TechnicalText>{issue.explanation[lang]}</TechnicalText></p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink2">{t.risk}</dt>
                <dd className={cn("font-semibold", toneText[tone])}>{dict.enums.severity[issue.severity]}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink2">{t.urgency}</dt>
                <dd className="font-medium">{dict.enums.urgency[issue.urgency]}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink2">{t.specialist}</dt>
                <dd className="font-medium">{dict.inspection.specialistNames[issue.specialist]}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink2"><ExplainedTerm term="leverage">{t.leverage}</ExplainedTerm></dt>
                <dd className="font-medium">{dict.enums.leverage[issue.negotiation]}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink2">{t.repair} <ProvenanceBadge kind="ESTIMATE" className="ml-1" /></dt>
                <dd className="num font-medium">
                  {issue.repair ? `${money(issue.repair.low, issue.repair.currency)} – ${money(issue.repair.high, issue.repair.currency)}` : <span className="font-sans text-ink2">{t.noRepair}</span>}
                </dd>
              </div>
            </dl>
            {issue.repair && (
              <p className="mt-3 text-xs text-ink2">
                {t.assumption}: <TechnicalText>{issue.repair.assumption[lang]}</TechnicalText>
                <br />
                <ExplainedTerm term="repairConfidence">{t.source.replace("{source}", SOURCES[issue.repair.sourceId]?.name ?? issue.repair.sourceId).replace("{pct}", String(Math.round(issue.repair.confidence * 100))).replace("{asOf}", issue.repair.asOf)}</ExplainedTerm>
              </p>
            )}
          </div>
          {open && <IssueVisual issue={issue} />}
        </div>
      </Collapse>
    </div>
  );
}

export function TechnicalSection({ r, onOrder }: { r: ReportData; onOrder: () => void }) {
  const { dict, m, money, f } = useI18n();
  const d = dict.report;
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const issues = r.issues;
  const shown = useMemo(() => (issues ? issues.filter((i) => filter === "all" || i.severity === filter).sort((a, b) => order(b.severity) - order(a.severity)) : []), [issues, filter]);

  return (
    <SectionShell id="technical" title={d.sections.technical} lead={d.technical.lead} right={<ProvenanceBadge kind={issues ? "FACT" : "INFERENCE"} />}>
      {issues ? (
        <>
          {r.repairs && (
            <Card className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-ink2">{d.technical.repairTotal} <ProvenanceBadge kind="ESTIMATE" className="ml-1" /></p>
                <p className="num text-2xl font-semibold">
                  <CountUp value={r.repairs.low} format={(n) => money(Math.round(n), r.property.currency)} /> – <CountUp value={r.repairs.high} format={(n) => money(Math.round(n), r.property.currency)} />
                </p>
                <p className="mt-1 max-w-xl text-xs text-ink2">{d.technical.repairNote}</p>
              </div>
              {r.repairs.uncosted > 0 && <Pill tone="neutral">{f(d.technical.uncosted, { n: r.repairs.uncosted })}</Pill>}
            </Card>
          )}
          <div className="no-print mb-3 flex flex-wrap gap-2">
            {(["all", "red", "yellow", "green"] as const).map((k) => (
              <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                {d.technical.filter[k]} {k === "all" ? issues.length : issues.filter((i) => i.severity === k).length}
              </Chip>
            ))}
          </div>
          <div className="space-y-2.5">
            {shown.map((i, idx) => (
              <IssueCard key={i.id} issue={i} defaultOpen={idx === 0 && filter === "all"} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="missing-box rounded-2xl p-6">
            <p className="text-lg font-semibold">{d.technical.pendingTitle}</p>
            <p className="mt-2 text-sm text-ink2">{d.technical.pendingBody}</p>
            <Button className="no-print mt-5" onClick={onOrder}>
              {d.technical.order}
            </Button>
          </div>
          <Card>
            <p className="font-semibold">{d.technical.watchTitle}</p>
            <p className="mb-3 text-xs text-ink2">{d.technical.watchNote} <ProvenanceBadge kind="INFERENCE" className="ml-1" /></p>
            {r.watchlist.length ? (
              <ul className="space-y-2.5 text-sm">
                {r.watchlist.map((w) => (
                  <li key={w.code} className="flex gap-2.5">
                    <span className="mt-0.5 shrink-0 rounded bg-surface2 px-1.5 text-[11px] font-medium text-ink2">{dict.inspection.sections[w.section]}</span>
                    <span>{m(w)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink2">—</p>
            )}
          </Card>
        </div>
      )}
    </SectionShell>
  );
}
const order = (s: Severity) => (s === "red" ? 3 : s === "yellow" ? 2 : 1);

/* ------------------------------- LOCATION ------------------------------- */
const INDICATORS: Array<Exclude<keyof DistrictProfile, "oldStock">> = ["transit", "schools", "shops", "parks", "quiet", "parking", "business"];

export function LocationSection({ r }: { r: ReportData }) {
  const { dict, lang, m, href, f, num } = useI18n();
  const d = dict.report;
  const reduce = useReducedMotion();
  const district = r.city.districts.find((x) => x.id === r.property.districtId);
  const lifestyle = r.scores.find((s) => s.id === "lifestyle");
  const ind = r.indicators;
  const loc = r.location;
  const levelLabel = ind ? d.location.levels[ind.level] : "";
  const counts = loc?.facts.counts ?? {};
  const point = loc?.point ?? r.property.coords ?? district?.center ?? r.city.center;
  const precise = loc?.level === "address" || !!r.property.coords;
  const layers = useMemo(
    () => ({
      subject: { point, precise },
      comps: r.valuation.status === "ok" ? r.valuation.used.filter((u) => u.comp.coords).slice(0, 40).map((u) => ({ point: u.comp.coords as [number, number], weight: u.weight })) : [],
      pois: (loc?.pois ?? []).map((p) => ({ point: [p.lng, p.lat] as [number, number] })),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r],
  );
  return (
    <SectionShell id="location" title={d.sections.location} lead={loc ? d.location.leadLive : d.location.lead} right={<ProvenanceBadge kind="INFERENCE" />}>
      <LocationExplorer subject={layers.subject} places={loc?.nearest ?? []} comps={layers.comps} pois={layers.pois} className="shadow-card" />
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-ink2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand" /> {d.location.legendObject}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-info/70" /> {r.dataMode === "live" ? d.location.legendCompsLive : d.location.legendComps}</span>
            {loc && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink/60" /> {d.location.legendPoi}</span>}
            <span className="ml-auto">{d.location.mapAttribution}</span>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="font-semibold">{district ? district.names[lang] : r.city.names[lang]}</p>
            <span className="text-xs text-ink2">{levelLabel}</span>
          </div>
          {loc?.geocoded && <p className="mb-3 line-clamp-2 text-xs text-ink2">{loc.geocoded.label}</p>}
          {ind ? (
            <ul className="mt-3 space-y-3">
              {INDICATORS.map((k, i) => (
                <li key={k}>
                  <div className="flex justify-between text-sm">
                    <span><ExplainedTerm term="locationScore">{d.location.indicators[k]}</ExplainedTerm></span>
                    <span className="num text-ink2">{ind.values[k] === null ? dict.common.notEnoughData : `${ind.values[k]} / 100`}</span>
                  </div>
                  <div className={cn("mt-1 h-1.5 overflow-hidden rounded-full bg-surface2", ind.values[k] === null && "missing-box")}>
                    {ind.values[k] !== null && (
                      <motion.div
                        className="h-full rounded-full bg-brand"
                        initial={{ width: reduce ? `${ind.values[k]}%` : 0 }}
                        whileInView={{ width: `${ind.values[k]}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: i * 0.05, ease: EASE }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="missing-box rounded-xl p-4 text-sm text-ink2">{d.location.noDistrict}</div>
          )}
        </Card>
      {loc && (
        <div className="grid content-start gap-3 sm:grid-cols-2">
          <Fact label={d.location.facts.schools} value={`${(counts.school ?? 0) + (counts.kindergarten ?? 0)}`} hint={f(d.location.facts.within, { m: 1000 })} />
          <Fact label={d.location.facts.transit} value={`${counts.transit ?? 0}`} hint={loc.facts.nearestM.transit !== undefined ? f(d.location.facts.nearest, { m: loc.facts.nearestM.transit }) : f(d.location.facts.within, { m: 500 })} />
          <Fact label={d.location.facts.road} value={loc.facts.majorRoadM === null ? "> 300 m" : `${loc.facts.majorRoadM} m`} hint={d.location.facts.roadHint} />
          {loc.travel ? (
            <Fact label={d.location.facts.centre} value={`${num(loc.travel.toCentreKm, 1)} km`} hint={f(d.location.facts.travel, { walk: loc.travel.walkMin, drive: loc.travel.driveMin })} estimate />
          ) : (
            <Fact label={d.location.facts.health} value={`${counts.health ?? 0}`} hint={f(d.location.facts.within, { m: 1000 })} />
          )}
        </div>
      )}
      </div>

      <div className="mt-6" id="lifestyle">
        <h3 className="mb-1 font-semibold">{d.sections.lifestyle}</h3>
        <p className="mb-3 text-sm text-ink2">{d.lifestyle.lead}</p>
        {lifestyle && lifestyle.value !== null ? (
          <Card>
            <div className="flex items-baseline gap-3">
              <span className="num text-3xl font-semibold">{lifestyle.value}</span>
              <span className="text-sm text-ink2"><ExplainedTerm term="score">/ 100</ExplainedTerm></span>
              <ProvenanceBadge kind="INFERENCE" />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {lifestyle.drivers.map((x, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className={cn("num w-10 text-right", x.delta >= 0 ? "text-good" : "text-bad")}>{x.delta > 0 ? "+" : ""}{x.delta}</span>
                  <span>{m(x)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <div className="missing-box flex flex-wrap items-center justify-between gap-3 rounded-xl p-5">
            <p className="text-sm text-ink2">{d.lifestyle.noBrief}</p>
            <Link href={href("/brief")} className="no-print rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium hover:border-ink2">
              {d.lifestyle.fillBrief}
            </Link>
          </div>
        )}
      </div>
    </SectionShell>
  );
}

/* ------------------------------ INVESTMENT ------------------------------ */
export function InvestmentSection({ r }: { r: ReportData }) {
  const { dict, money, num, f } = useI18n();
  const d = dict.report;
  const inv = r.investment;
  const [sid, setSid] = useState<"conservative" | "base" | "optimistic">("base");
  const sc = inv.scenarios.find((s) => s.id === sid);
  const cur = inv.currency;
  const maxY = Math.max(8, ...inv.scenarios.map((s) => s.netYieldPct));
  return (
    <SectionShell id="investment" title={d.sections.investment} lead={d.investment.lead} right={<ProvenanceBadge kind="ESTIMATE" />}>
      {inv.status !== "ok" || !sc ? (
        <div className="missing-box rounded-xl p-5 text-sm text-ink2">{d.investment.insufficient}</div>
      ) : (
        <Card>
          <div role="tablist" aria-label={d.sections.investment} className="no-print mb-6 flex flex-wrap gap-2">
            {inv.scenarios.map((s) => (
              <Chip key={s.id} active={s.id === sid} role="tab" aria-selected={s.id === sid} onClick={() => setSid(s.id)}>
                {d.investment.scenarios[s.id]}
              </Chip>
            ))}
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <Metric label={d.investment.rent} value={money(sc.monthlyRent, cur)} k={sid + "a"} />
              <Metric term="vacancy" label={d.investment.vacancy} value={`${num(sc.vacancyPct)}%`} k={sid + "b"} />
              <Metric term="appreciation" label={d.investment.appreciation} value={`${num(sc.appreciationPctYear, 1)}%`} k={sid + "c"} />
              <Metric term="gross" label={d.investment.gross} value={`${num(sc.grossYieldPct, 1)}%`} k={sid + "d"} />
              <Metric term="net" label={d.investment.net} value={`${num(sc.netYieldPct, 1)}%`} k={sid + "e"} strong />
              <Metric term="cashflow" label={d.investment.cashflow} value={money(sc.annualNetCashflow, cur)} k={sid + "f"} />
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-ink2"><ExplainedTerm term="totalReturn">{d.investment.total5}</ExplainedTerm></dt>
                <dd className={cn("num text-3xl font-semibold", sc.totalReturn5y >= 0 ? "text-good" : "text-bad")}>
                  {money(sc.totalReturn5y, cur)} <span className="text-base text-ink2">({num(sc.totalReturn5yPct, 1)}%)</span>
                </dd>
              </div>
            </dl>
            <div>
              <p className="mb-3 text-xs text-ink2"><ExplainedTerm term="net">{d.investment.net}</ExplainedTerm></p>
              <div className="flex h-40 items-end gap-5">
                {inv.scenarios.map((s) => (
                  <div key={s.id} className="flex flex-1 flex-col items-center gap-2">
                    <span className="num text-xs">{num(s.netYieldPct, 1)}%</span>
                    <motion.div
                      className={cn("w-full rounded-t-md", s.id === sid ? "bg-brand" : "bg-brand/30")}
                      initial={{ height: 0 }}
                      animate={{ height: `${(Math.max(s.netYieldPct, 0.3) / maxY) * 100}%` }}
                      transition={{ duration: 0.7, ease: EASE }}
                    />
                    <span className="text-center text-[11px] text-ink2">{d.investment.scenarios[s.id]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {inv.resort && <p className="mt-6 rounded-lg bg-warnbg px-3 py-2 text-sm">{d.investment.resortNote}</p>}
          <p className="mt-6 border-t border-line pt-4 text-xs text-ink2">
            {d.investment.rentBasis[inv.rentBasis]}{" "}
            {f(d.investment.assumptions, {
              m: inv.assumptions.maintenancePctPrice * 100,
              mg: inv.assumptions.managementPctRent * 100,
              t: inv.assumptions.taxPctRent * 100,
              capex: inv.capex ? money(Math.round(inv.capex), cur) : d.investment.capexNone,
            })}
          </p>
        </Card>
      )}
    </SectionShell>
  );
}

function Metric({ label, value, k, strong, term }: { label: string; value: string; k: string; strong?: boolean; term?: GlossaryTerm }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <dt className="text-xs text-ink2">{term ? <ExplainedTerm term={term}>{label}</ExplainedTerm> : label}</dt>
      <dd className={cn("num mt-0.5", strong ? "text-2xl font-semibold text-brand" : "text-lg font-medium")}>{value}</dd>
    </motion.div>
  );
}

/* ------------------------------- FUTURE ------------------------------- */
export function FutureSection({ r }: { r: ReportData }) {
  const { dict } = useI18n();
  const d = dict.report.future;
  void r;
  return (
    <SectionShell id="future" title={dict.report.sections.future} lead={d.lead}>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.items.map((x) => (
          <div key={x} className="missing-box flex items-center justify-between gap-3 rounded-xl p-4">
            <span className="font-medium">{x}</span>
            <span className="text-xs text-ink2">{d.status}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink2">{d.pending}</p>
    </SectionShell>
  );
}

/* ------------------------------ QUESTIONS ------------------------------ */
export function QuestionsSection() {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <section className="no-print">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-6 py-4 text-left font-semibold">
        {dict.questions.title}
        <span aria-hidden>{open ? "–" : "+"}</span>
      </button>
      <Collapse open={open}>
        <ol className="list-decimal space-y-2 px-10 py-5 text-[15px]">
          {dict.questions.items.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </Collapse>
    </section>
  );
}

/* ------------------------------- SOURCES ------------------------------- */
function Fact({ label, value, hint, estimate }: { label: string; value: string; hint?: string; estimate?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-ink2">{label} <ProvenanceBadge kind={estimate ? "ESTIMATE" : "FACT"} /></p>
      <p className="num mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink2">{hint}</p>}
    </div>
  );
}

const STATUS_TONE: Record<string, "good" | "info" | "warn" | "bad" | "neutral"> = {
  live: "good",
  demo: "info",
  fallback: "warn",
  "not-configured": "neutral",
  "not-connected": "neutral",
  error: "bad",
};

export function SourcesSection({ r }: { r: ReportData }) {
  const { dict } = useI18n();
  const d = dict.report;
  const rows = [...r.sources];
  if (r.issues) rows.push({ sourceId: "inspection", status: "demo" });
  r.legal.forEach((l) => {
    if (l.status !== "unknown" && !rows.some((x) => x.sourceId === l.sourceId)) rows.push({ sourceId: l.sourceId, status: r.isSample ? "demo" : "live" });
  });
  const present = new Set(rows.map((x) => x.sourceId));
  const notConnected = r.city.dataSourceIds.filter((id) => !present.has(id));
  // Fixed UTC format: identical on server and client (no hydration mismatch from time zones).
  const fmtTime = (iso?: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "");
  return (
    <SectionShell id="sources" title={d.sections.sources} lead={d.sources.lead}>
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold">{d.sources.used}</h3>
          <ul className="space-y-2.5 text-sm">
            {rows.map((x, i) => (
              <li key={x.sourceId + i} className="flex items-start justify-between gap-3">
                <span>
                  {SOURCES[x.sourceId]?.name ?? x.sourceId}
                  {(x.detail || x.fetchedAt) && <span className="block text-xs text-ink2">{[x.detail, fmtTime(x.fetchedAt)].filter(Boolean).join(" · ")}</span>}
                </span>
                <Pill tone={STATUS_TONE[x.status] ?? "neutral"}>{d.sources.status[x.status]}</Pill>
              </li>
            ))}
          </ul>
          {notConnected.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 font-semibold">{d.sources.notConnected}</h3>
              <ul className="space-y-2 text-sm text-ink2">
                {notConnected.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3">
                    <span>{SOURCES[id]?.name ?? id}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", toneBg.neutral)}>{d.sources.status["not-connected"]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.city.valuation.benchmark && r.dataMode === "demo" && (
            <p className="mt-5 border-t border-line pt-3 text-xs text-ink2">
              {d.sources.benchmark}: {r.city.valuation.benchmark.note}{" "}
              {r.city.valuation.benchmark.url && (
                <a className="underline" href={r.city.valuation.benchmark.url} target="_blank" rel="noreferrer">
                  ↗
                </a>
              )}
            </p>
          )}
        </Card>
        <Card>
          <ul className="space-y-3 text-sm text-ink2">
            {d.sources.disclaimers.map((x) => (
              <li key={x} className="flex gap-2.5">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
                {x}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </SectionShell>
  );
}
