import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { monobank } from "./monobank";
import { stripeProvider } from "./stripe";
import type { PaymentProvider, PaymentStatus, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, PaymentProvider> = { monobank, stripe: stripeProvider };
export const getProvider = (id: string): PaymentProvider | undefined => PROVIDERS[id as ProviderId];
export const availability = () => ({ monobank: monobank.configured(), stripe: stripeProvider.configured() });

/** Persists payment state; a paid payment marks its case as paid. Status is always re-checked with the provider. */
export async function saveOrder(row: {
  id: string;
  package_id?: string;
  case_id?: string | null;
  provider: ProviderId;
  provider_ref?: string;
  status: PaymentStatus | "created";
  amount_minor?: number;
  currency?: string;
  email?: string;
}) {
  console.info(JSON.stringify({ evt: "order", id: row.id, provider: row.provider, status: row.status, package: row.package_id }));
  const db = await getDb();
  const values = {
    id: row.id,
    caseId: row.case_id ?? null,
    packageId: row.package_id ?? null,
    provider: row.provider,
    providerRef: row.provider_ref ?? null,
    status: row.status,
    amountMinor: row.amount_minor ?? null,
    currency: row.currency ?? null,
    email: row.email ?? null,
  };
  const { id, caseId, ...rest } = values;
  void id;
  const set = Object.fromEntries(Object.entries({ ...rest, ...(caseId ? { caseId } : {}) }).filter(([, v]) => v !== null && v !== undefined));
  await db.insert(schema.payments).values(values).onConflictDoUpdate({ target: schema.payments.id, set: { ...set, updatedAt: new Date() } });
  if (row.status === "paid") {
    const [p] = await db.select({ caseId: schema.payments.caseId }).from(schema.payments).where(eq(schema.payments.id, row.id)).limit(1);
    if (p?.caseId) {
      await db.update(schema.cases).set({ paid: true, updatedAt: new Date() }).where(eq(schema.cases.id, p.caseId));
      await db.insert(schema.auditLog).values({ caseId: p.caseId, action: "payment.updated", meta: { status: "paid", provider: row.provider } });
    }
  }
}
