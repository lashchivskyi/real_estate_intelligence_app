import type { MetadataRoute } from "next";
import { LANGS } from "@/i18n";

const PATHS = ["", "/check", "/brief", "/compare", "/inspection", "/services", "/methodology", "/report/sample", "/brand"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return PATHS.flatMap((p) =>
    LANGS.map((l) => ({
      url: `${base}/${l}${p}`,
      changeFrequency: "monthly" as const,
      priority: p === "" ? 1 : 0.6,
      alternates: { languages: Object.fromEntries(LANGS.map((x) => [x, `${base}/${x}${p}`])) },
    })),
  );
}
