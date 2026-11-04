"use server";

import { revalidatePath } from "next/cache";
import { runGuardedAiOperation, type AiIdempotencyBlockKind } from "@/lib/ai/idempotency-guard";
import { blogAiFingerprint } from "@/lib/ai/idempotency-fingerprints";
import { createPrismaAiIdempotencyStore } from "@/lib/ai/idempotency-prisma";
import { BLOG_AI_FAILURE } from "@/lib/blog/catalog";
import { acceptSuggestion } from "@/lib/blog/editorial";
import { runEditorialAction } from "@/lib/blog/ai";
import { BLOG_AI_FEATURE_KEYS, type BlogAiAction } from "@/lib/blog/ai-request";
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

function blogIdempotencyMessage(block: AiIdempotencyBlockKind): string {
  if (block === "missing_key") return "Atualize a página e tente gerar novamente.";
  if (block === "in_progress") return "Uma geração já está em andamento. Aguarde e tente de novo.";
  if (block === "completed") return "Esta geração já foi concluída. Solicite uma nova se quiser outra versão.";
  if (block === "fingerprint_conflict") return "Os dados mudaram desde o início desta geração. Peça uma nova sugestão.";
  if (block === "unknown_blocked") return "A geração anterior ficou inconclusiva. Peça uma nova sugestão com outro clique.";
  return "Não foi possível iniciar a geração com segurança agora.";
}

export async function editorialAction(
  action: BlogAiAction,
  focus: Record<string, string> = {},
  options?: { idempotencyKey?: string },
) {
  const session = await admin();
  if (!session) return { ok: false as const, message: "Sem acesso." };
  const allowed = action === "trends" ? await consumeBlogTrendRateLimit(session.user.id) : await consumeBlogAiRateLimit(session.user.id);
  if (!allowed) return { ok: false as const, message: "Muitas solicitações em pouco tempo. Tente de novo mais tarde." };
  const inventory = await loadEditorialInventory();

  let generationMessage: string | null = null;
  const guarded = await runGuardedAiOperation({
    userId: session.user.id,
    featureKey: BLOG_AI_FEATURE_KEYS[action],
    idempotencyKey: options?.idempotencyKey,
    fingerprintHash: blogAiFingerprint({ action, inventory, focus }),
    store: createPrismaAiIdempotencyStore(),
    execute: async ({ requestId, confirmDispatch }) => {
      const result = await runEditorialAction({
        action,
        inventory,
        focus,
        userId: session.user.id,
        requestId,
        onBeforeProvider: confirmDispatch,
      });
      if (result.ok) return { ok: true as const, value: result };
      generationMessage = result.message || BLOG_AI_FAILURE;
      const uncertain = "uncertain" in result ? Boolean(result.uncertain) : false;
      return {
        ok: false as const,
        uncertain,
        failureKind: uncertain ? "uncertain" as const : "definitive" as const,
      };
    },
  });

  if (guarded.ok) return guarded.value;
  if ("block" in guarded && guarded.block) {
    if (guarded.block === "ownership_lost") {
      return { ok: false as const, message: "Esta geração foi substituída. Peça uma nova sugestão." };
    }
    return { ok: false as const, message: blogIdempotencyMessage(guarded.block) };
  }
  return { ok: false as const, message: generationMessage || BLOG_AI_FAILURE };
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
