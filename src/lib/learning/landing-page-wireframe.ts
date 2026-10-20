import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { SITE_OFFER_BRIEF_SLUG } from "@/lib/learning/conversion-page-brief";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { getReaderSnapshot } from "@/lib/learning/catalog";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { SITE_VISITOR_JOURNEY_SLUG } from "@/lib/learning/visitor-decision";
import type { LandingComponentType } from "@/lib/landing-page/constants";
import { landingPageMessage, type LandingPageCode } from "@/lib/landing-page/errors";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects } from "@/lib/landing-page/service";
import { confidenceLabel, strategyLabel } from "@/lib/landing-page/wireframe/policy";
import { wireframeContextCompleteness } from "@/lib/landing-page/wireframe/from-brief";
import {
  applyReviewedWireframe,
  proposeWireframeFromDocument,
  updateLandingPageWireframeStructure,
  type WireframeProposal,
} from "@/lib/landing-page/wireframe/structure";
import { wireframeStructureResponseSchema, type WireframeStructureSummary } from "@/lib/landing-page/wireframe/summary";

export const LANDING_PAGE_WIREFRAME_TOOL = "LANDING_PAGE_WIREFRAME_V1" as const;
export const SITE_WIREFRAME_SLUG = "organize-as-secoes-da-pagina";
export const WIREFRAME_CONFLICT_MESSAGE = "Esta página foi alterada em outro lugar. Atualize a estrutura antes de salvar novamente.";

export type WireframeSectionView = {
  id: string;
  type: LandingComponentType;
  variant: string;
  order: number;
  contentStatus: "PLACEHOLDER" | "DRAFT" | "APPROVED" | null;
};

export type WireframePage = {
  id: string;
  title: string;
  draftRevision: number;
  offerName: string | null;
  audience: string | null;
  hasBrief: boolean;
  hasJourney: boolean;
  completeness: "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";
  sectionCount: number;
  hasWireframe: boolean;
  foreignStructure: boolean;
  status: string;
  sections: WireframeSectionView[];
};

export type WireframePanel = {
  kind: "landing-wireframe";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: WireframePage[];
  suggestedPageId: string | null;
};

export function wireframePreviewState(): WireframePanel {
  return {
    kind: "landing-wireframe",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-wireframe",
    pages: [],
    suggestedPageId: null,
  };
}

export async function loadWireframePanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<WireframePanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === LANDING_PAGE_WIREFRAME_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return {
      kind: "landing-wireframe",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      pages: [],
      suggestedPageId: null,
    };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mapped: WireframePage[] = pages.map((page) => {
    const brief = page.draftDocument.strategy?.brief;
    const sections = page.draftDocument.sections;
    const hasWireframe = Boolean(page.draftDocument.strategy?.wireframe);
    return {
      id: page.id,
      title: page.title,
      draftRevision: page.draftRevision,
      offerName: brief?.offer.name ?? null,
      audience: brief?.audience.description ?? null,
      hasBrief: Boolean(brief),
      hasJourney: Boolean(page.draftDocument.strategy?.decisionJourney),
      completeness: wireframeContextCompleteness(page.draftDocument),
      sectionCount: sections.length,
      hasWireframe,
      foreignStructure: sections.length > 0 && !hasWireframe,
      status: page.status,
      sections: sections.map((section) => ({
        id: section.id,
        type: section.type,
        variant: section.variant,
        order: section.order,
        contentStatus: section.contentStatus ?? null,
      })),
    };
  });
  const ready = mapped.filter((page) => page.hasBrief);
  const suggestedPageId = (await lessonPageId(input.userId, SITE_VISITOR_JOURNEY_SLUG, ready.map((page) => page.id)))
    ?? (await lessonPageId(input.userId, SITE_OFFER_BRIEF_SLUG, ready.map((page) => page.id)))
    ?? (ready.length === 1 ? ready[0].id : null);
  return {
    kind: "landing-wireframe",
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
  const results = await prisma.lessonResult.findMany({
    where: { userId, lessonId: lesson.id },
    select: { payload: true },
  });
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
  if (slug !== SITE_WIREFRAME_SLUG) return { ok: false as const, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível." };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== LANDING_PAGE_WIREFRAME_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida." };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

function failureMessage(code: LandingPageCode) {
  if (code === "LANDING_PAGE_DRAFT_CONFLICT") return WIREFRAME_CONFLICT_MESSAGE;
  return landingPageMessage(code);
}

export async function proposeWireframeForUser(
  userId: string,
  slug: string,
  blockKey: string,
  landingPageProjectId: string,
): Promise<{ ok: true; snapshot: LessonSnapshot; proposal: WireframeProposal } | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const record = await createPrismaLandingPageStore().findByIdForUser(landingPageProjectId, userId);
  if (!record) return { ok: false, message: landingPageMessage("NOT_FOUND"), code: "NOT_FOUND" };
  const proposal = proposeWireframeFromDocument(record.draftDocument);
  if (!proposal.ok) return { ok: false, message: proposal.message, code: proposal.code };
  const reader = await getReaderSnapshot(userId, access.lessonId);
  return { ok: true, snapshot: reader.snapshot, proposal: proposal.value };
}

