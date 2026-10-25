"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence } from "motion/react";
import type { ReportData } from "@/domain/report/build";
import { track } from "@/lib/analytics";
import { motion } from "../motion";
import { useI18n } from "../providers";
import { Button, Field, Input, Textarea } from "../ui/primitives";

export type OrderKind = "inspection" | "legal" | "consult" | "digital";
type Kind = OrderKind;

/** Order / lead capture. Posts to /api/orders (validated server-side); falls back gracefully if no backend is configured. */
export function OrderPanel({ open, onClose, report, title, extraContext }: { open: Kind | null; onClose: () => void; report?: ReportData; title?: string; extraContext?: Record<string, string> }) {
  const { dict, lang } = useI18n();
  const d = dict.report.order;
  const [state, setState] = useState<"idle" | "sending" | "sent" | "sentLocal" | "error">("idle");
  const firstRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setState("idle");
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const label: Record<Kind, string> = {
    inspection: dict.report.actions.orderInspection,
    legal: dict.report.actions.orderLegal,
    consult: dict.report.actions.consult,
    digital: dict.services.packages.digital.name,
  };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open) return;
    const fd = new FormData(e.currentTarget);
    // Links documents uploaded on the check page (private bucket batch id) to this request.
    let uploadBatch: string | null = null;
    try {
      uploadBatch = localStorage.getItem("bi.uploadBatch");
    } catch {
      /* ignore */
    }
    const payload = {
      kind: open,
      lang,
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      note: String(fd.get("note") ?? ""),
      consent: fd.get("consent") === "on",
      website: String(fd.get("website") ?? ""), // honeypot
      context: report || extraContext || uploadBatch
        ? {
            ...extraContext,
            ...(uploadBatch ? { uploadBatch } : {}),
            ...(window.location.pathname.endsWith("/report") ? { reportQuery: window.location.search.slice(1) } : {}),
            ...(report
              ? {
                  sample: report.isSample,
                  cityId: report.property.cityId,
                  districtId: report.property.districtId,
                  askingPrice: report.property.askingPrice,
                  areaSqm: report.property.areaSqm,
                  verdict: report.overall.verdict,
                }
              : {}),
          }
        : undefined,
    };
    setState("sending");
    try {
      const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      if (res.status === 400) return setState("error");
      const j = (await res.json().catch(() => ({}))) as { stored?: boolean };
      track(open === "consult" ? "consultation_requested" : "inspection_requested", { kind: open });
      setState(j.stored ? "sent" : "sentLocal");
    } catch {
      setState("error");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="no-print fixed inset-0 z-50 grid place-items-end bg-ink/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-card sm:max-w-lg sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="order-title" className="display text-2xl">{d.title}</h2>
                <p className="mt-1 text-sm text-ink2">{title ?? label[open]}</p>
              </div>
              <button type="button" onClick={close} aria-label={dict.common.close} className="grid h-9 w-9 place-items-center rounded-full border border-line">✕</button>
            </div>

            {state === "sent" || state === "sentLocal" ? (
              <div className="py-8" aria-live="polite">
                <p className="text-lg font-semibold text-good">{d.sentTitle}</p>
                <p className="mt-2 text-ink2">{d.sentBody}</p>
                {state === "sentLocal" && <p className="mt-3 text-xs text-ink2">{d.sentLocal}</p>}
                <Button variant="secondary" className="mt-6" onClick={close}>{dict.common.close}</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <Field label={d.name} htmlFor="o-name"><Input id="o-name" ref={firstRef} name="name" autoComplete="name" maxLength={120} /></Field>
                <Field label={d.email} htmlFor="o-email"><Input id="o-email" name="email" type="email" required autoComplete="email" /></Field>
                <Field label={d.phone} htmlFor="o-phone"><Input id="o-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} /></Field>
                <Field label={d.note} htmlFor="o-note"><Textarea id="o-note" name="note" maxLength={1000} /></Field>
                <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <label className="flex items-start gap-2.5 text-sm text-ink2">
                  <input type="checkbox" name="consent" required className="mt-1" />
                  {d.consent}
                </label>
                {state === "error" && <p role="alert" className="text-sm text-bad">{d.errors}</p>}
                <Button type="submit" disabled={state === "sending"} className="w-full">{state === "sending" ? d.sending : d.send}</Button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
