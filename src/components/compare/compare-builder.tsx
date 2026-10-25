"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COMPARE_PROPERTIES } from "@/data/samples";
import { PRIORITIES, type Priority } from "@/domain/brief";
import { bestFit } from "@/domain/report/compare";
import type { ReportData } from "@/domain/report/build";
import { BUILDING_TYPES, CONDITIONS, type Property } from "@/domain/property/types";
import { getCityOrDefault } from "@/domain/location/registry";
import { legalSummary } from "@/domain/legal";
import { reportsForProperties } from "@/lib/report-service";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { motion, EASE } from "../motion";
import { useI18n } from "../providers";
import { ScoreRing } from "../ui/charts";
import { Button, Card, Chip, Field, Input, Pill, Select } from "../ui/primitives";
import { NumberInput } from "../ui/number-input";
import { priceTone, verdictTone } from "../report/shared";

interface Draft {
  id: string;
  districtId: string;
  askingPrice: string;
  areaSqm: string;
  rooms: string;
  floor: string;
  floorsTotal: string;
  yearBuilt: string;
  condition: string;
  buildingType: string;
}

const toDraft = (p: Property): Draft => ({
  id: p.id,
  districtId: p.districtId ?? "",
  askingPrice: String(p.askingPrice),
  areaSqm: String(p.areaSqm),
  rooms: p.rooms ? String(p.rooms) : "",
  floor: p.floor !== undefined ? String(p.floor) : "",
  floorsTotal: p.floorsTotal ? String(p.floorsTotal) : "",
  yearBuilt: p.yearBuilt ? String(p.yearBuilt) : "",
  condition: p.condition ?? "",
  buildingType: p.buildingType ?? "",
});

const n = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));

function toProperty(d: Draft, cityId: string, currency: string): Property | null {
  const ask = n(d.askingPrice);
  const area = n(d.areaSqm);
  if (!ask || !area || ask < 1000 || area < 10) return null;
  return {
    id: d.id,
    class: "residential",
    subtype: "apartment",
    cityId,
    districtId: d.districtId || undefined,
    market: "secondary",
    askingPrice: ask,
    currency,
    areaSqm: area,
    rooms: n(d.rooms),
    floor: n(d.floor),
    floorsTotal: n(d.floorsTotal),
    yearBuilt: n(d.yearBuilt),
    condition: (d.condition || undefined) as Property["condition"],
    buildingType: (d.buildingType || undefined) as Property["buildingType"],
  };
}

