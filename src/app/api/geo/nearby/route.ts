import { NextResponse, type NextRequest } from "next/server";
import { nearby } from "@/server/sources/geo";
import { rateLimited } from "@/server/rate-limit";

export const runtime = "nodejs";

/** Nearest essentials (stop, shop, pharmacy, school…) with walking distance for a chosen address. */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  // Western Ukraine bounding box — keeps the proxy from being used as a free global POI API.
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 47.5 || lat > 50.8 || lng < 22 || lng > 26.5) {
    return NextResponse.json({ error: "out_of_area" }, { status: 400 });
  }
  if (rateLimited(req, "nearby", 30, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const r = await nearby([lng, lat], 15);
  if ("error" in r) return NextResponse.json({ places: [], error: r.error });
  return NextResponse.json({ places: r.places, fetchedAt: r.fetchedAt, provider: r.provider }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
