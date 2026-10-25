import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { briefSchema } from "@/domain/brief";
import { apartmentInputSchema } from "@/domain/property/types";
import { briefFromParams, paramsToInput } from "@/lib/report-service";
import { attachBatch, createCase } from "@/server/cases";
import { getDb, schema as db_ } from "@/server/db";

export const runtime = "nodejs";

const base = z.object({
  lang: z.enum(["uk", "en"]).default("uk"),
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""), // honeypot: must stay empty
});

const schema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.enum(["inspection", "legal", "consult", "digital"]), context: z.record(z.string(), z.unknown()).optional() }),
  base.extend({ kind: z.literal("brief"), brief: briefSchema }),
]);

/* Best-effort per-IP limiter. Replace with a shared store when running more than one instance. */
const hits = new Map<string, number[]>();
function limited(ip: string, max = 6, windowMs = 10 * 60_000) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Honeypot filled → pretend success so bots learn nothing.
  if (typeof json === "object" && json && typeof (json as { website?: unknown }).website === "string" && (json as { website: string }).website.length > 0) {
    return NextResponse.json({ ok: true, stored: true });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid", fields: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const { kind, lang, name, email, phone, note } = parsed.data;
  const payload = parsed.data.kind === "brief" ? { brief: parsed.data.brief } : { context: parsed.data.context ?? {} };

  // Every request becomes a lead; one with a report context also becomes a case with that property.
  const db = await getDb();
  let caseId: string | null = null;
  const ctx = (parsed.data.kind !== "brief" ? parsed.data.context : undefined) ?? {};
  const reportQuery = typeof ctx.reportQuery === "string" ? ctx.reportQuery : "";
  if (reportQuery && kind !== "brief") {
    const sp = Object.fromEntries(new URLSearchParams(reportQuery));
    const prop = apartmentInputSchema.safeParse(paramsToInput(sp));
    if (prop.success) {
      const lat = Number(sp.lat);
      const lng = Number(sp.lng);
      const c = await createCase({
        property: { ...prop.data, coords: Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : undefined },
        packageId: kind === "legal" ? "legal" : kind === "inspection" ? "inspection" : "digital",
        brief: (briefFromParams(sp) as Record<string, unknown> | undefined) ?? null,
        contact: { name, email, phone, note },
        source: `request:${kind}`,
      });
      caseId = c.id;
      await attachBatch(c.id, typeof ctx.uploadBatch === "string" ? ctx.uploadBatch : null);
    }
  }
  await db.insert(db_.leads).values({ kind, lang, name, email, phone, note, payload, caseId });
  return NextResponse.json({ ok: true, stored: true });
}
