import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { listLandingPageMedia } from "@/lib/landing-page/media/service";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects } from "@/lib/landing-page/service";
import {
  LANDING_PAGE_PUBLICATION_TOOL,
  publicationLessonMessage,
  publicationResultDisplay,
  publicationRuntimeForLesson,
  SITE_PUBLICATION_SLUG,
  toPublicationPageView,
  type PublicationPageView,
  type PublicationPanel,
} from "@/lib/landing-page/publication/lesson-flow";
import {
  hideLandingPagePublicationLesson,
  publicationHistoryForOwner,
  restoreLandingPagePublicationLesson,
  saveLandingPagePublicationLesson,
} from "@/lib/landing-page/publication/lesson-plan";
import { createPrismaLandingPagePublicationStore } from "@/lib/landing-page/publication/prisma-store";
import { listLandingPagePublications } from "@/lib/landing-page/publication/service";
import type { PublicationMediaInput } from "@/lib/landing-page/publication/snapshot";
import type { LandingPageProjectRecord } from "@/lib/landing-page/types";

export { SITE_PUBLICATION_SLUG };
export type { PublicationPageView, PublicationPanel };

function mediaInput(record: {
  id: string;
  landingPageProjectId: string;
  status: string;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  fileSize: number;
}): PublicationMediaInput {
  return {
    id: record.id,
    landingPageProjectId: record.landingPageProjectId,
    status: record.status,
    publicUrl: record.publicUrl,
    altText: record.altText,
    width: record.width,
    height: record.height,
    fileSize: record.fileSize,
  };
}

async function pageView(userId: string, record: LandingPageProjectRecord): Promise<PublicationPageView> {
  const projects = createPrismaLandingPageStore();
  const publications = createPrismaLandingPagePublicationStore();
  const media = await listLandingPageMedia(projects, createPrismaLandingPageMediaStore(), {
    userId,
    landingPageProjectId: record.id,
  });
  const history = await publicationHistoryForOwner({ publications }, { userId, landingPageProjectId: record.id });
  const listed = await listLandingPagePublications({ publications }, { userId, landingPageProjectId: record.id });
  const active = listed?.find((item) => item.isActive) ?? null;
  return toPublicationPageView(record, {
    media: media.ok ? media.value.map(mediaInput) : [],
    history: history ?? [],
    activeVersion: active?.version ?? null,
    activeSourceRevision: active?.sourceDraftRevision ?? null,
    runtimeEnabled: publicationRuntimeForLesson(),
  });
}

export async function loadPublicationPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<PublicationPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === LANDING_PAGE_PUBLICATION_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return {
      kind: "landing-publication",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      pages: [],
      suggestedPageId: null,
    };
  }
  const projects = createPrismaLandingPageStore();
  const pages = await listLandingPageProjects(projects, { userId: input.userId });
  const mapped: PublicationPageView[] = [];
  for (const page of pages) {
    const record = await projects.findByIdForUser(page.id, input.userId);
    if (!record) continue;
    mapped.push(await pageView(input.userId, record));
  }
  const suggestedPageId = await lessonPageId(input.userId, mapped.map((page) => page.id));
  return {
    kind: "landing-publication",
    mode: "live",
    preview: false,
    authenticated: true,
    blockKey: tool.blockKey,
    pages: mapped,
    suggestedPageId: suggestedPageId ?? mapped[0]?.id ?? null,
  };
}

async function lessonPageId(userId: string, ownedIds: string[]) {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_PUBLICATION_SLUG }, select: { id: true } });
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
  if (slug !== SITE_PUBLICATION_SLUG) return { ok: false as const, message: "Aula inválida.", code: undefined };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível.", code: undefined };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== LANDING_PAGE_PUBLICATION_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida.", code: undefined };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

function deps() {
  return {
    projects: createPrismaLandingPageStore(),
    publications: createPrismaLandingPagePublicationStore(),
    runtimeEnabled: publicationRuntimeForLesson(),
  };
}

export async function savePublicationForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedDraftRevision: number; acknowledgedWarningCodes?: string[] },
): Promise<
  | { ok: true; snapshot: LessonSnapshot; page: PublicationPageView; completed: boolean; notice?: string; code?: string }
  | { ok: false; message: string; code?: string }
> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const projects = createPrismaLandingPageStore();
  const record = await projects.findByIdForUser(input.landingPageProjectId, userId);
  const media = record
    ? await listLandingPageMedia(projects, createPrismaLandingPageMediaStore(), { userId, landingPageProjectId: record.id })
    : null;
  const saved = await saveLandingPagePublicationLesson(
    { ...deps(), media: media?.ok ? media.value.map(mediaInput) : [] },
    { userId, ...input },
  );
  if (!saved.ok) return { ok: false, message: publicationLessonMessage(saved.code), code: saved.code };
  if (saved.lessonComplete && saved.result) {
    const payload = saved.result as unknown as Prisma.InputJsonValue;
    const projectId = record?.projectId;
    if (projectId) {
      const existing = await access.prisma.lessonResult.findFirst({ where: { userId, lessonId: access.lessonId, projectId } });
      if (existing) await access.prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
      else await access.prisma.lessonResult.create({ data: { userId, lessonId: access.lessonId, projectId, payload } });
    }
    await upsertPersonalLessonResult(userId, access.lessonId, {
      ...saved.result,
      ...publicationResultDisplay(saved.result),
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
  }
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  const fresh = await projects.findByIdForUser(input.landingPageProjectId, userId);
  if (!fresh) return { ok: false, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  return {
    ok: true,
    snapshot,
    page: await pageView(userId, fresh),
    completed: saved.lessonComplete,
    notice: saved.code ? publicationLessonMessage(saved.code) : undefined,
    code: saved.code,
  };
}

export async function restorePublicationForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; publicationId: string },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const projects = createPrismaLandingPageStore();
  const record = await projects.findByIdForUser(input.landingPageProjectId, userId);
  const media = record
    ? await listLandingPageMedia(projects, createPrismaLandingPageMediaStore(), { userId, landingPageProjectId: record.id })
    : null;
  const restored = await restoreLandingPagePublicationLesson(
    { ...deps(), media: media?.ok ? media.value.map(mediaInput) : [] },
    { userId, ...input },
  );
  if (!restored.ok) return { ok: false as const, message: publicationLessonMessage(restored.code), code: restored.code };
  const fresh = await projects.findByIdForUser(input.landingPageProjectId, userId);
  if (!fresh) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  return { ok: true as const, page: await pageView(userId, fresh), notice: "Será criada uma nova versão baseada nesta." };
}

export async function hidePublicationForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string },
) {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const hidden = await hideLandingPagePublicationLesson(deps(), { userId, ...input });
  if (!hidden.ok) return { ok: false as const, message: publicationLessonMessage(hidden.code), code: hidden.code };
  const fresh = await createPrismaLandingPageStore().findByIdForUser(input.landingPageProjectId, userId);
  if (!fresh) return { ok: false as const, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  return { ok: true as const, page: await pageView(userId, fresh), notice: "A página deixou de abrir no endereço público. O histórico permanece." };
}
