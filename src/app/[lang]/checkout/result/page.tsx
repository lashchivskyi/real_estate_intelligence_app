import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PurchaseTracker } from "@/components/checkout/purchase-tracker";
import { getDictionary, isLang } from "@/i18n";
import { getProvider } from "@/server/payments";
import type { PaymentStatus } from "@/server/payments/types";

export const metadata: Metadata = { robots: { index: false } };

/** The status shown here is verified server-side with the provider — never trusted from the URL. */
export default async function CheckoutResult({ params, searchParams }: PageProps<"/[lang]/checkout/result">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const d = dict.checkout.result;
  const provider = getProvider(String(sp.provider ?? ""));
  const ref = provider?.id === "stripe" ? String(sp.session_id ?? "") : (await cookies()).get("mono_inv")?.value ?? "";

  let status: PaymentStatus = "unknown";
  if (provider?.configured() && ref) {
    try {
      status = await provider.status(ref);
    } catch {
      status = "unknown";
    }
  }
  const tone = status === "paid" ? "text-good" : status === "failed" || status === "expired" ? "text-bad" : "text-warn";
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{dict.checkout.title}</p>
      <h1 className={`display mt-3 text-4xl ${tone}`}>{d[status]}</h1>
      <p className="mt-4 text-ink2">{status === "paid" ? d.paidBody : d.otherBody}</p>
      {status === "paid" && <PurchaseTracker order={String(sp.order ?? "")} provider={provider?.id ?? ""} />}
      <div className="mt-10 flex justify-center gap-3">
        <Link href={`/${lang}`} className="rounded-full border border-line px-5 py-2.5 font-medium">
          {d.home}
        </Link>
        {status !== "paid" && (
          <Link href={`/${lang}/checkout`} className="rounded-full bg-brand px-5 py-2.5 font-medium text-brandink">
            {d.retry}
          </Link>
        )}
      </div>
    </div>
  );
}
