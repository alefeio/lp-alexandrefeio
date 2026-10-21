import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { getReaderSnapshot } from "@/lib/learning/catalog";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { SITE_VISITOR_JOURNEY_SLUG } from "@/lib/learning/visitor-decision";
import { SITE_WIREFRAME_SLUG } from "@/lib/learning/landing-page-wireframe";
import { COPY_LIVE_PROVIDER_TIMEOUT_MS } from "@/lib/landing-page/copy/config";
import { saveLandingPageCopyFacts } from "@/lib/landing-page/copy/facts";
import {
  copyAssistUserMessage,
  copyCoverage,
  copyLessonResponseSchema,
  copyLessonResult,
  toCopyWorkspace,
  type CopyCoverageV1,
  type CopyWorkspace,
} from "@/lib/landing-page/copy/lesson-flow";
import { resolveLandingPageCopyProvider } from "@/lib/landing-page/copy/providers/provider";
import { consumeCopyAssistRateLimit } from "@/lib/landing-page/copy/rate-limit";
import type { CopySuggestionResponseV1 } from "@/lib/landing-page/copy/schemas";
import {
  applyLandingPageCopy,
  approveLandingPageSectionCopy,
  generateLandingPageCopySuggestions,
} from "@/lib/landing-page/copy/service";
import { landingPageMessage, type LandingPageCode } from "@/lib/landing-page/errors";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { listLandingPageProjects, type LandingPageProjectView } from "@/lib/landing-page/service";
import type { CopyIntent } from "@/lib/landing-page/copy/constants";

export const LANDING_PAGE_COPY_TOOL = "LANDING_PAGE_COPY_ASSIST_V1" as const;
export const SITE_COPY_SLUG = "mensagem-que-deixa-a-oferta-clara";

export type CopyPanel = {
  kind: "landing-copy";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: CopyWorkspace[];
  suggestedPageId: string | null;
};

export type CopyToolSuccess = {
  ok: true;
  snapshot: LessonSnapshot;
  landingPageProjectId: string;
  draftRevision: number;
  previewHref: string;
  coverage: CopyCoverageV1;
  suggestions: CopySuggestionResponseV1 | null;
  workspace: CopyWorkspace;
};

export function copyPreviewState(): CopyPanel {
  return {
    kind: "landing-copy",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-copy",
    pages: [],
    suggestedPageId: null,
  };
}

export async function loadCopyPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<CopyPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === LANDING_PAGE_COPY_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return { kind: "landing-copy", mode: "live", preview: false, authenticated: false, blockKey: tool.blockKey, pages: [], suggestedPageId: null };
  }
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const mapped = pages.map((page) => toCopyWorkspace(page));
  const ready = mapped.filter((page) => page.setup === "READY");
  const suggestedPageId = (await lessonPageId(input.userId, SITE_WIREFRAME_SLUG, ready.map((page) => page.id)))
    ?? (await lessonPageId(input.userId, SITE_VISITOR_JOURNEY_SLUG, ready.map((page) => page.id)))
    ?? (ready.length === 1 ? ready[0].id : null);
  return {
    kind: "landing-copy",
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
  if (slug !== SITE_COPY_SLUG) return { ok: false as const, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false as const, message: "Esta aula ainda não está disponível." };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== LANDING_PAGE_COPY_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida." };
  }
  return { ok: true as const, lessonId: lesson.id, prisma };
}

function failure(code: LandingPageCode) {
  return { ok: false as const, message: copyAssistUserMessage(code) === "Não foi possível salvar agora." ? landingPageMessage(code) : copyAssistUserMessage(code), code };
}

async function finishWrite(
  userId: string,
  access: { lessonId: string; prisma: ReturnType<typeof getPrisma> },
  blockKey: string,
  saved: LandingPageProjectView,
): Promise<CopyToolSuccess> {
  const coverage = copyCoverage(saved.draftDocument);
  let snapshot = (await getReaderSnapshot(userId, access.lessonId)).snapshot;
  if (coverage.coreComplete) {
    const summary = copyLessonResponseSchema.parse(copyLessonResult({
      landingPageProjectId: saved.id,
      document: saved.draftDocument,
      draftRevision: saved.draftRevision,
      completedAt: new Date().toISOString(),
    }));
    await persistSummary(userId, access.lessonId, blockKey, access.prisma, saved.projectId, summary);
    snapshot = await recomputeProgress(userId, access.lessonId, blockKey);
  }
  return {
    ok: true,
    snapshot,
    landingPageProjectId: saved.id,
    draftRevision: saved.draftRevision,
    previewHref: `/app/landing-pages/${saved.id}/preview`,
    coverage,
    suggestions: null,
    workspace: toCopyWorkspace(saved),
  };
}

