import type { MetadataRoute } from "next";
import { PLATFORM_PAGES, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return PLATFORM_PAGES.map((page) => ({
    url: `${SITE_URL}${page.path === "/" ? "" : page.path}`,
    changeFrequency: "weekly",
    priority: page.path === "/" ? 1 : 0.7,
  }));
}
