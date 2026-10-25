import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getUser } from "@/server/auth";
import { audit, loadCaseFor } from "@/server/cases";
import { getDb, schema } from "@/server/db";
import { readLocal, signedUrl, storageBackend } from "@/server/storage";

export const runtime = "nodejs";

/** Authenticated file access: only people who can open the case. Remote: 5-min signed URL; local: streamed. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const db = await getDb();
  const [doc] = await db.select().from(schema.documents).where(eq(schema.documents.id, id)).limit(1);
  if (!doc?.caseId || !(await loadCaseFor(user, doc.caseId))) return new NextResponse(null, { status: 404 });
  await audit(doc.caseId, user, "document.viewed", { documentId: doc.id });
  if (storageBackend() === "supabase") {
    const url = await signedUrl(doc.storageKey);
    return url ? NextResponse.redirect(url) : new NextResponse(null, { status: 502 });
  }
  const bytes = await readLocal(doc.storageKey);
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": doc.mime,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
