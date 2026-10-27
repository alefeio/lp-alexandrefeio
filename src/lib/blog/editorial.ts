import {
  BLOG_CATEGORIES,
  BLOG_CONTENT_ROLES,
  BLOG_DUPLICATE_RISKS,
  BLOG_SEARCH_INTENTS,
  BLOG_SEQUENCE,
  BLOG_TREND_ACTIONS,
  BLOG_TREND_STATUSES,
  isBlogCategory,
  isBlogCta,
  type BlogContentRole,
  type BlogCtaKey,
  type BlogDuplicateRisk,
  type BlogSearchIntent,
  type BlogSequenceStage,
  type BlogTrendAction,
  type BlogTrendStatus,
} from "@/lib/blog/catalog";
import type { EditorialInventory } from "@/lib/blog/inventory";

const STOP = new Set(["o", "a", "os", "as", "de", "do", "da", "dos", "das", "para", "pra", "que", "e", "ou", "qual", "um", "uma", "seu", "sua", "como", "mais", "melhor", "escolher", "vale", "usar", "sobre", "com", "em", "no", "na", "por"]);

export type OverlapRef = { slug: string; title: string };

export function conceptTokens(value: string): string[] {
  return [...new Set(value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word)))];
}

export function assessDuplicateRisk(title: string, posts: Array<{ slug: string; title: string }>): { risk: BlogDuplicateRisk; overlapping: OverlapRef[] } {
  const tokens = conceptTokens(title);
  const overlapping = posts
    .map((post) => {
      const other = conceptTokens(post.title);
      const shared = tokens.filter((token) => other.includes(token));
      const union = new Set([...tokens, ...other]).size || 1;
      return { slug: post.slug, title: post.title, score: shared.length / union, shared: shared.length };
    })
    .filter((item) => item.shared >= 3 || item.score >= 0.72)
    .sort((a, b) => b.score - a.score);
  const top = overlapping[0];
  const risk: BlogDuplicateRisk = !top ? "LOW" : top.score >= 0.72 || top.shared >= 3 ? "HIGH" : top.score >= 0.45 ? "MEDIUM" : "LOW";
  return { risk, overlapping: overlapping.slice(0, 3).map(({ slug, title: label }) => ({ slug, title: label })) };
}

export function sequenceStage(title: string): BlogSequenceStage | null {
  const text = title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/o que e|introdu|primeiros passos|como funciona|por onde comecar/.test(text)) return "DESCOBRIR";
  if (/pronto para|diagnos|quando anunciar|vale a pena|gargalo/.test(text)) return "DIAGNOSTICAR";
  if (/escolher|qual canal|google ads ou meta|orcamento inicial|decidir/.test(text)) return "DECIDIR";
  if (/como criar|como estruturar|passo a passo|configurar|publicar/.test(text)) return "EXECUTAR";
  if (/medir|metrica|acompanhar|relatorio/.test(text)) return "MEDIR";
  if (/melhorar|otimiz|proxima acao|ajustar/.test(text)) return "MELHORAR";
  return null;
}

export function nextSequenceStage(titles: string[]): BlogSequenceStage {
  const covered = new Set(titles.map(sequenceStage).filter((stage): stage is BlogSequenceStage => Boolean(stage)));
  return BLOG_SEQUENCE.find((stage) => !covered.has(stage)) ?? "MELHORAR";
}

export function equivalentIntro(title: string, existingTitles: string[]): boolean {
  return sequenceStage(title) === "DESCOBRIR" && existingTitles.some((item) => sequenceStage(item) === "DESCOBRIR");
}

const VOLUME_CLAIM = /\b\d+\s*%|\bcresceram\b|\bvolume de busca\b/i;

