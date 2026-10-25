"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReportData } from "@/domain/report/build";
import { SCORE_WEIGHTS } from "@/domain/decision/scores";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { Collapse, motion } from "../motion";
import { useI18n } from "../providers";
import { ConfidenceMeter, RangeBar, ScoreRing } from "../ui/charts";
import { Button, Card, Pill, toneBg, toneBorder, toneText, toneVar } from "../ui/primitives";
import { ProvenanceBadge } from "../ui/provenance";
import { OrderPanel } from "./order-panel";
import { ChecksSection, DossierProgress } from "./checks";
import { saveReportToAccountAction } from "@/server/actions/ops";
import { InvestmentSection, LocationSection, QuestionsSection, SourcesSection, FutureSection } from "./report-modules";
import { priceTone, SectionShell, verdictTone, VerdictIcon } from "./shared";
import { ExplainedTerm, HelpTooltip } from "../ui/tooltip";
import { glossary, type GlossaryTerm } from "@/i18n/glossary";

const sectionIds = ["decision", "price", "scores", "location", "investment", "checks", "future", "sources"] as const;

export function ReportView({ report: r }: { report: ReportData }) {
  const { dict, lang, href } = useI18n();
  const d = dict.report;
  const [orderOpen, setOrderOpen] = useState<null | "inspection" | "legal" | "consult">(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("report_viewed", { sample: r.isSample, verdict: r.overall.verdict, stage: r.overall.stage });
  }, [r.isSample, r.overall.verdict, r.overall.stage]);

  const navLabels: Record<(typeof sectionIds)[number], string> = {
    decision: d.verdictLabel,
    price: d.sections.price,
    scores: d.sections.scores,
    location: d.sections.location,
    checks: d.sections.checks,
    investment: d.sections.investment,
    future: d.sections.future,
    sources: d.sections.sources,
  };

  const p = r.property;
  const district = r.city.districts.find((x) => x.id === p.districtId);
  const summary = [
    p.address,
    district && `${district.names[lang]}`,
    `${p.areaSqm} ${dict.common.sqm}`,
    p.rooms && `${p.rooms} ${lang === "uk" ? "к." : "rm"}`,
    p.floor !== undefined && p.floorsTotal ? `${p.floor}/${p.floorsTotal}` : undefined,
    p.yearBuilt,
  ].filter(Boolean);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be blocked */
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">
      <p className="print-only mb-4 text-sm">{d.printHeader}</p>

      {/* banners */}
      <div className="no-print mb-6 space-y-2">
        {r.isSample && <Banner tone="info">{d.sampleBanner}</Banner>}
        {r.dataMode === "demo" && <Banner tone="warn">{d.demoBanner}</Banner>}
        {r.dataMode === "live" && r.valuation.status === "ok" && <Banner tone="info">{d.liveDataBanner.replace("{n}", String(r.valuation.used.length))}</Banner>}
      </div>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.title}</p>
          <h1 className="display mt-2 text-3xl sm:text-5xl">{summary.slice(0, 2).join(" · ") || dict.nav.check}</h1>
          <p className="num mt-2 text-sm text-ink2">{summary.slice(2).join(" · ")}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              track("report_printed");
              window.print();
            }}
          >
            {d.actions.print}
          </Button>
          <Button variant="secondary" onClick={copyLink}>
            {copied ? d.actions.copied : d.actions.share}
          </Button>
          {!r.caseRef && !r.isSample && <SaveToAccount />}
        </div>
      </header>

      {/* sticky section nav */}
      <nav aria-label="Report sections" className="no-print sticky top-16 z-30 -mx-4 mb-8 overflow-x-auto border-b border-line bg-bg/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <ul className="flex gap-1 py-2 text-sm">
          {sectionIds.map((id) => (
            <li key={id}>
              <a href={`#${id}`} className="block whitespace-nowrap rounded-full px-3 py-1.5 text-ink2 hover:bg-surface2 hover:text-ink">
                {navLabels[id]}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-10">
        <DossierProgress r={r} />
        <DecisionCard r={r} onOrder={setOrderOpen} />
        <PriceSection r={r} />
        <ScoresSection r={r} />
        <LocationSection r={r} />
        <InvestmentSection r={r} />
        <ChecksSection r={r} onOrder={setOrderOpen} />
        <FutureSection r={r} />
        <QuestionsSection />
        <SourcesSection r={r} />
      </div>

      <div className="no-print mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-6">
        <p className="max-w-xl text-ink2">{dict.home.finalBody}</p>
        <div className="flex flex-wrap gap-2">
          <Link href={href("/compare")} className="rounded-full border border-line px-5 py-2.5 text-[15px] font-medium hover:border-ink2">
            {d.actions.compareAdd}
          </Link>
          <Button onClick={() => setOrderOpen("inspection")}>{d.actions.orderInspection}</Button>
        </div>
      </div>

      <OrderPanel open={orderOpen} onClose={() => setOrderOpen(null)} report={r} />
    </div>
  );
}

function Banner({ tone, children }: { tone: "info" | "warn" | "neutral"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border px-4 py-2.5 text-sm", toneBg[tone], toneBorder[tone])}>{children}</div>
  );
}

/* ---------------------------- DECISION ---------------------------- */
const MODULE_CODES = new Set(["inspection", "registry-extract"]);

function DecisionCard({ r, onOrder }: { r: ReportData; onOrder: (v: "inspection" | "legal" | "consult") => void }) {
  const { dict, m, money, missing } = useI18n();
  const d = dict.report;
  const v = r.overall.verdict;
  const tone = verdictTone[v];
  const val = r.valuation;
  const cur = r.property.currency;
  const prelim = r.overall.stage === "preliminary";
  const done = [r.modules.digital, r.modules.legal, r.modules.technical].filter((s) => s === "done").length;

  // Missing *inputs* only — missing checks are shown in the dossier block, not here.
  const missingCodes = useMemo(() => {
    const set = new Set<string>();
    r.scores.forEach((s) => s.value !== null && s.missing.forEach((c) => !MODULE_CODES.has(c) && set.add(c)));
    if (r.valuation.status === "ok") r.valuation.missing.forEach((x) => set.add(`attr.${x}`));
    return [...set].slice(0, 8);
  }, [r]);

  const act = (a: ReportData["overall"]["nextActions"][number]["action"]) => {
    if (a === "legal") onOrder("legal");
    else if (a === "inspection") onOrder("inspection");
    else if (a === "consult") onOrder("consult");
  };

  return (
    <section id="decision" className="scroll-mt-32">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={cn("overflow-hidden rounded-3xl border-2 bg-surface shadow-card", prelim && "border-dashed")}
        style={{ borderColor: toneVar[tone] }}
      >
        <div className="grid gap-0 lg:grid-cols-[1.25fr_1fr]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={tone}>
                <VerdictIcon verdict={v} size={14} /> {d.verdictShort[v]}
              </Pill>
              <Pill tone={prelim ? "info" : "good"}>{prelim ? d.stagePreliminary : d.stageComplete}</Pill>
            </div>
            <motion.h2
              className={cn("display mt-4 text-[clamp(2rem,4.6vw,3.4rem)]", toneText[tone])}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
            >
              {d.verdicts[v]}
            </motion.h2>
            <ul className="mt-5 space-y-2 text-ink">
              {r.overall.reasons.map((x) => (
                <li key={x.code} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: toneVar[tone] }} />
                  {m(x)}
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("flex flex-col justify-between gap-6 border-t p-6 sm:p-8 lg:border-l lg:border-t-0", toneBg[tone])} style={{ borderColor: "var(--line)" }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <ScoreRing value={Math.round(r.confidence.value * 100)} size={64} label={d.evidenceConfidence} />
                <p className="text-sm font-medium leading-snug"><ExplainedTerm term="evidenceConfidence">{d.evidenceConfidence}</ExplainedTerm></p>
              </div>
              <div>
                <p className="text-sm font-medium">{d.dossierCoverage}</p>
                <p className="num mt-1 text-2xl font-semibold">
                  {done}/3
                </p>
                <div className="mt-1.5 flex gap-1">
                  {[r.modules.digital, r.modules.legal, r.modules.technical].map((s, i) => (
                    <span key={i} className={cn("h-1.5 flex-1 rounded-full", s === "done" ? "bg-brand" : s === "in_progress" || s === "awaiting_assignment" ? "bg-brand/40" : "bg-line")} />
                  ))}
                </div>
              </div>
            </div>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-ink2">{d.fairPrice} <ProvenanceBadge kind="ESTIMATE" className="ml-1" /></dt>
                <dd className="num text-xl font-semibold">
                  {val.status === "ok" ? `${money(val.fairLow, cur)} – ${money(val.fairHigh, cur)}` : <span className="text-base font-normal text-ink2">{dict.common.notEnoughData}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-ink2">{d.negotiationRange} <ProvenanceBadge kind="INFERENCE" className="ml-1" /></dt>
                <dd className="num text-xl font-semibold">
                  {r.negotiation ? `${money(r.negotiation.opening, cur)} → ${money(r.negotiation.walkAway, cur)}` : <span className="text-base font-normal text-ink2">{dict.common.notEnoughData}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-ink2">{d.expectedRepair}</dt>
                <dd className="num text-xl font-semibold">
                  {r.repairs && r.repairs.counted > 0 ? `${money(r.repairs.low, cur)} – ${money(r.repairs.high, cur)}` : <span className="text-base font-normal text-ink2">{d.repairAfterInspection}</span>}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {prelim && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface2/60 px-6 py-4 sm:px-8">
            <p className="max-w-2xl text-sm">
              <span className="font-semibold">{d.prelimNoteTitle} </span>
              {d.prelimNote}
            </p>
            <a href="#checks" className="no-print text-sm font-semibold text-brand hover:underline">
              {d.prelimNoteCta} ↓
            </a>
          </div>
        )}

        <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
          <div className="bg-surface p-6 sm:p-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-good">{d.strengths}</h3>
            {r.overall.strengths.length ? (
              <ol className="space-y-2.5">
                {r.overall.strengths.map((x, i) => (
                  <motion.li key={x.code} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }} className="flex gap-3">
                    <span className="num text-good">{i + 1}</span>
                    {m(x)}
                  </motion.li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink2">{d.noneYet}</p>
            )}
          </div>
          <div className="bg-surface p-6 sm:p-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-bad">{d.risks}</h3>
            {r.overall.risks.length ? (
              <ol className="space-y-2.5">
                {r.overall.risks.map((x, i) => (
                  <motion.li key={x.code} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.1 }} className="flex gap-3">
                    <span className="num text-bad">{i + 1}</span>
                    {m(x)}
                  </motion.li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink2">{prelim ? d.noRisksYet : d.noneYet}</p>
            )}
          </div>
          <div className="bg-surface p-6 sm:p-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink2">{d.missingInfo}</h3>
            {missingCodes.length ? (
              <ul className="flex flex-wrap gap-2">
                {missingCodes.map((c) => (
                  <li key={c} className="missing-box rounded-lg px-2.5 py-1 text-sm">
                    {missing(c)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink2">{d.inputsComplete}</p>
            )}
          </div>
          <div className="bg-surface p-6 sm:p-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand">{d.nextActions}</h3>
            <ol className="space-y-2.5">
              {r.overall.nextActions.map((x, i) => (
                <li key={x.code} className="flex gap-3">
                  <span className="num text-brand">{i + 1}</span>
                  <span>
                    {m(x)}
                    {(x.action === "legal" || x.action === "inspection" || x.action === "consult") && (
                      <button type="button" onClick={() => act(x.action)} className="no-print ml-2 text-sm font-semibold text-brand underline-offset-2 hover:underline">
                        {x.action === "legal" ? d.actions.orderLegal : x.action === "inspection" ? d.actions.orderInspection : d.actions.consult} →
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ------------------------------ PRICE ------------------------------ */
function PriceSection({ r }: { r: ReportData }) {
  const { dict, lang, m, money, moneyExact, currency, num, f } = useI18n();
  const d = dict.report;
  const [showComps, setShowComps] = useState(false);
  const v = r.valuation;
  const cur = r.property.currency;
  const tone = priceTone[r.price.verdict];

  return (
    <SectionShell id="price" title={d.sections.price} right={<ProvenanceBadge kind="ESTIMATE" />}>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={tone}>{d.priceVerdicts[r.price.verdict]}</Pill>
            <p className="text-sm text-ink2">{m(r.price.reason)}</p>
          </div>

          {v.status === "ok" ? (
            <>
              <div className="mt-8 px-1 pb-2">
                <RangeBar
                  low={v.fairLow}
                  high={v.fairHigh}
                  mid={v.fairMid}
                  currency={cur}
                  height={120}
                  markers={[
                    { value: r.property.askingPrice, label: d.price.ask, tone: tone === "neutral" ? "info" : tone },
                    ...(r.negotiation ? [{ value: r.negotiation.opening, label: d.nego.opening, tone: "good" as const }] : []),
                  ]}
                />
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-4">
                <Stat label={d.price.ask} value={money(r.property.askingPrice, cur)} sub={currency !== cur ? `${d.price.inListing}: ${moneyExact(r.property.askingPrice, cur)}` : undefined} />
                <Stat term="fairRange" label={d.price.fairRange} value={`${money(v.fairLow, cur)} – ${money(v.fairHigh, cur)}`} />
                <Stat label={d.price.askPerSqm} value={`${money(v.askPerSqmLow, cur)} – ${money(v.askPerSqmHigh, cur)}`} />
                <Stat label={`${d.price.ask} / ${dict.common.sqm}`} value={money(Math.round(r.property.askingPrice / r.property.areaSqm), cur)} />
              </dl>
              <p className="mt-5 rounded-lg bg-surface2 px-3 py-2 text-xs text-ink2">{d.price.notAppraisal}</p>
            </>
          ) : (
            <div className="missing-box mt-6 rounded-xl p-6 text-center">
              <p className="font-semibold">{d.price.insufficientTitle}</p>
              <p className="mt-1 text-sm text-ink2">{m(r.price.reason)}</p>
              {v.missing.length > 0 && <p className="mt-2 text-xs text-ink2">{dict.report.missingInfo}: {v.missing.map((x) => dict.msg[`attr.${x}` as keyof typeof dict.msg]).join(", ")}</p>}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-semibold"><ExplainedTerm term="confidence">{d.price.confidence}</ExplainedTerm></h3>
          {v.status === "ok" ? (
            <>
              <ConfidenceMeter
                value={v.confidence.overall}
                components={v.confidence.components.map((c) => ({
                  label: d.price.conf[c.id],
                  term: c.id === "dispersion" ? "iqr" : c.id,
                  score: c.score,
                  detail:
                    c.id === "count"
                      ? `${c.detail.found}`
                      : c.id === "dispersion"
                        ? `IQR ${c.detail.iqrPct}%`
                        : c.id === "freshness"
                          ? `${c.detail.medianAgeDays} ${dict.common.days}`
                          : `${c.detail.provided}/${c.detail.of}`,
                }))}
              />
              {v.confidence.calibrationFactor < 1 && (
                <p className="mt-4 text-xs text-ink2"><ExplainedTerm term="calibration">{f(d.price.calibration, { pct: num((1 - v.confidence.calibrationFactor) * 100) })}</ExplainedTerm></p>
              )}
              <p className="mt-2 text-xs text-ink2">
                {f(d.price.freshness, { days: v.medianCompAgeDays })} · {f(d.price.method, { name: v.method.name, version: v.method.version })}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink2">{dict.common.notEnoughData}</p>
          )}
        </Card>
      </div>

      {v.status === "ok" && (
        <div className="no-print mt-4">
          <button
            type="button"
            aria-expanded={showComps}
            aria-controls="comps-table"
            onClick={() => setShowComps((s) => !s)}
            className="text-sm font-semibold text-brand hover:underline"
          >
            {f(d.price.comps, { n: v.used.length })} · {showComps ? dict.common.collapse : d.price.compsOpen}
          </button>
          <Collapse open={showComps} id="comps-table">
            <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="num w-full text-left text-sm">
                <thead className="border-b border-line text-xs text-ink2">
                  <tr>
                    <th className="p-3 font-medium">{d.price.tableComp}</th>
                    <th className="p-3 font-medium">{d.price.tableDistrict}</th>
                    <th className="p-3 font-medium">{d.price.tableArea}</th>
                    <th className="p-3 font-medium"><ExplainedTerm term="adjustedPrice">{d.price.tableAdj}</ExplainedTerm></th>
                    <th className="p-3 font-medium"><ExplainedTerm term="compWeight">{d.price.tableWeight}</ExplainedTerm></th>
                  </tr>
                </thead>
                <tbody>
                  {v.used.slice(0, 12).map((u) => (
                    <tr key={u.comp.id} className="border-b border-line/60 last:border-0">
                      <td className="p-3 text-ink2">{u.comp.id.replace("demo-", "")}</td>
                      <td className="p-3">{districtName(r, u.comp.districtId, lang)}</td>
                      <td className="p-3">{u.comp.areaSqm}</td>
                      <td className="p-3">{money(Math.round(u.adjustedPricePerSqm), cur)}</td>
                      <td className="p-3">
                        <span className="inline-block h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(6, u.weight * 60)}px` }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapse>
        </div>
      )}

      {/* negotiation */}
      <div className="mt-8" id="negotiation">
        <h3 className="mb-3 font-semibold">{d.sections.negotiation}</h3>
        {r.negotiation ? (
          <Card>
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label={d.nego.ask} value={money(r.negotiation.ask, cur)} />
              <Stat label={d.nego.fair} value={`${money(r.negotiation.fairLow, cur)} – ${money(r.negotiation.fairHigh, cur)}`} />
              <Stat term="opening" label={d.nego.opening} value={money(r.negotiation.opening, cur)} emphasis="good" />
              <Stat term="walkAway" label={d.nego.walkAway} value={money(r.negotiation.walkAway, cur)} />
            </div>
            <p className="mt-4 text-xs text-ink2">
              {d.nego.basis}: {r.negotiation.basis.map((b) => m(b)).join(" ")} <ProvenanceBadge kind="INFERENCE" className="ml-1" />
            </p>
          </Card>
        ) : (
          <div className="missing-box rounded-xl p-5 text-sm text-ink2">{r.price.verdict === "UNDERPRICED" ? d.nego.noneUnderpriced : d.nego.none}</div>
        )}
      </div>
    </SectionShell>
  );
}

function Stat({ label, value, emphasis, sub, term }: { label: string; value: string; emphasis?: "good"; sub?: string; term?: GlossaryTerm }) {
  return (
    <div>
      <dt className="text-xs text-ink2">{term ? <ExplainedTerm term={term}>{label}</ExplainedTerm> : label}</dt>
      <dd className={cn("num mt-0.5 text-base font-semibold", emphasis === "good" && "text-good")}>{value}</dd>
      {sub && <dd className="num text-xs text-ink2">{sub}</dd>}
    </div>
  );
}

function districtName(r: ReportData, id: string, lang: "uk" | "en") {
  return r.city.districts.find((x) => x.id === id)?.names[lang] ?? id;
}

/* ------------------------------ SCORES ------------------------------ */
function ScoresSection({ r }: { r: ReportData }) {
  const { dict, lang, m, missing } = useI18n();
  const d = dict.report;
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <SectionShell id="scores" title={d.sections.scores} right={<ExplainedTerm term="score">{lang === "uk" ? "Як читати бали" : "How to read scores"}</ExplainedTerm>}>
      <Card className="divide-y divide-line !p-0">
        {r.scores.filter((s) => !((s.id === "legal" || s.id === "technical") && s.value === null)).map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`score-${s.id}`}
                onClick={() => setOpenId(open ? null : s.id)}
                className="flex w-full items-center gap-4 text-left"
              >
                <ScoreRing value={s.value} size={60} label={d.scores.names[s.id]} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{d.scores.names[s.id]}</p>
                    <ProvenanceBadge kind={s.kind} interactive={false} />
                    <span className="num text-xs text-ink2">{Math.round(SCORE_WEIGHTS[s.id] * 100)}%</span>
                  </div>
                  <p className="text-sm text-ink2">{s.value === null ? d.scores.nullLabel : d.scores.hints[s.id]}</p>
                </div>
                <motion.span animate={{ rotate: open ? 180 : 0 }} aria-hidden className={cn("text-ink2", s.value === null && "opacity-60")}>
                  ▾
                </motion.span>
              </button>
              <HelpTooltip label={`${lang === "uk" ? "Вага показника" : "Indicator weight"}: ${d.scores.names[s.id]}`}>{glossary[lang].scoreWeight} {dict.kinds[`${s.kind}_HINT`]}</HelpTooltip>
              </div>
              <Collapse open={open} id={`score-${s.id}`}>
                <div className="pb-1 pl-0 pt-4 sm:pl-[76px]">
                  <p className="text-sm text-ink2">{d.scores.hints[s.id]}</p>
                  {s.drivers.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-ink2">{d.scores.driversTitle}</p>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {s.drivers.map((x, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className={cn("num w-10 shrink-0 text-right", x.delta >= 0 ? "text-good" : "text-bad")}>{x.delta > 0 ? "+" : ""}{x.delta || ""}</span>
                            <span>{m(x)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {s.value !== null && <p className="num mt-3 text-xs text-ink2">{dict.report.scores.confidence.replace("{pct}", String(Math.round(s.confidence * 100)))}</p>}
                  {s.missing.length > 0 && (
                    <p className="mt-3 text-sm">
                      <span className="text-ink2">{d.scores.missingLabel}</span>
                      {s.missing.map((c) => missing(c)).join(", ")}
                    </p>
                  )}
                </div>
              </Collapse>
            </div>
          );
        })}
      </Card>
    </SectionShell>
  );
}

/** Anonymous preview → a case in the client's account (login/registration first if needed). */
function SaveToAccount() {
  const { dict, lang } = useI18n();
  const [q, setQ] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the URL after hydration
    setQ(window.location.search.slice(1));
  }, []);
  return (
    <form action={saveReportToAccountAction}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="query" value={q} />
      <Button type="submit" disabled={!q}>
        {dict.account.saveToAccount}
      </Button>
    </form>
  );
}
