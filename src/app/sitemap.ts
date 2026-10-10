import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/site-config";
import { sitemapLearningEntries } from "@/lib/learning/catalog";
import { buildPublicSitemap, marketingSitemap } from "@/lib/seo/public-sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteConfig.url.replace(/\/$/, "");
  try {
    const entries = await sitemapLearningEntries();
    return buildPublicSitemap(origin, entries);
  } catch {
    return marketingSitemap(origin);
  }
}
