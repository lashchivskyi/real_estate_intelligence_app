import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { recordEvent } from "@/server/cases";

export const runtime = "nodejs";

const schema = z.object({
  event: z.enum([
    "brief_started",
    "brief_step_completed",
    "brief_completed",
    "property_added",
    "report_requested",
    "report_viewed",
    "comparison_created",
    "inspection_requested",
    "consultation_requested",
    "purchase_completed",
    "city_changed",
    "city_detected",
    "report_printed",
    "language_changed",
    "currency_changed",
  ]),
  props: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
  path: z.string().max(200).optional(),
  ts: z.number().optional(),
});

/** Structured server log sink. Swap for PostHog/Plausible/BigQuery by forwarding here; clients don't change. */
export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    // Stored for the owner dashboard funnel (no PII: props are ids, enums and counts only).
    await recordEvent(body.event, body.props ?? {}, body.path).catch(() => console.info(JSON.stringify({ evt: "analytics", ...body })));
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
