"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  BRIEF_MARKETS,
  HORIZONS,
  HOUSEHOLDS,
  PRIORITIES,
  PURPOSES,
  RENOVATION,
  RISKS,
  TIMELINES,
  stepIsValid,
  stepsFor,
  briefSchema,
  type BriefDraft,
  type Priority,
  type StepId,
} from "@/domain/brief";
import { districtMatches } from "@/domain/brief/districts";
import { PROPERTY_CLASSES } from "@/domain/property/types";
import { getCityOrDefault, listCities } from "@/domain/location/registry";
import { track } from "@/lib/analytics";
import { clearBrief, loadBrief, saveBrief } from "@/lib/brief-store";
import { cn } from "@/lib/cn";
import { CountUp, motion, EASE } from "../motion";
import { useCity, useI18n } from "../providers";
import { Button, Card, Chip, Field, Input, Select } from "../ui/primitives";
import { NumberInput } from "../ui/number-input";

export function BriefWizard() {
  const { dict, lang, href, f } = useI18n();
  const { cityId, setCityId } = useCity();
  const d = dict.brief;
  const [draft, setDraft] = useState<BriefDraft>({});
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sent, setSent] = useState<null | "sent" | "local" | "sending">(null);
  const started = useRef(false);

  useEffect(() => {
    const saved = loadBrief();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate wizard from browser storage after mount
    setDraft({ ...saved, cityId: saved.cityId ?? cityId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = useMemo(() => stepsFor(draft), [draft]);
  const step: StepId = steps[Math.min(idx, steps.length - 1)];
  const valid = stepIsValid(step, draft);

  const patch = (p: BriefDraft) => {
    if (!started.current) {
      started.current = true;
      track("brief_started");
    }
    setDraft((cur) => {
      const next = { ...cur, ...p };
      saveBrief(next);
      return next;
    });
  };

  const go = (delta: 1 | -1) => {
    if (delta === 1) {
      track("brief_step_completed", { step, n: idx + 1 });
      if (idx >= steps.length - 1) {
        track("brief_completed", { purpose: draft.purpose, city: draft.cityId });
        setDir(1);
        setDone(true);
        return;
      }
    }
    setDir(delta);
    setIdx((i) => Math.max(0, Math.min(steps.length - 1, i + delta)));
  };

  const city = getCityOrDefault(draft.cityId ?? cityId);
  const matches = useMemo(() => (done ? districtMatches(draft, city) : []), [done, draft, city]);

  async function submitBrief() {
    setSent("sending");
    const parsed = briefSchema.safeParse({ ...draft, cityId: city.id, currency: city.currency });
    if (!parsed.success || !email || !consent) return setSent(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "brief", lang, email, consent: true, brief: parsed.data }),
      });
      const j = (await res.json().catch(() => ({}))) as { stored?: boolean };
      setSent(res.ok ? (j.stored ? "sent" : "local") : null);
    } catch {
      setSent(null);
    }
  }

  const progress = done ? 1 : (idx + 1) / steps.length;

  return (
    <div>
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm text-ink2">
          <span>{done ? d.resultTitle : f(d.step, { n: idx + 1, total: steps.length })}</span>
          <button type="button" onClick={() => { clearBrief(); setDraft({ cityId }); setIdx(0); setDone(false); setSent(null); }} className="hover:text-ink">
            {d.restart}
          </button>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface2">
          <motion.div className="h-full bg-brand" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
        </div>
      </div>

      <AnimatePresence mode="wait" custom={dir}>
        {!done ? (
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <h2 className="display text-3xl sm:text-4xl">{d.steps[step].q}</h2>
            <p className="mt-2 text-ink2">{d.steps[step].h}</p>
            <div className="mt-8">
              <StepBody step={step} draft={draft} patch={patch} setCityId={setCityId} />
              {step === "property" && draft.propertyClass && draft.propertyClass !== "residential" && <p className="mt-4 text-sm text-warn">{d.comingSoonClass}</p>}
            </div>
            <div className="mt-10 flex items-center gap-3">
              <Button variant="ghost" onClick={() => go(-1)} disabled={idx === 0}>
                ← {dict.common.back}
              </Button>
              <Button onClick={() => go(1)} disabled={!valid}>
                {idx >= steps.length - 1 ? dict.common.submit : dict.common.next} →
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="space-y-8">
            <div>
              <h2 className="display text-3xl sm:text-4xl">{d.resultDistricts}</h2>
              <p className="mt-2 text-sm text-ink2">{d.resultAffordNote}</p>
            </div>
            {matches.length === 0 ? (
              <div className="missing-box rounded-2xl p-6 text-ink2">{d.resultNoDistricts}</div>
            ) : (
              <ul className="grid gap-3">
                {matches.map((m, i) => (
                  <motion.li key={m.district.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                    <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 !py-4">
                      <span className="num grid h-9 w-9 place-items-center rounded-full bg-surface2 text-sm">{i + 1}</span>
                      <div className="min-w-40 flex-1">
                        <p className="font-semibold">{m.district.names[lang]}</p>
                        {m.affordableSqm !== null && (
                          <p className={cn("text-sm", m.tight ? "text-warn" : "text-ink2")}>
                            {f(d.resultAfford, { sqm: m.affordableSqm })}
                            {m.tight && ` · ${d.budgetTooLow}`}
                          </p>
                        )}
                      </div>
                      {m.fit !== null && (
                      <div className="w-40">
                        <div className="flex justify-between text-xs text-ink2">
                          <span>{f(d.resultFit, { fit: "" }).trim()}</span>
                          <CountUp value={m.fit ?? 0} format={(n) => String(Math.round(n))} className="num font-semibold text-ink" />
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2">
                          <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${m.fit}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.07, ease: EASE }} />
                        </div>
                      </div>
                      )}
                    </Card>
                  </motion.li>
                ))}
              </ul>
            )}

            <Card>
              <h3 className="font-semibold">{d.resultNext}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={d.fields.contactEmail} htmlFor="b-email" optional={dict.common.optional}>
                  <Input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
                <label className="flex items-start gap-2.5 self-end text-sm text-ink2">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  {d.fields.consent}
                </label>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={submitBrief} disabled={!email || !consent || sent === "sending"}>
                  {sent === "sending" ? d.submitting : dict.common.submit}
                </Button>
                <Link href={href("/check")} className="rounded-full bg-brand px-5 py-2.5 text-[15px] font-medium text-brandink">
                  {d.resultCheck} →
                </Link>
              </div>
              <p aria-live="polite" className="mt-3 text-sm text-good">
                {sent === "sent" && d.resultSent}
                {sent === "local" && d.resultSentLocal}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChoiceGrid<T extends string>({ items, value, onPick, label, hint }: { items: readonly T[]; value?: T; onPick: (v: T) => void; label: (v: T) => string; hint?: (v: T) => string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
      {items.map((it) => (
        <button
          key={it}
          type="button"
          role="radio"
          aria-checked={value === it}
          onClick={() => onPick(it)}
          className={cn("rounded-2xl border p-4 text-left transition-all", value === it ? "border-brand bg-surface shadow-card ring-1 ring-brand" : "border-line bg-surface/60 hover:border-ink2")}
        >
          <span className="font-semibold">{label(it)}</span>
          {hint && <span className="mt-0.5 block text-sm text-ink2">{hint(it)}</span>}
        </button>
      ))}
    </div>
  );
}

function StepBody({ step, draft, patch, setCityId }: { step: StepId; draft: BriefDraft; patch: (p: BriefDraft) => void; setCityId: (id: string) => void }) {
  const { dict, lang } = useI18n();
  const d = dict.brief;
  const num = (v: string) => (v === "" ? undefined : Number(v.replace(/\s/g, "")));

  switch (step) {
    case "city":
      return (
        <ChoiceGrid
          items={listCities().map((c) => c.id)}
          value={draft.cityId}
          onPick={(id) => {
            patch({ cityId: id });
            setCityId(id);
          }}
          label={(id) => getCityOrDefault(id).names[lang]}
          hint={(id) => (getCityOrDefault(id).status === "live" ? dict.home.cityLive : dict.home.citySoon)}
        />
      );
    case "purpose":
      return <ChoiceGrid items={PURPOSES} value={draft.purpose} onPick={(v) => patch({ purpose: v })} label={(v) => dict.enums.purpose[v]} hint={(v) => dict.enums.purposeHint[v]} />;
    case "property":
      return (
        <div className="space-y-6">
          <ChoiceGrid items={PROPERTY_CLASSES} value={draft.propertyClass} onPick={(v) => patch({ propertyClass: v })} label={(v) => d.propertyClasses[v]} />
          <Field label={d.fields.market}>
            <div className="flex flex-wrap gap-2">
              {BRIEF_MARKETS.map((m) => (
                <Chip key={m} active={draft.market === m} onClick={() => patch({ market: m })}>
                  {dict.enums.market[m]}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      );
    case "budget":
      return (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={d.fields.budgetMax} htmlFor="bmax">
            <NumberInput id="bmax" value={draft.budgetMax !== undefined ? String(draft.budgetMax) : ""} onValueChange={(v) => patch({ budgetMax: num(v) })} placeholder="100 000" />
          </Field>
          <Field label={d.fields.budgetMin} htmlFor="bmin" optional={dict.common.optional}>
            <NumberInput id="bmin" value={draft.budgetMin !== undefined ? String(draft.budgetMin) : ""} onValueChange={(v) => patch({ budgetMin: num(v) })} />
          </Field>
          <Field label={d.fields.areaMin} htmlFor="amin" optional={dict.common.optional}>
            <NumberInput id="amin" value={draft.areaMin !== undefined ? String(draft.areaMin) : ""} onValueChange={(v) => patch({ areaMin: num(v) })} hint={false} />
          </Field>
          <Field label={d.fields.areaMax} htmlFor="amax" optional={dict.common.optional}>
            <NumberInput id="amax" value={draft.areaMax !== undefined ? String(draft.areaMax) : ""} onValueChange={(v) => patch({ areaMax: num(v) })} hint={false} />
          </Field>
          <Field label={d.fields.rooms} htmlFor="brooms" optional={dict.common.optional}>
            <Select id="brooms" value={draft.rooms ?? ""} onChange={(e) => patch({ rooms: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">{d.fields.roomsAny}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      );
    case "lifestyle": {
      const sel = draft.priorities ?? [];
      const toggle = (p: Priority) => patch({ priorities: sel.includes(p) ? sel.filter((x) => x !== p) : sel.length < 3 ? [...sel, p] : sel });
      return (
        <div className="space-y-7">
          <Field label={d.fields.household}>
            <div className="flex flex-wrap gap-2">
              {HOUSEHOLDS.map((h) => (
                <Chip key={h} active={draft.household === h} onClick={() => patch({ household: h })}>
                  {dict.enums.household[h]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={d.fields.priorities}>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <Chip key={p} active={sel.includes(p)} onClick={() => toggle(p)}>
                  {dict.enums.priority[p]}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      );
    }
    case "invest":
      return (
        <div className="space-y-7">
          <Field label={d.fields.risk}>
            <div className="flex flex-wrap gap-2">
              {RISKS.map((x) => (
                <Chip key={x} active={draft.risk === x} onClick={() => patch({ risk: x })}>
                  {dict.enums.risk[x]}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label={d.fields.horizon}>
            <div className="flex flex-wrap gap-2">
              {HORIZONS.map((x) => (
                <Chip key={x} active={draft.horizon === x} onClick={() => patch({ horizon: x })}>
                  {dict.enums.horizon[x]}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      );
    case "condition":
      return <ChoiceGrid items={RENOVATION} value={draft.renovation} onPick={(v) => patch({ renovation: v })} label={(v) => dict.enums.renovation[v]} />;
    case "timeline":
      return <ChoiceGrid items={TIMELINES} value={draft.timeline} onPick={(v) => patch({ timeline: v })} label={(v) => dict.enums.timeline[v]} />;
  }
}
