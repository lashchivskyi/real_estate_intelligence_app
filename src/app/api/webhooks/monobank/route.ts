import { NextResponse, type NextRequest } from "next/server";
import { mapMonoStatus, verifyMonoWebhook } from "@/server/payments/monobank";
import { saveOrder } from "@/server/payments";

export const runtime = "nodejs";

/** monobank → invoice status changes. Signature-verified; delivery order is not guaranteed, so the DB keeps the latest modifiedDate. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!(await verifyMonoWebhook(raw, req.headers.get("x-sign")))) return new NextResponse(null, { status: 401 });
  const body = JSON.parse(raw) as { invoiceId: string; status: string; reference?: string; amount?: number; ccy?: number; modifiedDate?: string };
  if (body.reference) {
    await saveOrder({ id: body.reference, provider: "monobank", provider_ref: body.invoiceId, status: mapMonoStatus(body.status), amount_minor: body.amount, currency: "UAH" });
  }
  return new NextResponse(null, { status: 200 });
}
