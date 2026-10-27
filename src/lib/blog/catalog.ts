import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export const BLOG_CATEGORIES = [
  { slug: "trafego-pago", label: "Tráfego pago para pequenos negócios" },
  { slug: "sites-landing-pages", label: "Sites e landing pages que convertem" },
  { slug: "aquisicao-conversao", label: "Aquisição e conversão" },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];

export const BLOG_CTA_KEYS = ["TRAFFIC_COURSE", "SITES_COURSE", "COURSES_HUB", "TRAFFIC_SERVICE", "NONE"] as const;
export type BlogCtaKey = (typeof BLOG_CTA_KEYS)[number];

export const BLOG_IDEA_STATUSES = ["SUGGESTED", "PLANNED", "DRAFTED", "DISMISSED"] as const;
export type BlogIdeaStatus = (typeof BLOG_IDEA_STATUSES)[number];

export const BLOG_CONTENT_ROLES = ["PILLAR", "SATELLITE", "UPDATE", "TREND_RESPONSE"] as const;
export type BlogContentRole = (typeof BLOG_CONTENT_ROLES)[number];

export const BLOG_SEARCH_INTENTS = ["INFORMATIONAL", "COMMERCIAL_INVESTIGATION", "TRANSACTIONAL"] as const;
export type BlogSearchIntent = (typeof BLOG_SEARCH_INTENTS)[number];

export const BLOG_TREND_STATUSES = ["TREND_SIGNAL", "CURRENT_TOPIC", "EVERGREEN", "INSUFFICIENT_EVIDENCE"] as const;
export type BlogTrendStatus = (typeof BLOG_TREND_STATUSES)[number];

export const BLOG_TREND_ACTIONS = ["CREATE_NEW", "UPDATE_EXISTING", "MONITOR", "IGNORE"] as const;
export type BlogTrendAction = (typeof BLOG_TREND_ACTIONS)[number];

export const BLOG_DUPLICATE_RISKS = ["LOW", "MEDIUM", "HIGH"] as const;
export type BlogDuplicateRisk = (typeof BLOG_DUPLICATE_RISKS)[number];

export const BLOG_SEQUENCE = ["DESCOBRIR", "DIAGNOSTICAR", "DECIDIR", "EXECUTAR", "MEDIR", "MELHORAR"] as const;
export type BlogSequenceStage = (typeof BLOG_SEQUENCE)[number];

export const BLOG_COVER_FOLDER = "alexandre-feio/blog/covers";
export const BLOG_EMPTY_MESSAGE = "Os primeiros conteúdos estão em preparação.";
export const BLOG_AI_FAILURE = "Não foi possível gerar sugestão agora.";
export const BLOG_WORDS_PER_MINUTE = 200;

export function blogCategoryLabel(slug: string): string {
  return BLOG_CATEGORIES.find((item) => item.slug === slug)?.label ?? slug;
}

export function isBlogCategory(value: string): value is BlogCategorySlug {
  return BLOG_CATEGORIES.some((item) => item.slug === value);
}

export function isBlogCta(value: string): value is BlogCtaKey {
  return (BLOG_CTA_KEYS as readonly string[]).includes(value);
}

export function blogCtaHref(key: string): { href: string; label: string } | null {
  if (key === "TRAFFIC_COURSE") return { href: `/cursos/${TRAFFIC_COURSE_SLUG}`, label: "Ver o curso de tráfego pago" };
  if (key === "SITES_COURSE") return { href: `/cursos/${SITES_COURSE_SLUG}`, label: "Ver o curso de sites que convertem" };
  if (key === "COURSES_HUB") return { href: "/cursos", label: "Ver os cursos" };
  if (key === "TRAFFIC_SERVICE") return { href: "/trafego-pago", label: "Conhecer a gestão de tráfego" };
  return null;
}
