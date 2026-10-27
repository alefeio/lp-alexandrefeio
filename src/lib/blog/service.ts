import { BLOG_COVER_FOLDER } from "@/lib/blog/catalog";
import { draftFromIdea, type EditorialSuggestion } from "@/lib/blog/editorial";
import { buildEditorialInventory } from "@/lib/blog/inventory";
import { prepareBlogWrite, selectRelated, slugConflict, slugifyTitle, type BlogWriteFields } from "@/lib/blog/rules";
import { getPrisma } from "@/lib/db/prisma";
import { uploadToApimg } from "@/lib/storage/apimg";
import { validateEditorialImage } from "@/lib/storage/image-file";

const postSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  contentMarkdown: true,
  categorySlug: true,
  ctaKey: true,
  seoTitle: true,
  seoDescription: true,
  coverImageUrl: true,
  coverImagePublicId: true,
  coverImageAlt: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listAdminPosts() {
  return getPrisma().blogPost.findMany({ orderBy: [{ updatedAt: "desc" }], select: postSelect });
}

export async function getBlogPost(id: string) {
  return getPrisma().blogPost.findUnique({ where: { id }, select: postSelect });
}

export async function listPublishedPosts() {
  return getPrisma().blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }],
    select: postSelect,
  });
}

export async function getPublishedPost(slug: string) {
  return getPrisma().blogPost.findFirst({ where: { slug, status: "PUBLISHED" }, select: postSelect });
}

export async function publishedBlogSitemap() {
  const rows = await getPrisma().blogPost.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } });
  return rows;
}

export async function relatedPosts(slug: string, categorySlug: string) {
  const rows = await getPrisma().blogPost.findMany({
    where: { status: "PUBLISHED", categorySlug, slug: { not: slug } },
    orderBy: [{ publishedAt: "desc" }],
    take: 3,
    select: { slug: true, title: true, excerpt: true, categorySlug: true, publishedAt: true, contentMarkdown: true },
  });
  return selectRelated(rows, slug, categorySlug);
}

export async function loadEditorialInventory() {
  const prisma = getPrisma();
  const [posts, ideas] = await Promise.all([
    prisma.blogPost.findMany({
      select: {
        slug: true,
        title: true,
        excerpt: true,
        categorySlug: true,
        status: true,
        publishedAt: true,
        contentMarkdown: true,
        ctaKey: true,
        seoTitle: true,
        seoDescription: true,
      },
    }),
    prisma.blogEditorialIdea.findMany({
      select: { id: true, title: true, angle: true, categorySlug: true, status: true, contentRole: true, searchIntent: true },
    }),
  ]);
  return buildEditorialInventory({ posts, ideas });
}

export async function listEditorialIdeas() {
  return getPrisma().blogEditorialIdea.findMany({ orderBy: [{ updatedAt: "desc" }] });
}

