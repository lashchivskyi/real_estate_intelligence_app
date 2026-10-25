import type { NextRequest } from "next/server";

/** Best-effort per-IP sliding window (single instance). Replace with a shared store when scaling out. */
const buckets = new Map<string, number[]>();

export function rateLimited(req: NextRequest, scope: string, max: number, windowMs: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) buckets.clear();
  return hits.length > max;
}
