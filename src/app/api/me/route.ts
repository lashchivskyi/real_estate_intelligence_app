import { NextResponse } from "next/server";
import { getUser } from "@/server/auth";

export const runtime = "nodejs";

/** Who is signed in (for the client-side header). Keeps marketing pages static. */
export async function GET() {
  const u = await getUser();
  return NextResponse.json(u ? { user: { name: u.name, role: u.role } } : { user: null }, { headers: { "Cache-Control": "private, no-store" } });
}
