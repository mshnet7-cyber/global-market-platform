import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://global-market-platform.vercel.app";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/connect", "/api/"] }], sitemap: `${base}/sitemap.xml` };
}