export async function saveBlogPost(input: { id?: string; fields: BlogWriteFields; intent: "save" | "publish" | "unpublish"; cover?: { bytes: Uint8Array; type: string; size: number } | null; now?: Date }) {
  const prisma = getPrisma();
  const now = input.now ?? new Date();
  const existing = input.id ? await prisma.blogPost.findUnique({ where: { id: input.id }, select: postSelect }) : null;
  if (input.id && !existing) return { ok: false as const, message: "Artigo não encontrado." };
  if (input.intent === "unpublish" && !existing) return { ok: false as const, message: "Artigo não encontrado." };
  const fields: BlogWriteFields = input.intent === "unpublish" && existing
    ? {
        title: existing.title,
        slug: existing.slug,
        excerpt: existing.excerpt,
        contentMarkdown: existing.contentMarkdown,
        categorySlug: existing.categorySlug,
        ctaKey: existing.ctaKey,
        seoTitle: existing.seoTitle ?? "",
        seoDescription: existing.seoDescription ?? "",
        coverImageAlt: existing.coverImageAlt ?? "",
      }
    : input.fields;
  let coverUrl = existing?.coverImageUrl ?? null;
  let coverId = existing?.coverImagePublicId ?? null;
  if (input.cover) {
    const checked = validateEditorialImage(input.cover.bytes, input.cover.type, input.cover.size);
    if (!checked.ok) return checked;
    const uploaded = await uploadToApimg(checked.bytes, checked.format, process.env, fetch, BLOG_COVER_FOLDER);
    if (!uploaded.ok) return uploaded;
    coverUrl = uploaded.asset.url;
    coverId = uploaded.asset.publicId;
  }
  const prepared = prepareBlogWrite({
    existing: existing ? { slug: existing.slug, publishedAt: existing.publishedAt, status: existing.status } : null,
    fields,
    intent: input.intent,
    now,
    coverUrl,
  });
  if (!prepared.ok) return prepared;
  const slugs = await prisma.blogPost.findMany({ select: { id: true, slug: true } });
  if (slugConflict(prepared.record.slug, slugs, existing?.id)) return { ok: false as const, message: "Já existe um artigo com este slug." };
  const data = {
    slug: prepared.record.slug,
    title: prepared.record.title,
    excerpt: prepared.record.excerpt,
    contentMarkdown: prepared.record.contentMarkdown,
    categorySlug: prepared.record.categorySlug,
    ctaKey: prepared.record.ctaKey,
    seoTitle: prepared.record.seoTitle || null,
    seoDescription: prepared.record.seoDescription || null,
    coverImageAlt: prepared.record.coverImageAlt || null,
    coverImageUrl: coverUrl,
    coverImagePublicId: coverId,
    status: prepared.record.status,
    publishedAt: prepared.record.publishedAt,
  };
  const saved = existing ? await prisma.blogPost.update({ where: { id: existing.id }, data, select: { id: true, slug: true, status: true } }) : await prisma.blogPost.create({ data, select: { id: true, slug: true, status: true } });
  return { ok: true as const, post: saved };
}

export async function savePlannedIdea(suggestion: EditorialSuggestion) {
  const prisma = getPrisma();
  const related = suggestion.overlappingPosts[0]?.slug
    ? await prisma.blogPost.findUnique({ where: { slug: suggestion.overlappingPosts[0].slug }, select: { id: true } })
    : null;
  const created = await prisma.blogEditorialIdea.create({
    data: {
      title: suggestion.title,
      angle: suggestion.angle,
      categorySlug: suggestion.categorySlug,
      contentRole: suggestion.contentRole,
      searchIntent: suggestion.searchIntent,
      ctaKey: suggestion.suggestedCtaKey,
      status: "PLANNED",
      rationale: [suggestion.whyNow, suggestion.whyNext, suggestion.advice].filter(Boolean).join(" "),
      relatedPostId: related?.id ?? null,
      sourceUrls: [],
    },
    select: { id: true, status: true },
  });
  return { ok: true as const, idea: created };
}

export async function dismissEditorialIdea(id: string) {
  const prisma = getPrisma();
  const idea = await prisma.blogEditorialIdea.findUnique({ where: { id }, select: { id: true } });
  if (!idea) return { ok: false as const, message: "Pauta não encontrada." };
  await prisma.blogEditorialIdea.update({ where: { id }, data: { status: "DISMISSED" } });
  return { ok: true as const };
}

export async function createDraftFromSavedIdea(id: string) {
  const prisma = getPrisma();
  const idea = await prisma.blogEditorialIdea.findUnique({ where: { id } });
  if (!idea) return { ok: false as const, message: "Pauta não encontrada." };
  if (idea.draftPostId) return { ok: true as const, postId: idea.draftPostId };
  const draft = draftFromIdea(idea);
  const base = slugifyTitle(draft.title) || "rascunho";
  const slugs = new Set((await prisma.blogPost.findMany({ select: { slug: true } })).map((row) => row.slug));
  let slug = base;
  let suffix = 2;
  while (slugs.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  const post = await prisma.blogPost.create({
    data: {
      slug,
      title: draft.title,
      excerpt: draft.excerpt,
      contentMarkdown: draft.contentMarkdown,
      categorySlug: draft.categorySlug,
      ctaKey: draft.ctaKey,
      status: "DRAFT",
    },
    select: { id: true, status: true },
  });
  await prisma.blogEditorialIdea.update({ where: { id }, data: { status: "DRAFTED", draftPostId: post.id } });
  return { ok: true as const, postId: post.id, status: post.status };
}
