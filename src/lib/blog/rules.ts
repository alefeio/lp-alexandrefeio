import {
  BLOG_WORDS_PER_MINUTE,
  isBlogCategory,
  isBlogCta,
  type BlogCtaKey,
} from "@/lib/blog/catalog";

export type BlogWriteFields = {
  title: string;
  slug: string;
  excerpt: string;
  contentMarkdown: string;
  categorySlug: string;
  ctaKey: string;
  seoTitle: string;
  seoDescription: string;
  coverImageAlt: string;
};

export type BlogExisting = {
  slug: string;
  publishedAt: Date | null;
  status: "DRAFT" | "PUBLISHED";
};

export function slugifyTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function demoteMarkdownH1(markdown: string): string {
  return markdown.replace(/^# /gm, "## ");
}

export function extractHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^#{2,3} +(.+)$/gm)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}

export function readingTimeMinutes(markdown: string): number {
  const words = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\[\]()`|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / BLOG_WORDS_PER_MINUTE));
}

export function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (!value || value.startsWith("//") || value.startsWith("javascript:") || value.startsWith("data:")) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function slugConflict(slug: string, existing: Array<{ id: string; slug: string }>, currentId?: string): boolean {
  return existing.some((item) => item.slug === slug && item.id !== currentId);
}

export function prepareBlogWrite(input: {
  existing: BlogExisting | null;
  fields: BlogWriteFields;
  intent: "save" | "publish" | "unpublish";
  now: Date;
  coverUrl?: string | null;
  hasCover?: boolean;
}): { ok: true; record: BlogWriteFields & { status: "DRAFT" | "PUBLISHED"; publishedAt: Date | null; slugLocked: boolean } } | { ok: false; message: string } {
  const locked = Boolean(input.existing?.publishedAt);
  const title = input.fields.title.trim();
  const requestedSlug = slugifyTitle(input.fields.slug || title);
  const slug = locked ? input.existing?.slug ?? requestedSlug : requestedSlug;
  const contentMarkdown = demoteMarkdownH1(input.fields.contentMarkdown);
  const categorySlug = input.fields.categorySlug.trim();
  const ctaKey = input.fields.ctaKey.trim() || "NONE";
  const excerpt = input.fields.excerpt.trim();
  const seoTitle = input.fields.seoTitle.trim();
  const seoDescription = input.fields.seoDescription.trim();
  const coverImageAlt = input.fields.coverImageAlt.trim();
  const publishing = input.intent === "publish";
  const status = input.intent === "unpublish" ? "DRAFT" : publishing ? "PUBLISHED" : input.existing?.status ?? "DRAFT";
  const hasCover = input.hasCover ?? Boolean(input.coverUrl?.trim());

  if (input.intent !== "unpublish") {
    if (title.length < 3) return { ok: false, message: "O título precisa identificar o artigo." };
    if (!slug) return { ok: false, message: "O slug não pôde ser formado." };
    if (ctaKey !== "NONE" && !isBlogCta(ctaKey)) return { ok: false, message: "O CTA não está na lista permitida." };
    if (categorySlug && !isBlogCategory(categorySlug)) return { ok: false, message: "A categoria não está na lista permitida." };
    if (seoTitle.length > 70) return { ok: false, message: "O título de SEO passa de 70 caracteres." };
    if (seoDescription.length > 160) return { ok: false, message: "A descrição de SEO passa de 160 caracteres." };
    if (hasCover && !coverImageAlt) return { ok: false, message: "A capa precisa de texto alternativo." };
  }

  if (status === "PUBLISHED") {
    if (!hasCover) return { ok: false, message: "Para publicar, adicione uma imagem de capa." };
    if (!coverImageAlt) return { ok: false, message: "A capa precisa de texto alternativo." };
    if (!isBlogCategory(categorySlug) || !isBlogCta(ctaKey) || excerpt.length < 40 || contentMarkdown.trim().length < 80) {
      return { ok: false, message: "Para publicar, complete título, slug, categoria, resumo e conteúdo." };
    }
  }

  const publishedAt = publishing ? input.existing?.publishedAt ?? input.now : input.existing?.publishedAt ?? null;

  return {
    ok: true,
    record: {
      title: title || input.existing?.slug || "Rascunho",
      slug,
      excerpt,
      contentMarkdown,
      categorySlug,
      ctaKey: (isBlogCta(ctaKey) ? ctaKey : "NONE") as BlogCtaKey,
      seoTitle,
      seoDescription,
      coverImageAlt,
      status,
      publishedAt,
      slugLocked: Boolean(publishedAt),
    },
  };
}

export function selectRelated<T extends { slug: string; categorySlug: string; publishedAt: Date | null }>(posts: T[], currentSlug: string, categorySlug: string): T[] {
  return posts
    .filter((post) => post.slug !== currentSlug && post.categorySlug === categorySlug && post.publishedAt)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
    .slice(0, 3);
}
