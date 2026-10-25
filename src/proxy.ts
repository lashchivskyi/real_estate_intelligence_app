import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["uk", "en"] as const;
const DEFAULT = "uk";

function pickLocale(req: NextRequest): string {
  const cookie = req.cookies.get("lang")?.value;
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie;
  const header = req.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.trim().split(";")[0].toLowerCase();
    if (tag.startsWith("uk") || tag.startsWith("ru")) return "uk";
    if (tag.startsWith("en")) return "en";
  }
  return DEFAULT;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return;
  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API, Next internals, and any path with a file extension (assets, sitemap.xml, robots.txt, icons).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
