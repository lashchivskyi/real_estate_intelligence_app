import { NextResponse, type NextRequest } from "next/server";
import { getCity } from "@/domain/location/registry";
import { suggest } from "@/server/sources/geo";
import { rateLimited } from "@/server/rate-limit";

export const runtime = "nodejs";

/** Address type-ahead (street + house number) inside the selected city. Proxied so the provider can be swapped/keyed server-side. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const city = getCity(req.nextUrl.searchParams.get("city"));
  if (q.length < 3 || !city) return NextResponse.json({ items: [] });
  if (rateLimited(req, "suggest", 90, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const r = await suggest(q, city);
  if ("error" in r) return NextResponse.json({ items: [], error: r.error }, { status: 200 });
  return NextResponse.json({ items: r.items, provider: r.provider }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
