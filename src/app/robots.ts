import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/uk/report?", "/en/report?", "/uk/admin", "/en/admin", "/uk/work", "/en/work", "/uk/account", "/en/account", "/uk/cases", "/en/cases"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
