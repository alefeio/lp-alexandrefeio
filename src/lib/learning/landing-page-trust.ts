import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { SITE_COPY_SLUG } from "@/lib/learning/landing-page-copy";
import { SITE_WIREFRAME_SLUG } from "@/lib/learning/landing-page-wireframe";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";
import { createPublicLandingPageMediaStorage } from "@/lib/landing-page/media/blob-storage";
import { beginLandingPageMediaUpload, deleteLandingPageMedia, finalizeLandingPageMediaUpload } from "@/lib/landing-page/media/service";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects } from "@/lib/landing-page/service";
import {
  landingPageMediaUploadsAvailable,
  SITE_TRUST_SLUG,
  toTrustPageView,
  trustLessonResponseSchema,
  trustLessonResult,
  saveLandingPageTrustPlan,
  type TrustPageView,
} from "@/lib/landing-page/trust/plan";
import {
  markLandingPageTrustProofReady,
  removeLandingPageTrustProof,
  saveLandingPageTrustProof,
} from "@/lib/landing-page/trust/service";

export { SITE_TRUST_SLUG };

export type TrustPanel = {
  kind: "landing-trust";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  uploadsAvailable: boolean;
  pages: TrustPageView[];
  suggestedPageId: string | null;
};

export function trustPreviewState(): TrustPanel {
  return {
    kind: "landing-trust",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-confianca",
    uploadsAvailable: false,
    pages: [],
    suggestedPageId: null,
  };
}

export async function loadTrustPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<TrustPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "LANDING_PAGE_TRUST_V1");
  if (!tool) return null;
  const uploadsAvailable = landingPageMediaUploadsAvailable();
  if (!input.userId) {
    return {
      kind: "landing-trust",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      uploadsAvailable,
      pages: [],
      suggestedPageId: null,
    };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mediaStore = createPrismaLandingPageMediaStore();
  const mapped: TrustPageView[] = [];
  for (const page of pages) {
    const media = await mediaStore.listForProjectOwner(page.id, input.userId);
    mapped.push(toTrustPageView(page, media));
  }
  const ready = mapped.filter((page) => page.setup === "READY");
  const suggestedPageId = (await lessonPageId(input.userId, SITE_COPY_SLUG, ready.map((page) => page.id)))
    ?? (await lessonPageId(input.userId, SITE_WIREFRAME_SLUG, ready.map((page) => page.id)))
    ?? (ready.length === 1 ? ready[0].id : null);
  return {
    kind: "landing-trust",
    mode: "live",
    preview: false,
    authenticated: true,
    blockKey: tool.blockKey,
    uploadsAvailable,
    pages: mapped,
    suggestedPageId,
  };
}

async function lessonPageId(userId: string, slug: string, ownedIds: string[]) {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true } });
  if (!lesson) return null;
  const results = await prisma.lessonResult.findMany({ where: { userId, lessonId: lesson.id }, select: { payload: true } });
  const matches = new Set<string>();
  for (const result of results) {
    const payload = result.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const id = "landingPageProjectId" in payload ? payload.landingPageProjectId : null;
    if (typeof id === "string" && ownedIds.includes(id)) matches.add(id);
  }
  return matches.size === 1 ? [...matches][0] : null;
}

async function lessonAccess(userId: string, slug: string, blockKey: string) {
  if (slug !== SITE_TRUST_SLUG) return { ok: false as const, message: "Aula inválida.", code: undefined };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível.", code: undefined };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "LANDING_PAGE_TRUST_V1") {
    return { ok: false as const, message: "Ferramenta inválida.", code: undefined };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

async function currentView(userId: string, landingPageProjectId: string) {
  const record = await createPrismaLandingPageStore().findByIdForUser(landingPageProjectId, userId);
  if (!record) return null;
  const media = await createPrismaLandingPageMediaStore().listForProjectOwner(landingPageProjectId, userId);
  return toTrustPageView(record, media);
}

export async function saveTrustProofForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; proof: unknown },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await saveLandingPageTrustProof(createPrismaLandingPageStore(), createPrismaLandingPageMediaStore(), { userId, ...input });
  if (!saved.ok) return { ok: false as const, message: landingPageMessage(saved.code), code: saved.code };
  const page = await currentView(userId, saved.value.id);
  if (!page) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return { ok: true as const, snapshot, page, draftRevision: saved.value.draftRevision };
}

export async function markTrustProofReadyForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; proofId: string },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await markLandingPageTrustProofReady(createPrismaLandingPageStore(), { userId, ...input });
  if (!saved.ok) return { ok: false as const, message: landingPageMessage(saved.code), code: saved.code };
  const page = await currentView(userId, saved.value.id);
  if (!page) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return { ok: true as const, snapshot, page, draftRevision: saved.value.draftRevision };
}

