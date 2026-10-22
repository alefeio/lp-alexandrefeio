import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { landingPageMessage } from "@/lib/landing-page/errors";
import {
  experienceLessonResult,
  experiencePreviewState,
  LANDING_PAGE_EXPERIENCE_TOOL,
  SITE_EXPERIENCE_SLUG,
  toExperiencePageView,
  type ExperiencePageView,
  type ExperiencePanel,
} from "@/lib/landing-page/experience/lesson-flow";
import type { ExperienceReviewInput } from "@/lib/landing-page/experience/review";
import { saveLandingPageExperienceReview } from "@/lib/landing-page/experience/service";
import { createPrismaLandingPageMediaStore } from "@/lib/landing-page/media/prisma-store";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects } from "@/lib/landing-page/service";

export { SITE_EXPERIENCE_SLUG, experiencePreviewState };
export type { ExperiencePanel, ExperiencePageView };

export async function loadExperiencePanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<ExperiencePanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === LANDING_PAGE_EXPERIENCE_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return {
      kind: "landing-experience",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      pages: [],
      suggestedPageId: null,
    };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mediaStore = createPrismaLandingPageMediaStore();
  const mapped: ExperiencePageView[] = [];
  for (const page of pages) {
    const record = await createPrismaLandingPageStore().findByIdForUser(page.id, input.userId);
    if (!record) continue;
    const media = await mediaStore.listForProjectOwner(page.id, input.userId);
    mapped.push(toExperiencePageView(record, media));
  }
  const suggestedPageId = await lessonPageId(input.userId, SITE_EXPERIENCE_SLUG, mapped.map((page) => page.id));
  return {
    kind: "landing-experience",
    mode: "live",
    preview: false,
    authenticated: true,
    blockKey: tool.blockKey,
    pages: mapped,
    suggestedPageId: suggestedPageId ?? mapped[0]?.id ?? null,
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
  if (slug !== SITE_EXPERIENCE_SLUG) return { ok: false as const, message: "Aula inválida.", code: undefined };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível.", code: undefined };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== LANDING_PAGE_EXPERIENCE_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida.", code: undefined };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

async function currentView(userId: string, landingPageProjectId: string) {
  const record = await createPrismaLandingPageStore().findByIdForUser(landingPageProjectId, userId);
  if (!record) return null;
  const media = await createPrismaLandingPageMediaStore().listForProjectOwner(landingPageProjectId, userId);
  return toExperiencePageView(record, media);
}

export async function saveExperienceReviewForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; review: ExperienceReviewInput; intent: "save" | "complete" },
): Promise<
  | { ok: true; snapshot: LessonSnapshot; page: ExperiencePageView; draftRevision: number; completed: boolean }
  | { ok: false; message: string; code?: string }
> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await saveLandingPageExperienceReview(createPrismaLandingPageStore(), createPrismaLandingPageMediaStore(), {
    userId,
    landingPageProjectId: input.landingPageProjectId,
    expectedRevision: input.expectedRevision,
    review: input.review,
  });
  if (!saved.ok) return { ok: false, message: landingPageMessage(saved.code), code: saved.code };
  const summary = experienceLessonResult({
    landingPageProjectId: saved.value.id,
    document: saved.value.draftDocument,
    draftRevision: saved.value.draftRevision,
  });
  const completed = summary !== null;
  if (completed && summary) {
    const payload = summary as unknown as Prisma.InputJsonValue;
    if (saved.value.projectId) {
      const existing = await access.prisma.lessonResult.findFirst({ where: { userId, lessonId: access.lessonId, projectId: saved.value.projectId } });
      if (existing) await access.prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
      else await access.prisma.lessonResult.create({ data: { userId, lessonId: access.lessonId, projectId: saved.value.projectId, payload } });
    }
    await upsertPersonalLessonResult(userId, access.lessonId, {
      ...summary,
      viewports: String(summary.viewportsReviewed),
      bloqueios: String(summary.blockerCount),
      atencoes: String(summary.attentionCount),
      adiadas: String(summary.deferredCount),
      observacoes: String(summary.userFindingCount),
      resolvidas: String(summary.resolvedCount),
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
  const page = await currentView(userId, saved.value.id);
  if (!page) return { ok: false, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  return { ok: true, snapshot, page, draftRevision: saved.value.draftRevision, completed };
}