export function acceptTrendItem(item: {
  topic: string;
  trendStatus: string;
  summary: string;
  whyRelevant: string;
  categorySlug: string;
  existingCoverage: string;
  recommendedAction: string;
  suggestedAngle: string;
  sourceUrls: string[];
  sourceDates: string[];
}) {
  const urls = item.sourceUrls.filter((url) => /^https?:\/\//.test(url));
  const status = (BLOG_TREND_STATUSES as readonly string[]).includes(item.trendStatus) ? (item.trendStatus as BlogTrendStatus) : "INSUFFICIENT_EVIDENCE";
  const action = (BLOG_TREND_ACTIONS as readonly string[]).includes(item.recommendedAction) ? (item.recommendedAction as BlogTrendAction) : "MONITOR";
  const ungrounded = VOLUME_CLAIM.test(item.summary) || VOLUME_CLAIM.test(item.whyRelevant);
  const summary = ungrounded ? "Há um sinal de atualidade, sem dado quantitativo de volume que possa ser afirmado." : item.summary.trim();
  return {
    topic: item.topic.trim(),
    trendStatus: urls.length === 0 || ungrounded ? "INSUFFICIENT_EVIDENCE" : status,
    summary,
    whyRelevant: item.whyRelevant.trim(),
    categorySlug: isBlogCategory(item.categorySlug) ? item.categorySlug : "",
    existingCoverage: item.existingCoverage.trim(),
    recommendedAction: action,
    suggestedAngle: item.suggestedAngle.trim(),
    sourceUrls: urls,
    sourceDates: item.sourceDates.filter(Boolean).slice(0, 5),
  };
}

export function recommendUpdate(topic: string, posts: Array<{ slug: string; title: string }>): BlogTrendAction {
  const risk = assessDuplicateRisk(topic, posts);
  if (risk.risk === "HIGH") return "UPDATE_EXISTING";
  if (risk.risk === "MEDIUM") return "MONITOR";
  return "CREATE_NEW";
}

export type EditorialSuggestion = {
  title: string;
  angle: string;
  categorySlug: string;
  contentRole: BlogContentRole;
  searchIntent: BlogSearchIntent;
  whyNow: string;
  whyNext: string;
  duplicateRisk: BlogDuplicateRisk;
  overlappingPosts: OverlapRef[];
  prerequisitePosts: string[];
  internalLinks: string[];
  suggestedCtaKey: BlogCtaKey;
  nextLogicalArticles: string[];
  advice: "ATUALIZAR_ARTIGO_EXISTENTE" | "CRIAR_ANGULO_DIFERENCIADO" | "PODE_CRIAR";
};

export function acceptSuggestion(raw: unknown, inventory: EditorialInventory): EditorialSuggestion | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = stringOf(row.title);
  const categorySlug = stringOf(row.categorySlug);
  const contentRole = stringOf(row.contentRole);
  const searchIntent = stringOf(row.searchIntent);
  const cta = stringOf(row.suggestedCtaKey);
  if (!title || !isBlogCategory(categorySlug)) return null;
  if (!(BLOG_CONTENT_ROLES as readonly string[]).includes(contentRole)) return null;
  if (!(BLOG_SEARCH_INTENTS as readonly string[]).includes(searchIntent)) return null;
  if (!isBlogCta(cta)) return null;
  const known = [...inventory.published, ...inventory.drafts, ...inventory.planned.map((idea) => ({ slug: idea.title, title: idea.title }))];
  const assessed = assessDuplicateRisk(title, known);
  const intro = equivalentIntro(title, known.map((item) => item.title));
  const risk = intro ? "HIGH" : assessed.risk;
  const overlapping = assessed.overlapping;
  const advice = risk === "HIGH" ? (overlapping.length ? "ATUALIZAR_ARTIGO_EXISTENTE" : "CRIAR_ANGULO_DIFERENCIADO") : "PODE_CRIAR";
  return {
    title,
    angle: stringOf(row.angle),
    categorySlug,
    contentRole: contentRole as BlogContentRole,
    searchIntent: searchIntent as BlogSearchIntent,
    whyNow: stringOf(row.whyNow),
    whyNext: stringOf(row.whyNext),
    duplicateRisk: (BLOG_DUPLICATE_RISKS as readonly string[]).includes(risk) ? risk : "LOW",
    overlappingPosts: overlapping,
    prerequisitePosts: stringsOf(row.prerequisitePosts),
    internalLinks: stringsOf(row.internalLinks),
    suggestedCtaKey: cta,
    nextLogicalArticles: stringsOf(row.nextLogicalArticles).slice(0, 3),
    advice,
  };
}

export function acceptSuggestions(raw: unknown, inventory: EditorialInventory): EditorialSuggestion[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => acceptSuggestion(item, inventory)).filter((item): item is EditorialSuggestion => Boolean(item)).slice(0, 5);
}

export function rejectClickbait(title: string): boolean {
  return /segredo|garantid|10x/i.test(title);
}

export function acceptTitles(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(stringOf).filter((title) => title.length >= 8 && !rejectClickbait(title)).slice(0, 5);
}

export function draftFromIdea(idea: { title: string; angle: string; categorySlug: string; ctaKey?: string; suggestedCtaKey?: string }): { status: "DRAFT"; title: string; excerpt: string; contentMarkdown: string; categorySlug: string; ctaKey: BlogCtaKey } {
  const cta = idea.ctaKey || idea.suggestedCtaKey || "NONE";
  return {
    status: "DRAFT",
    title: idea.title,
    excerpt: idea.angle,
    contentMarkdown: "",
    categorySlug: isBlogCategory(idea.categorySlug) ? idea.categorySlug : BLOG_CATEGORIES[0].slug,
    ctaKey: isBlogCta(cta) ? cta : "NONE",
  };
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringOf).filter(Boolean).slice(0, 8);
}
