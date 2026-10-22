import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects } from "@/lib/landing-page/service";
import {
  LANDING_PAGE_MEASUREMENT_TOOL,
  measurementLessonResult,
  measurementPreviewState,
  measurementResultDisplay,
  SITE_MEASUREMENT_SLUG,
  toMeasurementPageView,
  type MeasurementPageView,
  type MeasurementPanel,
} from "@/lib/landing-page/measurement/lesson-flow";
import { saveLandingPageMeasurementLesson } from "@/lib/landing-page/measurement/lesson-plan";

export { SITE_MEASUREMENT_SLUG, measurementPreviewState };
export type { MeasurementPageView, MeasurementPanel };

export async function loadMeasurementPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<MeasurementPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === LANDING_PAGE_MEASUREMENT_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return {
      kind: "landing-measurement",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      pages: [],
      suggestedPageId: null,
    };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mapped: MeasurementPageView[] = [];
  for (const page of pages) {
    const record = await createPrismaLandingPageStore().findByIdForUser(page.id, input.userId);
    if (!record) continue;
    mapped.push(toMeasurementPageView(record));
  }
  const suggestedPageId = await lessonPageId(input.userId, mapped.map((page) => page.id));
  return {
    kind: "landing-measurement",
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
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_MEASUREMENT_SLUG }, select: { id: true } });
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
  if (slug !== SITE_MEASUREMENT_SLUG) return { ok: false as const, message: "Aula inválida.", code: undefined };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível.", code: undefined };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== LANDING_PAGE_MEASUREMENT_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida.", code: undefined };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

export async function saveMeasurementPlanForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    landingPageProjectId: string;
    expectedRevision: number;
    action?: unknown;
    form?: { sectionId: string; content: unknown } | null;
    measurement: unknown;
    confirmed: boolean;
  },
): Promise<
  | { ok: true; snapshot: LessonSnapshot; page: MeasurementPageView; draftRevision: number; completed: boolean }
  | { ok: false; message: string; code?: string }
> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await saveLandingPageMeasurementLesson(createPrismaLandingPageStore(), { userId, ...input });
  if (!saved.ok) return { ok: false, message: landingPageMessage(saved.code), code: saved.code };
  const completedAt = new Date().toISOString();
  const summary = measurementLessonResult({
    landingPageProjectId: saved.value.id,
    document: saved.value.draftDocument,
    draftRevision: saved.value.draftRevision,
    completedAt,
  });
  const completed = summary !== null;
  if (completed && summary) {
    const payload = summary as unknown as Prisma.InputJsonValue;
    if (saved.value.projectId) {
      const existing = await access.prisma.lessonResult.findFirst({
        where: { userId, lessonId: access.lessonId, projectId: saved.value.projectId },
      });
      if (existing) await access.prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
      else await access.prisma.lessonResult.create({ data: { userId, lessonId: access.lessonId, projectId: saved.value.projectId, payload } });
    }
    await upsertPersonalLessonResult(userId, access.lessonId, {
      ...summary,
      ...measurementResultDisplay(summary),
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
  const record = await createPrismaLandingPageStore().findByIdForUser(saved.value.id, userId);
  if (!record) return { ok: false, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  return { ok: true, snapshot, page: toMeasurementPageView(record), draftRevision: saved.value.draftRevision, completed };
}
