/**
 * Server-side HTTP for external data sources: timeout, identifying User-Agent,
 * Next data-cache revalidation, and a result type that never throws — every
 * failure becomes a visible "fallback/error" status instead of a broken report.
 */
export type FetchResult<T> = { ok: true; data: T; fetchedAt: string } | { ok: false; error: string };

export const USER_AGENT =
  process.env.APP_USER_AGENT ?? `Vidomo/0.2 (+${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}; ${process.env.CONTACT_EMAIL ?? "contact@example.com"})`;

export async function getJson<T>(
  url: string,
  opts: { revalidate: number; headers?: Record<string, string>; timeoutMs?: number } = { revalidate: 3600 },
): Promise<FetchResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...opts.headers },
      signal: ctrl.signal,
      next: { revalidate: opts.revalidate },
    } as RequestInit);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: (await res.json()) as T, fetchedAt: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** Run async tasks with a concurrency cap (polite to rate-limited APIs). */
export async function mapLimit<A, B>(items: A[], limit: number, fn: (a: A) => Promise<B>): Promise<B[]> {
  const out: B[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
