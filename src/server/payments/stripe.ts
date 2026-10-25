import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutRequest, CheckoutSession, PaymentProvider, PaymentStatus } from "./types";

/**
 * Stripe Checkout (hosted) via the REST API — no SDK needed for two calls.
 * Apple Pay / Google Pay appear automatically on Checkout when wallets are enabled in the Dashboard.
 * Note: Stripe does not onboard Ukrainian legal entities; this provider needs a foreign entity
 * (e.g. PL/EE/US) and serves international buyers (diaspora). Charged in UAH; the card issuer converts.
 */
const API = "https://api.stripe.com/v1";
const key = () => process.env.STRIPE_SECRET_KEY;

async function stripe<T>(path: string, init?: { method?: string; form?: Record<string, string> }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`stripe ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  configured: () => !!key(),
  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const s = await stripe<{ id: string; url: string }>("/checkout/sessions", {
      method: "POST",
      form: {
        mode: "payment",
        customer_email: req.email,
        client_reference_id: req.orderId,
        "metadata[orderId]": req.orderId,
        "metadata[packageId]": req.packageId,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": req.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(req.amount),
        "line_items[0][price_data][product_data][name]": req.title,
        success_url: `${req.successUrl}${req.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: req.cancelUrl,
        locale: req.lang === "en" ? "en" : "auto",
      },
    });
    return { provider: "stripe", ref: s.id, url: s.url };
  },
  async status(ref: string): Promise<PaymentStatus> {
    const s = await stripe<{ status?: string; payment_status?: string }>(`/checkout/sessions/${encodeURIComponent(ref)}`);
    if (s.payment_status === "paid") return "paid";
    if (s.status === "expired") return "expired";
    if (s.status === "open" || s.status === "complete") return "pending";
    return "unknown";
  },
};

/**
 * Stripe-Signature check: HMAC-SHA256 of `${t}.${payload}` with the endpoint secret,
 * constant-time compare against any v1 signature, 5-minute tolerance against replay.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0 || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
