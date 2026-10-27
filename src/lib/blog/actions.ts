"use server";

import { revalidatePath } from "next/cache";
import { BLOG_AI_FAILURE } from "@/lib/blog/catalog";
import { acceptSuggestion } from "@/lib/blog/editorial";
import { runEditorialAction } from "@/lib/blog/ai";
import type { BlogAiAction } from "@/lib/blog/ai-request";
import { consumeBlogAiRateLimit, consumeBlogTrendRateLimit } from "@/lib/blog/rate-limit";
import { createDraftFromSavedIdea, dismissEditorialIdea, loadEditorialInventory, saveBlogPost, savePlannedIdea } from "@/lib/blog/service";
import type { BlogWriteFields } from "@/lib/blog/rules";
import { requireAdmin } from "@/lib/auth/session";

function fieldsFrom(form: FormData): BlogWriteFields {
  const read = (key: string) => String(form.get(key) ?? "");
  return {
    title: read("title"),
    slug: read("slug"),
    excerpt: read("excerpt"),
    contentMarkdown: read("contentMarkdown"),
    categorySlug: read("categorySlug"),
    ctaKey: read("ctaKey"),
    seoTitle: read("seoTitle"),
    seoDescription: read("seoDescription"),
    coverImageAlt: read("coverImageAlt"),
  };
}

async function coverFrom(form: FormData) {
  const file = form.get("cover");
  if (!(file instanceof File) || file.size === 0) return null;
  return { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, size: file.size };
}

function revalidateBlog(slug?: string) {
  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/blog/${slug}`);
}

async function admin() {
  const session = await requireAdmin();
  if (!session) return null;
  return session;
}

export async function saveBlogAction(id: string | null, form: FormData) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const saved = await saveBlogPost({ id: id || undefined, fields: fieldsFrom(form), intent: "save", cover: await coverFrom(form) });
  if (saved.ok) revalidateBlog(saved.post.slug);
  return saved;
}

export async function publishBlogAction(id: string | null, form: FormData) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const saved = await saveBlogPost({ id: id || undefined, fields: fieldsFrom(form), intent: "publish", cover: await coverFrom(form) });
  if (saved.ok) revalidateBlog(saved.post.slug);
  return saved;
}

export async function unpublishBlogAction(id: string) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const saved = await saveBlogPost({
    id,
    fields: { title: "artigo", slug: "artigo", excerpt: "", contentMarkdown: "", categorySlug: "", ctaKey: "NONE", seoTitle: "", seoDescription: "", coverImageAlt: "" },
    intent: "unpublish",
  });
  if (saved.ok) revalidateBlog(saved.post.slug);
  return saved;
}

export async function editorialAction(action: BlogAiAction, focus: Record<string, string> = {}) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const allowed = action === "trends" ? await consumeBlogTrendRateLimit(session.user.id) : await consumeBlogAiRateLimit(session.user.id);
  if (!allowed) return { ok: false as const, message: "Muitas solicitações em pouco tempo. Tente de novo mais tarde." };
  const inventory = await loadEditorialInventory();
  const result = await runEditorialAction({ action, inventory, focus });
  if (!result.ok) return { ok: false as const, message: result.message || BLOG_AI_FAILURE };
  return result;
}

export async function saveIdeaAction(payload: unknown) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const inventory = await loadEditorialInventory();
  const suggestion = acceptSuggestion(payload, inventory);
  if (!suggestion) return { ok: false as const, message: "A sugestão não pôde ser salva." };
  const saved = await savePlannedIdea(suggestion);
  revalidatePath("/admin/blog/planejamento");
  return saved;
}

export async function dismissIdeaAction(id: string) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const result = await dismissEditorialIdea(id);
  if (result.ok) revalidatePath("/admin/blog/planejamento");
  return result;
}

export async function draftFromIdeaAction(id: string) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const result = await createDraftFromSavedIdea(id);
  if (result.ok) {
    revalidatePath("/admin/blog");
    revalidatePath("/admin/blog/planejamento");
  }
  return result;
}