async function persistSummary(
  userId: string,
  lessonId: string,
  blockKey: string,
  prisma: ReturnType<typeof getPrisma>,
  projectId: string | null,
  summary: WireframeStructureSummary,
) {
  const payload = summary as unknown as Prisma.InputJsonValue;
  if (projectId) {
    const existing = await prisma.lessonResult.findFirst({ where: { userId, lessonId, projectId } });
    if (existing) await prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
    else await prisma.lessonResult.create({ data: { userId, lessonId, projectId, payload } });
  }
  await upsertPersonalLessonResult(userId, lessonId, {
    kind: summary.kind,
    landingPageProjectId: summary.landingPageProjectId,
    engineVersion: summary.engineVersion,
    planFingerprint: summary.planFingerprint,
    strategy: summary.strategy,
    confidence: summary.confidence,
    sectionCount: String(summary.sectionCount),
    sectionTypes: summary.sectionTypes.join(","),
    userModified: summary.userModified ? "sim" : "nao",
    contextCompleteness: summary.contextCompleteness,
    draftRevision: String(summary.draftRevision),
    completedAt: summary.completedAt,
    estrutura: strategyLabel(summary.strategy),
    recomendacao: confidenceLabel(summary.confidence),
    secoes: String(summary.sectionCount),
  });
  await prisma.lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId, blockKey } },
    create: { userId, lessonId, blockKey, payload },
    update: { payload },
  });
  const now = new Date();
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId, blockKey } },
    create: { userId, lessonId, blockKey, viewedAt: now, completedAt: now },
    update: { completedAt: now },
  });
}

export async function applyWireframeForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; reviewed: unknown },
): Promise<{ ok: true; snapshot: LessonSnapshot; landingPageProjectId: string; draftRevision: number; previewHref: string } | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await applyReviewedWireframe(createPrismaLandingPageStore(), {
    userId,
    landingPageProjectId: input.landingPageProjectId,
    expectedRevision: input.expectedRevision,
    reviewed: input.reviewed,
  });
  if (!saved.ok) return { ok: false, message: failureMessage(saved.code), code: saved.code };
  const wireframe = saved.value.draftDocument.strategy?.wireframe;
  if (!wireframe) return { ok: false, message: "Não foi possível registrar a estrutura." };
  const summary = wireframeStructureResponseSchema.parse({
    kind: "wireframe-structure-summary",
    landingPageProjectId: saved.value.id,
    engineVersion: wireframe.engineVersion,
    planFingerprint: wireframe.planFingerprint,
    strategy: wireframe.strategy,
    confidence: wireframe.confidence,
    sectionCount: saved.value.draftDocument.sections.length,
    sectionTypes: saved.value.draftDocument.sections.map((section) => section.type),
    userModified: wireframe.userModified,
    contextCompleteness: wireframeContextCompleteness(saved.value.draftDocument),
    draftRevision: saved.value.draftRevision,
    completedAt: new Date().toISOString(),
  });
  await persistSummary(userId, access.lessonId, blockKey, access.prisma, saved.value.projectId, summary);
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return {
    ok: true,
    snapshot,
    landingPageProjectId: saved.value.id,
    draftRevision: saved.value.draftRevision,
    previewHref: `/app/landing-pages/${saved.value.id}/preview`,
  };
}

export async function saveWireframeStructureForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    landingPageProjectId: string;
    expectedRevision: number;
    orderedSectionIds: string[];
    additions?: Array<{ type: LandingComponentType; variant?: string }>;
  },
): Promise<{ ok: true; snapshot: LessonSnapshot; landingPageProjectId: string; draftRevision: number; previewHref: string } | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await updateLandingPageWireframeStructure(createPrismaLandingPageStore(), {
    userId,
    landingPageProjectId: input.landingPageProjectId,
    expectedRevision: input.expectedRevision,
    orderedSectionIds: input.orderedSectionIds,
    additions: input.additions,
  });
  if (!saved.ok) return { ok: false, message: failureMessage(saved.code), code: saved.code };
  const wireframe = saved.value.draftDocument.strategy?.wireframe;
  if (!wireframe) return { ok: false, message: "Não foi possível registrar a estrutura." };
  const summary = wireframeStructureResponseSchema.parse({
    kind: "wireframe-structure-summary",
    landingPageProjectId: saved.value.id,
    engineVersion: wireframe.engineVersion,
    planFingerprint: wireframe.planFingerprint,
    strategy: wireframe.strategy,
    confidence: wireframe.confidence,
    sectionCount: saved.value.draftDocument.sections.length,
    sectionTypes: saved.value.draftDocument.sections.map((section) => section.type),
    userModified: wireframe.userModified,
    contextCompleteness: wireframeContextCompleteness(saved.value.draftDocument),
    draftRevision: saved.value.draftRevision,
    completedAt: new Date().toISOString(),
  });
  await persistSummary(userId, access.lessonId, blockKey, access.prisma, saved.value.projectId, summary);
  const snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  return {
    ok: true,
    snapshot,
    landingPageProjectId: saved.value.id,
    draftRevision: saved.value.draftRevision,
    previewHref: `/app/landing-pages/${saved.value.id}/preview`,
  };
}
