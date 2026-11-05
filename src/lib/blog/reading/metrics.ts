import { BLOG_DEEP_MIN_ACTIVE_MS, BLOG_DEEP_MIN_SCROLL, BLOG_ENGAGED_MIN_ACTIVE_MS, BLOG_ENGAGED_MIN_SCROLL } from "@/lib/blog/reading/constants";

export type BlogReadingFacts = {
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
};

/** Sessão engajada: 30s ativos e pelo menos 50% do conteúdo. Critério operacional, não prova de leitura. */
export function isEngagedBlogReading(facts: Pick<BlogReadingFacts, "activeTimeMs" | "maxScrollPercent">): boolean {
  return facts.activeTimeMs >= BLOG_ENGAGED_MIN_ACTIVE_MS && facts.maxScrollPercent >= BLOG_ENGAGED_MIN_SCROLL;
}

/** Leitura profunda: 60s ativos e (75% do conteúdo ou o final alcançado). */
export function isDeepBlogReading(facts: BlogReadingFacts): boolean {
  const farEnough = facts.maxScrollPercent >= BLOG_DEEP_MIN_SCROLL || facts.reachedEnd;
  return facts.activeTimeMs >= BLOG_DEEP_MIN_ACTIVE_MS && farEnough;
}
