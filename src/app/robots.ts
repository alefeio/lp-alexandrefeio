import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/site-config";

export default function robots(): MetadataRoute.Robots {
  const origin = siteConfig.url.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/entrar", "/cadastro", "/esqueci-senha", "/redefinir-senha", "/verificar-email"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: new URL(origin).host,
  };
}
