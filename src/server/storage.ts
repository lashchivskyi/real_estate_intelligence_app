import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private document storage. Supabase Storage (private bucket) when configured; otherwise the local
 * disk under .data/uploads (outside public/, so never directly reachable). Files are only served
 * through the authenticated /api/files/[id] route; every access is audit-logged.
 */
const url = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "documents";
const LOCAL_ROOT = () => process.env.UPLOADS_DIR ?? path.join(process.cwd(), ".data", "uploads");
const remote = () => !!url() && !!key();
/** Storage is always available: remote bucket or local disk. */
export const storageConfigured = () => true;
export const storageBackend = () => (remote() ? "supabase" : "local");

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export type FileKind = "pdf" | "jpg" | "png" | "webp" | "heic";
const MIME: Record<FileKind, string> = { pdf: "application/pdf", jpg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };

/** Detect type from magic bytes (the browser-provided MIME type is not trusted). */
export function sniff(b: Uint8Array): FileKind | null {
  const s = (o: number, n: number) => String.fromCharCode(...b.slice(o, o + n));
  if (s(0, 4) === "%PDF") return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && s(1, 3) === "PNG") return "png";
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "webp";
  if (s(4, 4) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)$/.test(s(8, 4))) return "heic";
  return null;
}

export const mimeOf = (kind: FileKind) => MIME[kind];

/** Keys are generated server-side (intake/<batch>/<uuid>.<ext>); reject anything else. */
const safeKey = (k: string) => /^[a-z0-9/_-]+\.(pdf|jpg|png|webp|heic)$/i.test(k) && !k.includes("..");

export async function putObject(key_: string, body: Uint8Array, kind: FileKind): Promise<boolean> {
  if (!safeKey(key_)) return false;
  if (!remote()) {
    const file = path.join(LOCAL_ROOT(), key_);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return true;
  }
  const res = await fetch(`${url()}/storage/v1/object/${BUCKET}/${key_}`, {
    method: "POST",
    headers: { apikey: key() ?? "", authorization: `Bearer ${key()}`, "content-type": MIME[kind], "x-upsert": "false", "cache-control": "no-store" },
    body: Buffer.from(body),
  });
  return res.ok;
}

/** Local backend: read bytes (for the authenticated file route). */
export async function readLocal(key_: string): Promise<Buffer | null> {
  if (!safeKey(key_)) return null;
  try {
    return await readFile(path.join(LOCAL_ROOT(), key_));
  } catch {
    return null;
  }
}

/** Signed read URL for staff tooling (default 5 minutes). */
export async function signedUrl(key_: string, expiresIn = 300): Promise<string | null> {
  const res = await fetch(`${url()}/storage/v1/object/sign/${BUCKET}/${key_}`, {
    method: "POST",
    headers: { apikey: key() ?? "", authorization: `Bearer ${key()}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { signedURL?: string };
  return j.signedURL ? `${url()}/storage/v1${j.signedURL}` : null;
}
