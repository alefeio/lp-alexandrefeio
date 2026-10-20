import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import { SITE_OFFER_BRIEF_SLUG } from "@/lib/learning/conversion-page-brief";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { visitorDecisionLessonSummary } from "@/lib/landing-page/decision-journey";
import { landingPageMessage } from "@/lib/landing-page/errors";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects, saveVisitorDecisionJourney } from "@/lib/landing-page/service";
import { wireframeContextCompleteness } from "@/lib/landing-page/wireframe/from-brief";

export const VISITOR_DECISION_JOURNEY_TOOL = "VISITOR_DECISION_JOURNEY_V1" as const;
export const SITE_VISITOR_JOURNEY_SLUG = "jornada-do-visitante";
export const VISITOR_JOURNEY_CONFLICT_MESSAGE = "Esta página foi alterada em outro lugar. Atualize os dados antes de salvar novamente.";
export const VISITOR_JOURNEY_BRIEF_MESSAGE = "Defina primeiro a estratégia básica desta página.";
export const VISITOR_JOURNEY_CONFIRM_MESSAGE = "A ação principal vai mudar. Confirme antes de salvar.";

export type VisitorDecisionPage = {
  id: string;
  title: string;
  slug: string;
  draftRevision: number;
  projectId: string | null;
  hasBrief: boolean;
  offerName: string | null;
  audience: string | null;
  primaryActionType: string | null;
  objections: string[];
  arrivalNote: string | null;
};

export type VisitorDecisionPanel = {
  kind: "visitor-decision";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: VisitorDecisionPage[];
  suggestedPageId: string | null;
};

export function visitorDecisionPreviewState(): VisitorDecisionPanel {
  return {
    kind: "visitor-decision",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-jornada",
    pages: [],
    suggestedPageId: null,
  };
}

export async function loadVisitorDecisionPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<VisitorDecisionPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === VISITOR_DECISION_JOURNEY_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return {
      kind: "visitor-decision",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      pages: [],
      suggestedPageId: null,
    };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mapped: VisitorDecisionPage[] = pages.map((page) => {
    const brief = page.draftDocument.strategy?.brief;
    return {
      id: page.id,
      title: page.title,
      slug: page.slug,
      draftRevision: page.draftRevision,
      projectId: page.projectId,
      hasBrief: Boolean(brief),
      offerName: brief?.offer.name ?? null,
      audience: brief?.audience.description ?? null,
      primaryActionType: brief?.primaryAction.type ?? null,
      objections: brief?.objections ?? [],
      arrivalNote: brief?.arrivalContext.whatVisitorMayAlreadyKnow ?? null,
    };
  });
  const withBrief = mapped.filter((page) => page.hasBrief);
  const fromLesson = await lessonFourPageId(input.userId, withBrief.map((page) => page.id));
  const suggestedPageId = fromLesson ?? (withBrief.length === 1 ? withBrief[0].id : null);
  return {
    kind: "visitor-decision",
    mode: "live",
    preview: false,
    authenticated: true,
    blockKey: tool.blockKey,
    pages: mapped,
    suggestedPageId,
  };
}

async function lessonFourPageId(userId: string, ownedIds: string[]) {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_OFFER_BRIEF_SLUG }, select: { id: true } });
  if (!lesson) return null;
  const results = await prisma.lessonResult.findMany({
    where: { userId, lessonId: lesson.id },
    select: { payload: true },
  });
  for (const result of results) {
    const payload = result.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) continue;
    const id = "landingPageProjectId" in payload ? payload.landingPageProjectId : null;
    if (typeof id === "string" && ownedIds.includes(id)) return id;
  }
  return null;
}

export async function saveVisitorDecisionForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; decisionJourney: unknown; confirmActionChange?: boolean },
): Promise<{ ok: true; snapshot: LessonSnapshot; landingPageProjectId: string; draftRevision: number } | { ok: false; message: string; code?: string }> {
  if (slug !== SITE_VISITOR_JOURNEY_SLUG) return { ok: false, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false, message: "Esta aula ainda não está disponível." };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== VISITOR_DECISION_JOURNEY_TOOL) {
    return { ok: false, message: "Ferramenta inválida." };
  }

  const saved = await saveVisitorDecisionJourney(createPrismaLandingPageStore(), {
    userId,
    landingPageProjectId: input.landingPageProjectId,
    expectedRevision: input.expectedRevision,
    decisionJourney: input.decisionJourney,
    confirmActionChange: input.confirmActionChange,
  });
  if (!saved.ok) {
    const message =
      saved.code === "LANDING_PAGE_DRAFT_CONFLICT"
        ? VISITOR_JOURNEY_CONFLICT_MESSAGE
        : saved.code === "LANDING_PAGE_BRIEF_REQUIRED"
          ? VISITOR_JOURNEY_BRIEF_MESSAGE
          : saved.code === "ACTION_CHANGE_REQUIRES_CONFIRMATION"
            ? VISITOR_JOURNEY_CONFIRM_MESSAGE
            : landingPageMessage(saved.code);
    return { ok: false, message, code: saved.code };
  }

  const journey = saved.value.draftDocument.strategy?.decisionJourney;
  if (!journey) return { ok: false, message: "Não foi possível registrar a jornada." };
  const summary = visitorDecisionLessonSummary(
    saved.value.id,
    journey,
    wireframeContextCompleteness(saved.value.draftDocument),
    new Date().toISOString(),
  );
  const payload = summary as unknown as Prisma.InputJsonValue;
  if (saved.value.projectId) {
    const existing = await prisma.lessonResult.findFirst({
      where: { userId, lessonId: lesson.id, projectId: saved.value.projectId },
    });
    if (existing) await prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
    else await prisma.lessonResult.create({ data: { userId, lessonId: lesson.id, projectId: saved.value.projectId, payload } });
  }
  await upsertPersonalLessonResult(userId, lesson.id, {
    kind: summary.kind,
    landingPageProjectId: summary.landingPageProjectId,
    consciencia: summary.awarenessLevel,
    explicacao: summary.explanationNeed,
    confianca: summary.trustNeed,
    contextCompleteness: summary.contextCompleteness,
    objectionCount: String(summary.objectionCount),
    decisionStageCount: String(summary.decisionStageCount),
    completedAt: summary.completedAt,
  });
  await prisma.lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: lesson.id, blockKey } },
    create: { userId, lessonId: lesson.id, blockKey, payload },
    update: { payload },
  });
  const now = new Date();
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: lesson.id, blockKey } },
    create: { userId, lessonId: lesson.id, blockKey, viewedAt: now, completedAt: now },
    update: { completedAt: now },
  });
  const snapshot = await recomputeProgress(userId, lesson.id, blockKey);
  return { ok: true, snapshot, landingPageProjectId: saved.value.id, draftRevision: saved.value.draftRevision };
}
