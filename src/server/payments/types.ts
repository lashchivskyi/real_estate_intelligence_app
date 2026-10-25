export type ProviderId = "monobank" | "stripe";

export interface CheckoutRequest {
  orderId: string;
  packageId: string;
  title: string;
  email: string;
  lang: "uk" | "en";
  /** Minor units (kopiyky / cents). */
  amount: number;
  currency: "UAH" | "USD" | "EUR";
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
}

export interface CheckoutSession {
  provider: ProviderId;
  /** Provider reference: monobank invoiceId / Stripe session id. */
  ref: string;
  url: string;
}

export type PaymentStatus = "paid" | "pending" | "failed" | "expired" | "unknown";

/**
 * Hosted-checkout providers. Both hosted pages offer Apple Pay and Google Pay
 * (monobank: enabled for the merchant; Stripe: wallets on Checkout, enable in Dashboard).
 * Card data never touches our servers (PCI scope stays SAQ-A).
 */
export interface PaymentProvider {
  id: ProviderId;
  configured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  status(ref: string): Promise<PaymentStatus>;
}