export function CompareBuilder() {
  const { dict, lang, f, money } = useI18n();
  const d = dict.compare;
  const [drafts, setDrafts] = useState<Draft[]>(() => COMPARE_PROPERTIES.map(toDraft));
  const [purpose, setPurpose] = useState<"live" | "invest">("live");
  const [household, setHousehold] = useState<"family" | "single" | "couple" | "retired" | undefined>("family");
  const [priorities, setPriorities] = useState<Priority[]>(["schools", "quiet"]);
  const [editing, setEditing] = useState<string | null>(null);
  const tracked = useRef(false);

  // Sample objects are located in Lviv; for other cities the user's own objects are priced against that city.
  const properties = useMemo(
    () => drafts.map((x) => toProperty(x, "lviv", "USD")).filter((p): p is Property => p !== null),
    [drafts],
  );
  const reports = useMemo(
    () => reportsForProperties(properties, { purpose, household, priorities }),
    [properties, purpose, household, priorities],
  );

  useEffect(() => {
    if (!tracked.current && reports.length >= 2) {
      tracked.current = true;
      track("comparison_created", { n: reports.length });
    }
  }, [reports.length]);

  const nameOf = (id: string) => `${d.objectName.replace("{n}", String(drafts.findIndex((x) => x.id === id) + 1))}`;

  const update = (id: string, patch: Partial<Draft>) => setDrafts((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const add = () => setDrafts((cur) => (cur.length >= 5 ? cur : [...cur, { ...toDraft(COMPARE_PROPERTIES[0]), id: `n${Date.now()}`, askingPrice: "", areaSqm: "" }]));
  const remove = (id: string) => setDrafts((cur) => (cur.length <= 2 ? cur : cur.filter((x) => x.id !== id)));

  const togglePri = (p: Priority) => setPriorities((s) => (s.includes(p) ? s.filter((x) => x !== p) : s.length < 3 ? [...s, p] : s));

  return (
    <div className="space-y-10">
      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-ink2">{d.demoNote} {dict.check.demoNote}</p>

      {/* brief used for fit */}
      <Card>
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div>
            <p className="mb-2 text-sm font-medium">{d.brief}</p>
            <div className="flex gap-2">
              <Chip active={purpose === "live"} onClick={() => setPurpose("live")}>{d.briefLive}</Chip>
              <Chip active={purpose === "invest"} onClick={() => setPurpose("invest")}>{d.briefInvest}</Chip>
            </div>
          </div>
          {purpose === "live" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["single", "couple", "family", "retired"] as const).map((h) => (
                  <Chip key={h} active={household === h} onClick={() => setHousehold(h)}>{dict.enums.household[h]}</Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <Chip key={p} active={priorities.includes(p)} onClick={() => togglePri(p)}>{dict.enums.priority[p]}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <CompareResults reports={reports} nameOf={nameOf} />

      {/* editors */}
      <section aria-label={d.add}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="display text-2xl">{dict.nav.compare}</h2>
          <Button variant="secondary" onClick={add} disabled={drafts.length >= 5}>+ {d.add}</Button>
        </div>
        {drafts.length >= 5 && <p className="mb-2 text-xs text-ink2">{d.maxReached}</p>}
        <div className="grid gap-3">
          {drafts.map((x, i) => (
            <Card key={x.id} className="!p-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" className="font-medium" aria-expanded={editing === x.id} onClick={() => setEditing(editing === x.id ? null : x.id)}>
                  {d.objectName.replace("{n}", String(i + 1))} <span className="text-sm font-normal text-ink2">· {x.areaSqm || "?"} {dict.common.sqm} · {x.askingPrice ? money(Number(x.askingPrice), "USD") : "?"}</span>
                </button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditing(editing === x.id ? null : x.id)}>{editing === x.id ? dict.common.collapse : dict.common.expand}</Button>
                  <Button variant="ghost" onClick={() => remove(x.id)} disabled={drafts.length <= 2}>{d.remove}</Button>
                </div>
              </div>
              {editing === x.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                  <div className="grid gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-5">
                    <Field label={dict.check.fields.district}>
                      <Select value={x.districtId} onChange={(e) => update(x.id, { districtId: e.target.value })}>
                        <option value="">{dict.check.fields.districtAny}</option>
                        {getCityOrDefault("lviv").districts.map((dd) => <option key={dd.id} value={dd.id}>{dd.names[lang]}</option>)}
                      </Select>
                    </Field>
                    <Field label={f(dict.check.fields.askingPrice, { currency: "USD" })}><NumberInput value={x.askingPrice} onValueChange={(v) => update(x.id, { askingPrice: v })} /></Field>
                    <Field label={dict.check.fields.area}><NumberInput decimals hint={false} value={x.areaSqm} onValueChange={(v) => update(x.id, { areaSqm: v })} /></Field>
                    <Field label={dict.check.fields.rooms}><Input inputMode="numeric" value={x.rooms} onChange={(e) => update(x.id, { rooms: e.target.value })} /></Field>
                    <Field label={dict.check.fields.yearBuilt}><Input inputMode="numeric" value={x.yearBuilt} onChange={(e) => update(x.id, { yearBuilt: e.target.value })} /></Field>
                    <Field label={dict.check.fields.floor}><Input inputMode="numeric" value={x.floor} onChange={(e) => update(x.id, { floor: e.target.value })} /></Field>
                    <Field label={dict.check.fields.floorsTotal}><Input inputMode="numeric" value={x.floorsTotal} onChange={(e) => update(x.id, { floorsTotal: e.target.value })} /></Field>
                    <Field label={dict.check.fields.condition}>
                      <Select value={x.condition} onChange={(e) => update(x.id, { condition: e.target.value })}>
                        <option value="">—</option>
                        {CONDITIONS.map((c) => <option key={c} value={c}>{dict.enums.condition[c]}</option>)}
                      </Select>
                    </Field>
                    <Field label={dict.check.fields.buildingType}>
                      <Select value={x.buildingType} onChange={(e) => update(x.id, { buildingType: e.target.value })}>
                        <option value="">—</option>
                        {BUILDING_TYPES.map((c) => <option key={c} value={c}>{dict.enums.buildingType[c]}</option>)}
                      </Select>
                    </Field>
                  </div>
                </motion.div>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function legalLabel(r: ReportData, dict: ReturnType<typeof useI18n>["dict"]) {
  const s = legalSummary(r.legal);
  return s.unknown === s.total ? dict.report.legal.status.unknown : `${s.red ? "RED " + s.red : ""}${s.yellow ? " YELLOW " + s.yellow : ""}${!s.red && !s.yellow ? "GREEN" : ""}`.trim();
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink2">{label}</dt>
      <dd className={cn("num font-semibold", muted && "font-normal text-ink2")}>{value}</dd>
    </div>
  );
}

function RiskText({ msg }: { msg: ReportData["overall"]["risks"][number] }) {
  const { m } = useI18n();
  return <span>{m(msg)}</span>;
}

function ScoreBars({ r }: { r: ReportData }) {
  const { dict } = useI18n();
  return (
    <div className="space-y-1.5 pt-1">
      {r.scores.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-[11px]">
          <span className="w-24 shrink-0 truncate text-ink2">{dict.report.scores.names[s.id]}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
            {s.value !== null ? (
              <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${s.value}%` }} transition={{ duration: 0.7, ease: EASE }} />
            ) : (
              <div className="missing-box h-full w-full" />
            )}
          </div>
          <span className="num w-6 text-right">{s.value ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Comparison output shared by the demo sandbox and the client's saved cases:
 * best fit for the brief + columns that re-order by fit.
 */
export function CompareResults({ reports, nameOf, sub, href }: { reports: ReportData[]; nameOf: (id: string) => string; sub?: (r: ReportData) => string; href?: (id: string) => string }) {
  const { dict, lang, f, money, num } = useI18n();
  const d = dict.compare;
  const best = useMemo(() => bestFit(reports), [reports]);
  const fitOf = (id: string) => best.fits.find((x) => x.id === id);
  const ordered = [...reports].sort((a, b) => (fitOf(b.property.id)?.fit ?? -1) - (fitOf(a.property.id)?.fit ?? -1));
  const winner = reports.find((r) => r.property.id === best.winnerId);
  return (
    <>
      {/* best fit */}
      <motion.div layout className="rounded-3xl border-2 border-brand bg-surface p-6 shadow-card sm:p-8" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{d.bestFit}</p>
        {winner ? (
          <>
            <motion.h2 key={winner.property.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="display mt-2 text-3xl sm:text-4xl">
              {nameOf(winner.property.id)}
              {winner.property.districtId && <span className="text-ink2"> · {winner.city.districts.find((x) => x.id === winner.property.districtId)?.names[lang]}</span>}
            </motion.h2>
            <p className="mt-3 text-ink">
              {f(d.bestFitBody, {
                name: nameOf(winner.property.id),
                n: fitOf(winner.property.id)?.fit ?? 0,
                cov: num((fitOf(winner.property.id)?.coverage ?? 0) * 100),
              })}
            </p>
            {best.leads.length > 0 && (
              <p className="mt-2 text-sm text-ink2">{f(d.bestFitLeads, { list: best.leads.map((l) => dict.report.scores.names[l]).join(", ") })}</p>
            )}
            {best.reason === "tie" && <p className="mt-2 text-sm text-warn">{d.bestFitTie}</p>}
          </>
        ) : (
          <p className="mt-2 text-ink2">{d.bestFitNone}</p>
        )}
      </motion.div>

      {/* matrix: columns re-order by fit (layout animation) */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-4">
          {ordered.map((r) => {
            const fit = fitOf(r.property.id);
            const isBest = r.property.id === best.winnerId;
            return (
              <motion.div
                key={r.property.id}
                layout
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className={cn("w-72 shrink-0 rounded-2xl border bg-surface p-5", isBest ? "border-brand ring-2 ring-brand/30" : "border-line")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {href ? (
                      <a href={href(r.property.id)} className="font-semibold text-brand hover:underline">
                        {nameOf(r.property.id)}
                      </a>
                    ) : (
                      <p className="font-semibold">{nameOf(r.property.id)}</p>
                    )}
                    {sub && <p className="num text-xs text-ink2">{sub(r)}</p>}
                    <p className="text-xs text-ink2">{r.city.districts.find((x) => x.id === r.property.districtId)?.names[lang] ?? "—"} · {r.property.areaSqm} {dict.common.sqm}</p>
                  </div>
                  <ScoreRing value={fit?.fit ?? null} size={56} label={d.rows.fit} />
                </div>
                {isBest && <Pill tone="good" className="mt-3">{d.bestFit}</Pill>}
                {fit?.excluded && <Pill tone="bad" className="mt-3">{f(d.excluded, { reason: d.excludedReasons[fit.excluded] })}</Pill>}
                <dl className="mt-4 space-y-3.5 text-sm">
                  <Row label={d.rows.ask} value={money(r.property.askingPrice, r.property.currency)} />
                  <Row label={d.rows.perSqm} value={money(Math.round(r.property.askingPrice / r.property.areaSqm), r.property.currency)} />
                  <Row label={d.rows.fair} value={r.valuation.status === "ok" ? `${money(r.valuation.fairLow, r.property.currency)} – ${money(r.valuation.fairHigh, r.property.currency)}` : dict.common.notEnoughData} />
                  <div>
                    <dt className="text-xs text-ink2">{d.rows.price}</dt>
                    <dd className="mt-1"><Pill tone={priceTone[r.price.verdict]}>{dict.report.priceVerdicts[r.price.verdict]}</Pill></dd>
                  </div>
                  <Row label={d.rows.repair} value={r.repairs?.counted ? `${money(r.repairs.low, r.property.currency)} – ${money(r.repairs.high, r.property.currency)}` : dict.report.repairAfterInspection} muted={!r.repairs?.counted} />
                  <Row label={d.rows.legal} value={legalLabel(r, dict)} muted />
                  <div>
                    <dt className="text-xs text-ink2">{dict.report.verdictLabel}</dt>
                    <dd className="mt-1"><Pill tone={verdictTone[r.overall.verdict]}>{dict.report.verdictShort[r.overall.verdict]}</Pill></dd>
                  </div>
                  <ScoreBars r={r} />
                </dl>
                <p className="mt-4 text-xs font-medium text-ink2">{d.rows.risks}</p>
                <ul className="mt-1.5 space-y-1 text-xs">
                  {r.overall.risks.slice(0, 2).map((x) => (
                    <li key={x.code} className="flex gap-1.5"><span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-bad" /> <RiskText msg={x} /></li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>

    </>
  );
}