async function persistSummary(
  userId: string,
  lessonId: string,
  blockKey: string,
  prisma: ReturnType<typeof getPrisma>,
  projectId: string | null,
  summary: ReturnType<typeof copyLessonResult>,
) {
  const payload = summary as unknown as Prisma.InputJsonValue;
  if (projectId) {
    const existing = await prisma.lessonResult.findFirst({ where: { userId, lessonId, projectId } });
    if (existing) await prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
    else await prisma.lessonResult.create({ data: { userId, lessonId, projectId, payload } });
  }
  await upsertPersonalLessonResult(userId, lessonId, {
    ...summary,
    secoes: `${summary.approvedCoreCount} de ${summary.coreSectionCount}`,
    opcionais: String(summary.draftOptionalCount),
    origem: `${summary.manualSectionCount} escritos por você, ${summary.aiAssistedSectionCount} com sugestão`,
  } as unknown as Prisma.InputJsonValue);
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

export async function suggestCopyForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; sectionId: string; intent?: CopyIntent },
): Promise<CopyToolSuccess | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  if (!consumeCopyAssistRateLimit(userId)) return failure("COPY_ASSIST_RATE_LIMITED");
  const generated = await generateLandingPageCopySuggestions(
    createPrismaLandingPageStore(),
    { userId, ...input },
    resolveLandingPageCopyProvider(),
    { timeoutMs: COPY_LIVE_PROVIDER_TIMEOUT_MS },
  );
  if (!generated.ok) return failure(generated.code);
  const record = await createPrismaLandingPageStore().findByIdForUser(input.landingPageProjectId, userId);
  if (!record) return failure("NOT_FOUND");
  const snapshot = (await getReaderSnapshot(userId, access.lessonId)).snapshot;
  const workspace = toCopyWorkspace(record);
  return {
    ok: true,
    snapshot,
    landingPageProjectId: record.id,
    draftRevision: record.draftRevision,
    previewHref: workspace.previewHref,
    coverage: workspace.coverage,
    suggestions: generated.value,
    workspace,
  };
}

export async function applyCopyForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; sectionId: string; expectedRevision: number; content: unknown; origin?: "MANUAL" | "AI_ASSISTED" },
): Promise<CopyToolSuccess | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await applyLandingPageCopy(createPrismaLandingPageStore(), {
    userId,
    landingPageProjectId: input.landingPageProjectId,
    sectionId: input.sectionId,
    expectedRevision: input.expectedRevision,
    content: input.content,
    origin: input.origin ?? "AI_ASSISTED",
  });
  if (!saved.ok) return failure(saved.code);
  return finishWrite(userId, access, blockKey, saved.value);
}

export async function approveCopyForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; sectionId: string; expectedRevision: number },
): Promise<CopyToolSuccess | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await approveLandingPageSectionCopy(createPrismaLandingPageStore(), { userId, ...input });
  if (!saved.ok) return failure(saved.code);
  return finishWrite(userId, access, blockKey, saved.value);
}

export async function saveCopyFactsForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: { landingPageProjectId: string; expectedRevision: number; facts: unknown },
): Promise<CopyToolSuccess | { ok: false; message: string; code?: string }> {
  const access = await lessonAccess(userId, slug, blockKey);
  if (!access.ok) return access;
  const saved = await saveLandingPageCopyFacts(createPrismaLandingPageStore(), { userId, ...input });
  if (!saved.ok) return failure(saved.code);
  const snapshot = (await getReaderSnapshot(userId, access.lessonId)).snapshot;
  const workspace = toCopyWorkspace(saved.value);
  return {
    ok: true,
    snapshot,
    landingPageProjectId: saved.value.id,
    draftRevision: saved.value.draftRevision,
    previewHref: workspace.previewHref,
    coverage: workspace.coverage,
    suggestions: null,
    workspace,
  };
}
