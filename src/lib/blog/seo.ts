import { siteConfig } from "@/data/site-config";
import { personAuthor } from "@/lib/seo/learning-jsonld";

export function blogPostingJsonLd(input: {
  title: string;
  description: string;
  path: string;
  publishedAt: Date;
  updatedAt: Date;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    inLanguage: "pt-BR",
    datePublished: input.publishedAt.toISOString(),
    dateModified: input.updatedAt.toISOString(),
    mainEntityOfPage: `${siteConfig.url}${input.path}`,
    author: personAuthor(),
    publisher: { "@type": "Person", name: siteConfig.name, url: siteConfig.url },
    ...(input.image ? { image: input.image } : {}),
  };
}

export function blogMetadata(input: { title: string; excerpt: string; seoTitle?: string | null; seoDescription?: string | null; path: string; image?: string | null }) {
  const title = input.seoTitle?.trim() || input.title;
  const description = (input.seoDescription?.trim() || input.excerpt).slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: input.path },
    openGraph: {
      title,
      description,
      url: input.path,
      type: "article" as const,
      ...(input.image ? { images: [{ url: input.image }] } : {}),
    },
    robots: { index: true, follow: true },
  };
}
