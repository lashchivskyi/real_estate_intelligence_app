import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeSignature } from "@/server/payments/stripe";
import { saveOrder } from "@/server/payments";

export const runtime = "nodejs";

/** Stripe → checkout.session.* events. Raw body + Stripe-Signature verified before anything is trusted. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), process.env.STRIPE_WEBHOOK_SECRET ?? "")) {
    return new NextResponse(null, { status: 400 });
  }
  const event = JSON.parse(raw) as { type: string; data: { object: { id: string; client_reference_id?: string; payment_status?: string; amount_total?: number; currency?: string; metadata?: Record<string, string> } } };
  const s = event.data.object;
  const orderId = s.client_reference_id ?? s.metadata?.orderId;
  if (orderId && event.type.startsWith("checkout.session.")) {
    const status = event.type === "checkout.session.expired" ? "expired" : s.payment_status === "paid" ? "paid" : event.type === "checkout.session.async_payment_failed" ? "failed" : "pending";
    await saveOrder({ id: orderId, package_id: s.metadata?.packageId, provider: "stripe", provider_ref: s.id, status, amount_minor: s.amount_total, currency: s.currency?.toUpperCase() });
  }
  return NextResponse.json({ received: true });
}
