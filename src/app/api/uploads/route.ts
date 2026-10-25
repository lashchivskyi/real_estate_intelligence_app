import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimited } from "@/server/rate-limit";
import { MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES, mimeOf, putObject, sniff } from "@/server/storage";
import { getUser } from "@/server/auth";
import { audit, loadCaseFor } from "@/server/cases";
import { getDb, schema } from "@/server/db";

export const runtime = "nodejs";

/**
 * Document & photo intake. Validates count/size/type (magic bytes), stores into the PRIVATE bucket
 * under intake/<batch>/<uuid>.<ext> (original names are not used in paths), returns a batch id that
 * links the files to the order (or the case directly, when uploaded from inside a case).
 */
export async function POST(req: NextRequest) {
  if (rateLimited(req, "uploads", 10, 10 * 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_form" }, { status: 400 });
  }
  if (form.get("consent") !== "true") return NextResponse.json({ error: "consent_required" }, { status: 400 });
  const aiConsent = form.get("aiConsent") === "true";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0 || files.length > MAX_FILES) return NextResponse.json({ error: "file_count" }, { status: 400 });
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total > MAX_TOTAL_BYTES || files.some((f) => f.size > MAX_FILE_BYTES)) return NextResponse.json({ error: "too_large" }, { status: 413 });

  // Optional: attach directly to a case the signed-in user can open (client cabinet / specialist).
  const user = await getUser();
  const caseIdRaw = String(form.get("caseId") ?? "");
  const kase = user && caseIdRaw ? await loadCaseFor(user, caseIdRaw) : null;
  const batch = randomUUID();
  const db = await getDb();
  const out: Array<{ id: string; name: string; size: number; kind: string }> = [];
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniff(bytes.slice(0, 16));
    if (!kind) return NextResponse.json({ error: "unsupported_type", file: f.name }, { status: 415 });
    const id = randomUUID();
    const key = `intake/${batch}/${id}.${kind}`;
    const ok = await putObject(key, bytes, kind);
    if (!ok) return NextResponse.json({ error: "store_failed" }, { status: 502 });
    await db.insert(schema.documents).values({
      id,
      batch,
      caseId: kase?.case.id ?? null,
      uploadedBy: user?.id ?? null,
      storageKey: key,
      name: f.name.slice(0, 120),
      mime: mimeOf(kind),
      size: f.size,
      kind: user && user.role !== "client" ? "inspection_photo" : "client",
      aiConsent,
    });
    out.push({ id, name: f.name.slice(0, 120), size: f.size, kind });
  }
  // Audit trail without PII (no file names).
  console.info(JSON.stringify({ evt: "documents_uploaded", batch, count: out.length, bytes: total, aiConsent }));
  if (kase) await audit(kase.case.id, user, "documents.attached", { count: out.length });
  return NextResponse.json({ batch, files: out, aiConsent });
}
