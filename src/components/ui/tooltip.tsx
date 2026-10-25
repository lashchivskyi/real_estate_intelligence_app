"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { glossary, type GlossaryTerm } from "@/i18n/glossary";
import { useI18n } from "../providers";

/** Portal avoids clipping inside cards; all input methods share the same explanation. */
export function HelpTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };
  const show = () => { cancel(); setOpen(true); };
  const leave = () => { cancel(); timer.current = setTimeout(() => setOpen(false), 180); };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = popup.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      const top = anchor.bottom + 8 + box.height <= window.innerHeight - 12 ? anchor.bottom + 8 : Math.max(12, anchor.top - box.height - 8);
      setPosition({ left: Math.max(12, Math.min(anchor.left - box.width / 2 + anchor.width / 2, window.innerWidth - box.width - 12)), top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { cancel(); setOpen(false); } };
    const outside = (e: PointerEvent) => {
      if (!trigger.current?.contains(e.target as Node) && !popup.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return <>
    <button ref={trigger} type="button" aria-label={label} aria-describedby={open ? id : undefined}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") leave(); }}
      onFocus={show} onBlur={() => { cancel(); setOpen(false); }} onClick={show}
      className="no-print inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-surface2 hover:text-brand">
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5M10 5.5v1" /></svg>
    </button>
    {open && createPortal(<span ref={popup} id={id} role="tooltip" onPointerEnter={cancel} onPointerLeave={leave}
      className="fixed z-[100] w-72 max-w-[calc(100vw-24px)] rounded-xl border border-line bg-surface p-3 text-left text-sm font-normal normal-case leading-relaxed tracking-normal text-ink shadow-card"
      style={position}>{children}</span>, document.body)}
  </>;
}

export function ExplainedTerm({ term, children }: { term: GlossaryTerm; children: ReactNode }) {
  const { lang } = useI18n();
  return <span className="inline-flex max-w-full items-center gap-0.5"><span>{children}</span><HelpTooltip label={`${lang === "uk" ? "Пояснення" : "Explain"}: ${typeof children === "string" ? children : term}`}>{glossary[lang][term]}</HelpTooltip></span>;
}

/** Only unfamiliar terms get an explanation; ordinary prose stays readable. */
export function TechnicalText({ children }: { children: string }) {
  return <>{children.split(/(УЗО|ПЗВ|RCD|ОСББ|HOA|містка холоду|місток холоду|thermal bridge)/gi).map((part, i) => {
    const term = /^(УЗО|ПЗВ|RCD)$/i.test(part) ? "rcd" : /^(ОСББ|HOA)$/i.test(part) ? "hoa" : /^(містка холоду|місток холоду|thermal bridge)$/i.test(part) ? "thermalBridge" : null;
    return term ? <ExplainedTerm key={i} term={term}>{part}</ExplainedTerm> : part;
  })}</>;
}
