"use client";

import { useState } from "react";
import { CHECKLISTS, type SectionId, type SpecialistId } from "@/domain/inspection";
import { SAMPLE_ISSUES } from "@/data/samples";
import { cn } from "@/lib/cn";
import { Reveal, motion, EASE } from "../motion";
import { useI18n } from "../providers";
import { IssueCard } from "../report/report-modules";
import { OrderPanel } from "../report/order-panel";
import { Button, Card, LinkButton, Pill } from "../ui/primitives";
import { XrayStory } from "./xray-story";
import { TechnicalText } from "../ui/tooltip";

const SPECIALISTS: SpecialistId[] = ["inspector", "lawyer", "surveyor", "electrician", "engineer", "plumber", "hvac", "appraiser"];

export function ChecklistExplorer() {
  const { dict } = useI18n();
  const d = dict.inspection;
  const sections = CHECKLISTS["residential-apartment"];
  const [active, setActive] = useState<SectionId>(sections[0].id);
  const current = sections.find((s) => s.id === active) ?? sections[0];
  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <div role="tablist" aria-label={d.sectionsLabel} aria-orientation="vertical" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {sections.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={active === s.id}
            onClick={() => setActive(s.id)}
            className={cn("relative flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors", active === s.id ? "border-brand bg-surface font-semibold" : "border-line bg-surface/50 text-ink2 hover:text-ink")}
          >
            <span className="num text-xs text-brand">{String(i + 1).padStart(2, "0")}</span>
            {d.sections[s.id]}
          </button>
        ))}
      </div>
      <Card role="tabpanel" key={active}>
        <motion.ul initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }} className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {current.items.map((it) => (
            <motion.li key={it.id} variants={{ h: { opacity: 0, x: -8 }, s: { opacity: 1, x: 0 } }} className="flex items-center justify-between gap-3 border-b border-line/70 py-3 text-[15px]">
              <span><TechnicalText>{(d.items as Record<string, string>)[it.id]}</TechnicalText></span>
              {it.licensedOnly && <Pill tone="warn">{d.licensed}</Pill>}
            </motion.li>
          ))}
        </motion.ul>
      </Card>
    </div>
  );
}

export function InspectionExtras() {
  const { dict, href } = useI18n();
  const d = dict.inspection;
  const [order, setOrder] = useState(false);
  return (
    <>
      <section className="mt-20">
        <Reveal><h2 className="display text-3xl">{d.reportTitle}</h2><p className="mt-2 text-ink2">{d.reportLead}</p></Reveal>
        <div className="mt-6 space-y-2.5">
          {SAMPLE_ISSUES.slice(0, 3).map((i, idx) => <IssueCard key={i.id} issue={i} defaultOpen={idx === 0} />)}
        </div>
      </section>

      <section className="mt-20">
        <Reveal><h2 className="display text-3xl">{d.beforeAfterTitle}</h2><p className="mt-2 max-w-2xl text-ink2">{d.beforeAfterLead}</p></Reveal>
        <div className="mt-6"><XrayStory /></div>
      </section>

      <section className="mt-20">
        <h2 className="display text-3xl">{d.process}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {d.steps.map((s, i) => (
            <Reveal key={s.t} delay={i * 0.07}>
              <li className="h-full rounded-2xl border border-line bg-surface p-5">
                <span className="num text-xs text-brand">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 font-semibold">{s.t}</p>
                <p className="mt-1 text-sm text-ink2">{s.d}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="mt-20">
        <h2 className="display text-3xl">{d.specialists}</h2>
        <p className="mt-2 text-ink2">{d.specialistsLead}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {SPECIALISTS.map((s, i) => (
            <motion.span key={s} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.04, ease: EASE }} className="rounded-full border border-line bg-surface px-4 py-2 text-sm">
              {d.specialistNames[s]}
            </motion.span>
          ))}
        </div>
      </section>

      <div className="mt-16 flex flex-wrap gap-3">
        <Button onClick={() => setOrder(true)}>{d.cta}</Button>
        <LinkButton href={href("/report/sample")} variant="secondary">{d.ctaSample}</LinkButton>
      </div>
      <OrderPanel open={order ? "inspection" : null} onClose={() => setOrder(false)} />
    </>
  );
}
