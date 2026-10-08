import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/site-config";

/** Apenas URLs públicas, canônicas e indexáveis (apex, sem www). `/obrigado` fica de fora. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteConfig.url.replace(/\/$/, "");

  return [
    {
      url: origin,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${origin}/privacidade`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
