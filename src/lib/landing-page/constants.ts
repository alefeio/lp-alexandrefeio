export const LANDING_PAGE_DOCUMENT_SCHEMA_VERSION = 1 as const;

export const LANDING_COMPONENT_REGISTRY_V1 = "LANDING_COMPONENT_REGISTRY_V1" as const;

export const GUIDED_WIREFRAME_ENGINE_V1 = "GUIDED_WIREFRAME_ENGINE_V1" as const;

export const LANDING_PAGE_CONTENT_STATUSES = ["PLACEHOLDER", "DRAFT", "APPROVED"] as const;

export type LandingPageContentStatus = (typeof LANDING_PAGE_CONTENT_STATUSES)[number];

export const LANDING_PAGE_COURSE_SLUG = "sites-que-convertem" as const;

export const LANDING_PAGE_LIMITS = {
  maxSections: 30,
  maxBenefits: 10,
  maxProcessSteps: 10,
  maxTrustItems: 12,
  maxFaqItems: 15,
  maxFooterLinks: 10,
  maxTitle: 120,
  maxSlug: 64,
  maxHeadline: 120,
  maxSubheadline: 240,
  maxEyebrow: 80,
  maxShortText: 160,
  maxMediumText: 400,
  maxLongText: 1200,
  maxWhatsappMessage: 300,
} as const;

/** Slugs bloqueados para `/p/[slug]` (marca, auth, app). */
export const LANDING_PAGE_RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "aulas",
  "cadastro",
  "carrinho",
  "checkout",
  "cursos",
  "entrar",
  "login",
  "p",
  "privacidade",
  "robots",
  "sitemap",
  "trafego-pago",
  "www",
]);

export const LANDING_COMPONENT_TYPES = [
  "HERO",
  "PROBLEM",
  "SOLUTION",
  "BENEFITS",
  "PROCESS",
  "TRUST",
  "PORTFOLIO",
  "TESTIMONIALS",
  "FAQ",
  "CTA",
  "FORM",
  "CONTACT",
  "FOOTER",
] as const;

export type LandingComponentType = (typeof LANDING_COMPONENT_TYPES)[number];
