import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPackage } from "@/config/packages";
import { getDictionary } from "@/i18n";
import { getProvider, saveOrder } from "@/server/payments";
import { CHECKOUT_PACKAGES } from "@/config/packages";
import { apartmentInputSchema } from "@/domain/property/types";
import { briefFromParams, paramsToInput } from "@/lib/report-service";
import { getUser } from "@/server/auth";
import { attachBatch, createCase } from "@/server/cases";
import { getDb, schema as dbs } from "@/server/db";

export const runtime = "nodejs";

const schema = z.object({
  packageId: z.enum(CHECKOUT_PACKAGES),
  provider: z.enum(["monobank", "stripe"]),
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  lang: z.enum(["uk", "en"]).default("uk"),
  consent: z.literal(true),
  /** Report query string: the property this order is for (from the report page). */
  reportQuery: z.string().max(2000).optional().default(""),
  uploadBatch: z.string().max(64).optional().default(""),
});

/**
 * Creates a hosted checkout. Price comes from config (never the client) and is charged in UAH.
 * Returns the provider URL to redirect to.
 */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { packageId, provider: pid, email, lang, name, phone, reportQuery, uploadBatch } = parsed.data;
  const pkg = getPackage(packageId);
  const provider = getProvider(pid);
  if (!pkg?.priceUah || !provider) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // The order always becomes a case (with the property when we know it) — even if online payment
  // is not available yet, so the manager can follow up and invoice.
  let caseId: string | null = null;
  let caseNo: string | null = null;
  const sp = Object.fromEntries(new URLSearchParams(reportQuery));
  const prop = reportQuery ? apartmentInputSchema.safeParse(paramsToInput(sp)) : null;
  const user = await getUser();
  if (prop?.success) {
    const lat = Number(sp.lat);
    const lng = Number(sp.lng);
    const c = await createCase({
      property: { ...prop.data, coords: Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : undefined },
      packageId,
      brief: (briefFromParams(sp) as Record<string, unknown> | undefined) ?? null,
      contact: { name, email, phone },
      clientId: user?.role === "client" ? user.id : null,
      source: "checkout",
      priceUah: pkg.priceUah,
    });
    caseId = c.id;
    caseNo = c.number;
    await attachBatch(c.id, uploadBatch);
  } else {
    const db = await getDb();
    await db.insert(dbs.leads).values({ kind: `checkout:${packageId}`, lang, name, email, phone, payload: { packageId } });
  }
  if (!provider.configured()) return NextResponse.json({ pending: true, caseNumber: caseNo }, { status: 202 });

  // UAH is the charge currency for both providers (Stripe settles UAH presentment into the account currency).
  const amount = pkg.priceUah * 100;
  const currency = "UAH" as const;

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const orderId = randomUUID();
  const dict = await getDictionary(lang);
  try {
    const session = await provider.createCheckout({
      orderId,
      packageId,
      title: `${dict.meta.siteName} — ${dict.services.packages[packageId].name}`,
      email,
      lang,
      amount,
      currency,
      successUrl: `${origin}/${lang}/checkout/result?provider=${pid}&order=${orderId}`,
      cancelUrl: `${origin}/${lang}/checkout?package=${packageId}&cancelled=1`,
      webhookUrl: `${origin}/api/webhooks/${pid}`,
    });
    await saveOrder({ id: orderId, package_id: packageId, case_id: caseId, provider: pid, provider_ref: session.ref, status: "created", amount_minor: amount, currency, email });
    const res = NextResponse.json({ url: session.url });
    // monobank's redirect does not carry the invoice id: keep it (httpOnly, short-lived) to verify status on return.
    if (pid === "monobank") res.cookies.set("mono_inv", session.ref, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 3600, path: "/" });
    return res;
  } catch (e) {
    console.error(JSON.stringify({ evt: "checkout_failed", provider: pid, msg: e instanceof Error ? e.message : "unknown" }));
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }
}