export async function removeTrustProofForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; proofId: string },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await removeLandingPageTrustProof(createPrismaLandingPageStore(), { userId, ...input });
  if (!saved.ok) return { ok: false as const, message: landingPageMessage(saved.code), code: saved.code };
  const page = await currentView(userId, saved.value.id);
  if (!page) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return { ok: true as const, snapshot, page, draftRevision: saved.value.draftRevision };
}

export async function removeTrustMediaForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { mediaId: string },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const existing = await createPrismaLandingPageMediaStore().findById(input.mediaId);
  if (!existing || existing.userId !== userId) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const saved = await deleteLandingPageMedia(
    createPrismaLandingPageStore(),
    createPrismaLandingPageMediaStore(),
    createPublicLandingPageMediaStorage(),
    { userId, mediaId: input.mediaId },
  );
  if (!saved.ok) return { ok: false as const, message: landingPageMessage(saved.code), code: saved.code };
  const page = await currentView(userId, existing.landingPageProjectId);
  if (!page) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return { ok: true as const, snapshot, page, draftRevision: page.draftRevision };
}

export async function beginTrustMediaUploadForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; type: string; mimeType: string; fileSize: number },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  if (!landingPageMediaUploadsAvailable()) {
    return { ok: false as const, message: "O envio de imagens está temporariamente indisponível. Você pode continuar cadastrando as informações e adicionar as imagens depois.", code: "LANDING_PAGE_MEDIA_STORAGE" };
  }
  const started = await beginLandingPageMediaUpload(
    createPrismaLandingPageStore(),
    createPrismaLandingPageMediaStore(),
    { userId, ...input },
  );
  if (!started.ok) return { ok: false as const, message: landingPageMessage(started.code), code: started.code };
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return { ok: true as const, snapshot, mediaId: started.value.id, pathname: started.value.storageKey };
}

export async function completeTrustMediaUploadForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { mediaId: string },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const finished = await finalizeLandingPageMediaUpload(
    createPrismaLandingPageStore(),
    createPrismaLandingPageMediaStore(),
    createPublicLandingPageMediaStorage(),
    { userId, mediaId: input.mediaId },
  );
  if (!finished.ok) return { ok: false as const, message: landingPageMessage(finished.code), code: finished.code };
  const page = await currentView(userId, finished.value.landingPageProjectId);
  if (!page) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return { ok: true as const, snapshot, page, mediaId: finished.value.id, draftRevision: page.draftRevision };
}

export async function saveTrustPlanForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; plan: unknown },
): Promise<{ ok: true; snapshot: LessonSnapshot; landingPageProjectId: string; draftRevision: number; previewHref: string; page: TrustPageView } | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await saveLandingPageTrustPlan(
    createPrismaLandingPageStore(),
    createPrismaLandingPageMediaStore(),
    { userId, ...input },
  );
  if (!saved.ok) return { ok: false, message: landingPageMessage(saved.code), code: saved.code };
  const mediaCount = (await createPrismaLandingPageMediaStore().listForProjectOwner(saved.value.id, userId)).filter((item) => item.status === "READY").length;
  const summary = trustLessonResponseSchema.parse(trustLessonResult({
    landingPageProjectId: saved.value.id,
    document: saved.value.draftDocument,
    mediaCount,
    draftRevision: saved.value.draftRevision,
  }));
  const payload = summary as unknown as Prisma.InputJsonValue;
  if (saved.value.projectId) {
    const existing = await access.prisma.lessonResult.findFirst({ where: { userId, lessonId: access.lessonId, projectId: saved.value.projectId } });
    if (existing) await access.prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
    else await access.prisma.lessonResult.create({ data: { userId, lessonId: access.lessonId, projectId: saved.value.projectId, payload } });
  }
  await upsertPersonalLessonResult(userId, access.lessonId, {
    ...summary,
    prontas: String(summary.readyProofCount),
    selecionadas: String(summary.selectedProofCount),
    depoimentos: String(summary.testimonialCount),
    portfolio: String(summary.portfolioCount),
    credenciais: String(summary.credentialCount),
    consentimento: String(summary.pendingConsentCount),
    proximos: String(summary.nextActionCount),
    midias: String(summary.mediaCount),
  } as unknown as Prisma.InputJsonValue);
  await access.prisma.lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: access.lessonId, blockKey } },
    create: { userId, lessonId: access.lessonId, blockKey, payload },
    update: { payload },
  });
  const now = new Date();
  await access.prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: access.lessonId, blockKey } },
    create: { userId, lessonId: access.lessonId, blockKey, viewedAt: now, completedAt: now },
    update: { completedAt: now },
  });
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  const page = await currentView(userId, saved.value.id);
  if (!page) return { ok: false, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  return {
    ok: true,
    snapshot,
    landingPageProjectId: saved.value.id,
    draftRevision: saved.value.draftRevision,
    previewHref: `/app/landing-pages/${saved.value.id}/preview`,
    page,
  };
}
