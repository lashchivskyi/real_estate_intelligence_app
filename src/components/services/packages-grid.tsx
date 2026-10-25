"use client";

import { useState } from "react";
import { GRID_PACKAGES, type PackageId } from "@/config/packages";
import { Reveal } from "../motion";
import { useI18n } from "../providers";
import { OrderPanel } from "../report/order-panel";
import { Button, LinkButton, Pill } from "../ui/primitives";
import { cn } from "@/lib/cn";
import { track } from "@/lib/analytics";

export function PackagesGrid() {
  const { dict, money, href } = useI18n();
  const d = dict.services;
  const [order, setOrder] = useState<PackageId | null>(null);
  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {GRID_PACKAGES.map((p, i) => {
          const t = d.packages[p.id];
          return (
            <Reveal key={p.id} delay={i * 0.07}>
              <div className={cn("flex h-full flex-col rounded-2xl border bg-surface p-6", p.highlight ? "border-brand shadow-card ring-1 ring-brand" : "border-line")}>
                {p.highlight && <Pill tone="good" className="mb-3 self-start">{d.popular}</Pill>}
                <h2 className="text-xl font-semibold">{t.name}</h2>
                <p className="mt-1 text-sm text-ink2">{t.for}</p>
                <p className="num mt-5 text-2xl font-semibold">
                  {p.priceUah ? money(p.priceUah, "UAH") : d.contact}
                </p>
                {p.hypothesis && <p className="mt-1 text-xs text-warn">{d.hypothesis}</p>}
                <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                  {t.items.map((x) => (
                    <li key={x} className="flex gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" className="mt-0.5 shrink-0" aria-hidden><path d="M5 12l5 5L20 7" /></svg>
                      {x}
                    </li>
                  ))}
                </ul>
                {p.priceUah ? (
                  <LinkButton href={href(`/checkout?package=${p.id}`)} className="mt-6 w-full" variant={p.highlight ? "primary" : "secondary"} onClick={() => track("report_requested", { package: p.id })}>
                    {d.order}
                  </LinkButton>
                ) : (
                  <Button className="mt-6 w-full" variant="secondary" onClick={() => setOrder(p.id)}>
                    {d.requestQuote}
                  </Button>
                )}
                {p.priceUah && <p className="mt-2 text-center text-[11px] text-ink2">{d.payMethods}</p>}
              </div>
            </Reveal>
          );
        })}
      </div>
      <OrderPanel
        open={order ? "consult" : null}
        title={order ? d.packages[order].name : undefined}
        extraContext={order ? { package: order } : undefined}
        onClose={() => setOrder(null)}
      />
    </>
  );
}
