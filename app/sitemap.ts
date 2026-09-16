import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://global-market-platform.vercel.app";
  const paths = ["/", "/gold", "/silver", "/news", "/demo", "/pricing"];
  return paths.map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "/" ? "hourly" : "daily", priority: path === "/" ? 1 : 0.7 }));
}
