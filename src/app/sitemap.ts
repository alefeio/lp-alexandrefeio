import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/site-config";
import { publishedBlogSitemap } from "@/lib/blog/service";
import { sitemapLearningEntries } from "@/lib/learning/catalog";
import { buildPublicSitemap, marketingSitemap } from "@/lib/seo/public-sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteConfig.url.replace(/\/$/, "");
  try {
    const entries = await sitemapLearningEntries();
    let posts: Awaited<ReturnType<typeof publishedBlogSitemap>> = [];
    try {
      posts = await publishedBlogSitemap();
    } catch {
      posts = [];
    }
    return buildPublicSitemap(origin, { ...entries, posts });
  } catch {
    return marketingSitemap(origin);
  }
}
