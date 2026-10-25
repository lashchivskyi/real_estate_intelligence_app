import { NextResponse, type NextRequest } from "next/server";
import { matchDistrict } from "@/domain/location/district";
import { getCity } from "@/domain/location/registry";
import { rateLimited } from "@/server/rate-limit";
import { reverseAdminNames } from "@/server/sources/nominatim";

export const runtime = "nodejs";

/** District for a picked address: admin boundaries via reverse geocoding, nearest centre as fallback. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const city = getCity(sp.get("city"));
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (rateLimited(req, "district", 60, 60_000)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const names = await reverseAdminNames([lng, lat]);
  const hit = matchDistrict(city, [lng, lat], "error" in names ? [] : names);
  return NextResponse.json({ districtId: hit?.id ?? null, method: hit?.method ?? null }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
