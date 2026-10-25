"use client";

import dynamic from "next/dynamic";
import { useId, useRef, useState } from "react";
import { useInView } from "motion/react";
import type { InspectionIssue } from "@/domain/inspection";
import { inspectionVisuals } from "@/data/inspection-visuals";
import { useI18n } from "../providers";
import { TechnicalText } from "../ui/tooltip";

const IssueDiagram = dynamic(() => import("../three/issue-diagram").then((m) => m.IssueDiagram), {
  ssr: false,
  loading: () => <div className="h-56 rounded-lg bg-surface2 sm:h-64" />,
});

export function IssueVisual({ issue }: { issue: InspectionIssue }) {
  const { lang } = useI18n();
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "150px" });
  const [solution, setSolution] = useState(false);
  const copy = inspectionVisuals[lang][issue.sectionId];
  const healthy = issue.severity === "green";

  if (issue.photos.length) return <div className="space-y-3">{issue.photos.map((photo) => <figure key={photo.src}>
    {/* Inspection attachments can use signed storage URLs; preserve their original source. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.src} alt={photo.alt[lang]} loading="lazy" className="max-h-80 w-full rounded-xl object-contain" />
    <figcaption className="mt-1 text-xs text-ink2">{photo.alt[lang]}</figcaption>
  </figure>)}</div>;

  return <figure ref={ref} aria-labelledby={`${id}-caption`} className="self-start rounded-xl border border-line bg-bg p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs font-semibold text-ink2">{lang === "uk" ? "3D-схема · ілюстрація" : "3D diagram · illustration"}</span>
      {!healthy && <div className="flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label={lang === "uk" ? "Вигляд схеми" : "Diagram view"}>
        {[false, true].map((value) => <button key={String(value)} type="button" aria-pressed={solution === value} onClick={() => setSolution(value)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${solution === value ? "bg-ink text-bg" : "text-ink2"}`}>
          {value ? (lang === "uk" ? "Як усунути" : "Remedy") : (lang === "uk" ? "Проблема" : "Finding")}
        </button>)}
      </div>}
    </div>
    {inView ? <IssueDiagram section={issue.sectionId} solution={solution} healthy={healthy} fallback={lang === "uk" ? "3D недоступне на цьому пристрої. Пояснення — під схемою." : "3D is unavailable on this device. Read the explanation below."} /> : <div className="h-56 rounded-lg bg-surface2 sm:h-64" />}
    <figcaption id={`${id}-caption`} className="mt-3">
      <p className="flex items-start gap-2 text-sm leading-relaxed" aria-live="polite">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">1</span>
        <span><TechnicalText>{solution ? copy.solution : copy.focus}</TechnicalText></span>
      </p>
      <p className="mt-2 border-t border-line pt-2 text-xs text-ink2">{lang === "uk" ? "Схематичне пояснення пункту огляду. Не фото об’єкта й не підтвердження виконаного ремонту." : "Schematic explanation of this inspection item. Not a property photo or proof of completed repairs."}</p>
    </figcaption>
  </figure>;
}
