import { createPublicKey, verify } from "node:crypto";
import type { CheckoutRequest, CheckoutSession, PaymentProvider, PaymentStatus } from "./types";

/**
 * monobank acquiring ("plata by mono"): hosted invoice page with card, Apple Pay, Google Pay and
 * the monobank app. Docs: monobank.ua/api-docs/acquiring. Token: MONOBANK_TOKEN (test tokens at api.monobank.ua).
 */
const BASE = "https://api.monobank.ua";
const token = () => process.env.MONOBANK_TOKEN;

const STATUS: Record<string, PaymentStatus> = {
  success: "paid",
  created: "pending",
  processing: "pending",
  hold: "pending",
  failure: "failed",
  reversed: "failed",
  expired: "expired",
};
export const mapMonoStatus = (s: string | undefined): PaymentStatus => (s ? STATUS[s] ?? "unknown" : "unknown");

async function mono<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-Token": token() ?? "", "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`monobank ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const monobank: PaymentProvider = {
  id: "monobank",
  configured: () => !!token(),
  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    if (req.currency !== "UAH") throw new Error("monobank checkout is charged in UAH");
    const body = {
      amount: req.amount,
      ccy: 980,
      merchantPaymInfo: {
        reference: req.orderId,
        destination: req.title,
        basketOrder: [{ name: req.title, qty: 1, sum: req.amount, code: req.packageId }],
      },
      redirectUrl: req.successUrl,
      webHookUrl: req.webhookUrl,
      validity: 3600,
      paymentType: "debit",
    };
    const r = await mono<{ invoiceId: string; pageUrl: string }>("/api/merchant/invoice/create", { method: "POST", body: JSON.stringify(body) });
    return { provider: "monobank", ref: r.invoiceId, url: r.pageUrl };
  },
  async status(ref: string): Promise<PaymentStatus> {
    const r = await mono<{ status?: string }>(`/api/merchant/invoice/status?invoiceId=${encodeURIComponent(ref)}`);
    return mapMonoStatus(r.status);
  },
};

/* ---- webhook signature (X-Sign: base64 ECDSA over the raw body; key from /api/merchant/pubkey) ---- */
let cachedKey: string | null = null;

async function pubkeyPem(refresh = false): Promise<string> {
  if (cachedKey && !refresh) return cachedKey;
  const r = await mono<{ key: string }>("/api/merchant/pubkey");
  cachedKey = Buffer.from(r.key, "base64").toString("utf8");
  return cachedKey;
}

/** Pure check, exported for tests. */
export function verifyMonoSignature(rawBody: string, xSignB64: string, pem: string): boolean {
  try {
    return verify("sha256", Buffer.from(rawBody), createPublicKey(pem), Buffer.from(xSignB64, "base64"));
  } catch {
    return false;
  }
}

/** Verifies with the cached key; re-fetches once if it fails (key rotation, per monobank docs). */
export async function verifyMonoWebhook(rawBody: string, xSign: string | null): Promise<boolean> {
  if (!xSign || !token()) return false;
  if (verifyMonoSignature(rawBody, xSign, await pubkeyPem())) return true;
  return verifyMonoSignature(rawBody, xSign, await pubkeyPem(true));
}
