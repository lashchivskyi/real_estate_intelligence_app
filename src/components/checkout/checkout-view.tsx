"use client";

import { useState, type FormEvent } from "react";
import type { CheckoutPackageId } from "@/config/packages";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { motion } from "../motion";
import { useI18n } from "../providers";
import { Button, Field, Input, Pill } from "../ui/primitives";

type Pkg = CheckoutPackageId;
type Provider = "monobank" | "stripe";

function WalletMarks() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-bg">Apple Pay</span>
      <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold">Google Pay</span>
      <span className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold">VISA · MC</span>
    </span>
  );
}

const readBatch = () => {
  try {
    return localStorage.getItem("bi.uploadBatch") ?? "";
  } catch {
    return "";
  }
};

/** UAH is what is charged; the selected display currency is shown as an approximation next to it. */
export function CheckoutView({
  initial,
  options,
  providers,
  cancelled,
  reportQuery,
  objectLabel,
}: {
  initial: Pkg;
  options: Array<{ id: Pkg; uah: number }>;
  providers: Record<Provider, boolean>;
  cancelled: boolean;
  reportQuery: string;
  objectLabel: string | null;
}) {
  const { dict, lang, money, moneyExact, currency, rates, f } = useI18n();
  const d = dict.checkout;
  const [pkg, setPkg] = useState<Pkg>(initial);
  const [provider, setProvider] = useState<Provider>(providers.monobank || !providers.stripe ? "monobank" : "stripe");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error" | "pending">("idle");
  const [caseNo, setCaseNo] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const opt = options.find((o) => o.id === pkg)!;
  const available = providers[provider];
  const approx = (uah: number) => (currency === "UAH" ? null : `≈ ${money(uah, "UAH")}`);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    track("report_requested", { package: pkg, provider, stage: "checkout" });
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packageId: pkg, provider, email, phone, lang, consent, reportQuery, uploadBatch: readBatch() }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { url?: string; error?: string; pending?: boolean; caseNumber?: string | null } | null;
    if (res?.status === 202 && j?.pending) {
      setCaseNo(j.caseNumber ?? null);
      setState("pending");
      return;
    }
    if (res?.ok && j?.url) {
      window.location.assign(j.url);
      return;
    }
    setState("error");
  }

  const methods: Array<{ id: Provider; title: string; body: string }> = [
    { id: "monobank", title: d.mono.title, body: d.mono.body },
    { id: "stripe", title: d.stripe.title, body: d.stripe.body },
  ];

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-8">
        {cancelled && <p className="rounded-xl bg-warnbg px-4 py-3 text-sm">{d.cancelled}</p>}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">{d.package}</legend>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={pkg === o.id}
                onClick={() => setPkg(o.id)}
                className={cn("rounded-2xl border p-4 text-left transition-all", pkg === o.id ? "border-brand bg-surface shadow-card ring-1 ring-brand" : "border-line bg-surface/60 hover:border-ink2")}
              >
                <span className="block font-semibold">{dict.services.packages[o.id].name}</span>
                <span className="num mt-2 block text-lg">{moneyExact(o.uah, "UAH")}</span>
                {approx(o.uah) && <span className="num block text-xs text-ink2">{approx(o.uah)}</span>}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">{d.method}</legend>
          <div className="space-y-3" role="radiogroup">
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={provider === m.id}
                onClick={() => setProvider(m.id)}
                className={cn("flex w-full flex-wrap items-center gap-4 rounded-2xl border p-4 text-left transition-all", provider === m.id ? "border-brand bg-surface ring-1 ring-brand" : "border-line bg-surface/60 hover:border-ink2")}
              >
                <span className={cn("grid h-5 w-5 place-items-center rounded-full border-2", provider === m.id ? "border-brand" : "border-line")}>
                  {provider === m.id && <motion.span layoutId="pm-dot" className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {m.title}
                    {m.id === "monobank" && <Pill tone="good">{d.recommended}</Pill>}
                    {!providers[m.id] && <Pill tone="neutral">{d.notConfigured}</Pill>}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink2">{m.body}</span>
                </span>
                <WalletMarks />
              </button>
            ))}
          </div>
          {rates.USD && rates.EUR && <p className="mt-2 text-xs text-ink2">{f(d.fxNote, { usd: rates.USD.toFixed(2), eur: rates.EUR.toFixed(2) })}</p>}
        </fieldset>
      </div>

      <aside className="h-fit rounded-3xl border border-line bg-surface p-6 shadow-card lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink2">{d.summary}</p>
        <p className="mt-3 text-xl font-semibold">{dict.services.packages[pkg].name}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-ink2">
          {dict.services.packages[pkg].items.map((x) => (
            <li key={x}>· {x}</li>
          ))}
        </ul>
        <p className="num mt-5 border-t border-line pt-4 text-3xl font-semibold">{moneyExact(opt.uah, "UAH")}</p>
        {approx(opt.uah) && <p className="num text-sm text-ink2">{approx(opt.uah)}</p>}
        <p className="mt-1 text-xs text-warn">{dict.services.hypothesis}</p>
        <div className="mt-5 space-y-4">
          {objectLabel && (
            <p className="rounded-xl bg-surface2 px-3 py-2 text-sm">
              <span className="text-ink2">{d.forObject}: </span>
              {objectLabel}
            </p>
          )}
          <Field label={d.email} htmlFor="c-email">
            <Input id="c-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label={d.phone} htmlFor="c-phone" optional={dict.common.optional}>
            <Input id="c-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          </Field>
          <label className="flex items-start gap-2.5 text-sm text-ink2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            {d.consent}
          </label>
          <Button type="submit" className="w-full py-3" disabled={!email || !consent || state === "loading" || state === "pending"}>
            {state === "loading" ? d.redirecting : available ? d.pay : d.sendRequest}
          </Button>
          <p aria-live="polite" className="text-sm">
            {state === "error" && <span className="text-bad">{d.error}</span>}
            {state === "pending" && <span className="text-good">{d.pendingBody.replace("{n}", caseNo ?? "—")}</span>}
          </p>
          <p className="text-xs text-ink2">{d.secure}</p>
        </div>
      </aside>
    </form>
  );
}
