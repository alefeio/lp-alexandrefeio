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
import { copyCoverage } from "@/lib/landing-page/copy/lesson-flow";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects, type LandingPageProjectView } from "@/lib/landing-page/service";
import { saveLandingPageVisualDirection } from "@/lib/landing-page/theme/service";
import {
  goalLabel,
  SITE_VISUAL_SLUG,
  startingPointLabel,
  visualLessonResponseSchema,
  visualLessonResult,
  visualUserMessage,
  type VisualPageView,
} from "@/lib/landing-page/theme/visual-direction";
import { SECTION_NAMES } from "@/lib/landing-page/wireframe/policy";

export { SITE_VISUAL_SLUG };

export type VisualPanel = {
  kind: "landing-visual";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: VisualPageView[];
  suggestedPageId: string | null;
};

export function visualPreviewState(): VisualPanel {
  return {
    kind: "landing-visual",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-visual",
    pages: [],
    suggestedPageId: null,
  };
}

export function toVisualPageView(page: LandingPageProjectView): VisualPageView {
  const ready = page.draftDocument.sections.length > 0;
  return {
    id: page.id,
    title: page.title,
    draftRevision: page.draftRevision,
    status: page.status,
    setup: ready ? "READY" : "NEED_SECTIONS",
    copyHint: ready && !copyCoverage(page.draftDocument).coreComplete,
    theme: page.draftDocument.theme,
    sections: page.draftDocument.sections.map((section) => ({
      id: section.id,
      type: section.type,
      label: SECTION_NAMES[section.type],
      variant: section.variant,
      enabled: section.enabled,
      settings: section.settings,
    })),
    direction: page.draftDocument.strategy?.visualDirection ?? null,
    previewHref: `/app/landing-pages/${page.id}/preview`,
  };
}

export async function loadVisualPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<VisualPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "LANDING_PAGE_VISUAL_DIRECTION_V1");
  if (!tool) return null;
  if (!input.userId) {
    return { kind: "landing-visual", mode: "live", preview: false, authenticated: false, blockKey: tool.blockKey, pages: [], suggestedPageId: null };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mapped = pages.map((page) => toVisualPageView(page));
  const ready = mapped.filter((page) => page.setup === "READY");
  const suggestedPageId = (await lessonPageId(input.userId, SITE_COPY_SLUG, ready.map((page) => page.id)))
    ?? (await lessonPageId(input.userId, SITE_WIREFRAME_SLUG, ready.map((page) => page.id)))
    ?? (ready.length === 1 ? ready[0].id : null);
  return {
    kind: "landing-visual",
    mode: "live",
    preview: false,
    authenticated: true,
    blockKey: tool.blockKey,
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
  if (slug !== SITE_VISUAL_SLUG) return { ok: false as const, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível." };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "LANDING_PAGE_VISUAL_DIRECTION_V1") {
    return { ok: false as const, message: "Ferramenta inválida." };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

export async function saveVisualDirectionForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    landingPageProjectId: string;
    expectedRevision: number;
    theme: unknown;
    sections: unknown;
    direction: unknown;
  },
): Promise<{ ok: true; snapshot: LessonSnapshot; landingPageProjectId: string; draftRevision: number; previewHref: string; page: VisualPageView } | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await saveLandingPageVisualDirection(createPrismaLandingPageStore(), { userId, ...input });
  if (!saved.ok) return { ok: false, message: visualUserMessage(saved.code), code: saved.code };
  const direction = saved.value.draftDocument.strategy?.visualDirection;
  if (!direction) return { ok: false, message: visualUserMessage("INVALID_INPUT"), code: "INVALID_INPUT" };
  const summary = visualLessonResponseSchema.parse(visualLessonResult({
    landingPageProjectId: saved.value.id,
    direction,
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
    partida: startingPointLabel(summary.startingPoint),
    prioridade: goalLabel(summary.primaryVisualGoal),
    destaques: String(summary.featuredSectionCount),
    avisos: String(summary.warningCount),
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
  return {
    ok: true,
    snapshot,
    landingPageProjectId: saved.value.id,
    draftRevision: saved.value.draftRevision,
    previewHref: `/app/landing-pages/${saved.value.id}/preview`,
    page: toVisualPageView(saved.value),
  };
}
