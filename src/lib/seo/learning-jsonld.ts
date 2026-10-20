import { siteConfig } from "@/data/site-config";

export function personAuthor() {
  return {
    "@type": "Person",
    name: siteConfig.name,
    url: `${siteConfig.url}/#sobre`,
  };
}

export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}

export function lessonJsonLd(input: {
  title: string;
  description: string;
  path: string;
  publishedAt: Date | null;
  updatedAt: Date;
  free: boolean;
  paywall: boolean;
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Article", "LearningResource"],
    headline: input.title,
    description: input.description,
    inLanguage: "pt-BR",
    datePublished: (input.publishedAt ?? input.updatedAt).toISOString(),
    dateModified: input.updatedAt.toISOString(),
    author: personAuthor(),
    mainEntityOfPage: `${siteConfig.url}${input.path}`,
    isAccessibleForFree: input.free,
    ...(input.paywall
      ? {
          hasPart: {
            "@type": "WebPageElement",
            isAccessibleForFree: false,
            cssSelector: ".lesson-paywall",
          },
        }
      : {}),
  };
}

export function courseJsonLd(input: {
  title: string;
  description: string;
  path: string;
  /** Quando true, indica conteúdo gratuito disponível sem Offer pago. */
  hasFreeContent?: boolean;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: input.title,
    description: input.description,
    url: `${siteConfig.url}${input.path}`,
    inLanguage: "pt-BR",
    provider: personAuthor(),
    ...(input.hasFreeContent ? { isAccessibleForFree: true } : {}),
  };
}

export function collectionPageJsonLd(input: {
  name: string;
  description: string;
  path: string;
  courses: { name: string; path: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: `${siteConfig.url}${input.path}`,
    inLanguage: "pt-BR",
    hasPart: input.courses.map((course) => ({
      "@type": "Course",
      name: course.name,
      url: `${siteConfig.url}${course.path}`,
    })),
  };
}
