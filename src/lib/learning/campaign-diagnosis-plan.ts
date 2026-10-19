import { lessonToolReturnPath } from "@/lib/auth/messages";
import { aggregateCampaignBytes } from "@/lib/campaign-data/aggregate";
import { bottleneckLabel } from "@/lib/campaign-data/diagnosis";
import { fieldLabel } from "@/lib/campaign-data/labels";
import { createPrivateBlobStorage } from "@/lib/campaign-data/blob-storage";
import { BASE_METRICS, DERIVED_METRICS, DIMENSIONS, type BaseMetricId, type DerivedMetricId, type DimensionId } from "@/lib/campaign-data/types";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import {
  buildDiagnosisResult,
  importVisibleTo,
  metricLines,
  preferredImportId,
  priorContextNote,
  type CampaignDiagnosisResult,
  type MetricLine,
} from "@/lib/learning/campaign-diagnosis";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_11_SLUG } from "@/lib/learning/lesson-11";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";

const KNOWN_METRICS = new Set<string>([...BASE_METRICS, ...DERIVED_METRICS]);
const KNOWN_DIMENSIONS = new Set<string>(DIMENSIONS);

export type DiagnosisSegmentView = {
  key: string;
  spendShare: number | null;
  conversionShare: number | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  conversions: number | null;
};

export type DiagnosisDimensionView = {
  dimension: DimensionId;
  label: string;
  segments: DiagnosisSegmentView[];
};

export type DiagnosisView = {
  result: CampaignDiagnosisResult;
  lines: MetricLine[];
  dimensions: DiagnosisDimensionView[];
  contextNote: string | null;
  fileName: string;
  rowCount: number;
  columnCount: number;
  bottleneckLabel: string;
};

export type DiagnosisImportChoice = {
  id: string;
  fileName: string;
  sourcePlatform: string;
  rowCount: number | null;
  columnCount: number | null;
};

export type DiagnosisProjectChoice = {
  id: string;
  name: string;
  imports: DiagnosisImportChoice[];
  contextNote: string | null;
};

export type CampaignDiagnosisPanel =
  | { mode: "preview"; kind: "diagnosis" }
  | {
      mode: "live";
      kind: "diagnosis";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      chooseProject: boolean;
      projects: DiagnosisProjectChoice[];
      linkedProjectId: string | null;
      view: DiagnosisView | null;
    };

export function campaignDiagnosisPreviewState(): CampaignDiagnosisPanel {
  return { mode: "preview", kind: "diagnosis" };
}

export async function loadCampaignDiagnosisPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<CampaignDiagnosisPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_11_SLUG, "diagnostico");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  if (!input.userId) return emptyLive(tool.blockKey, createProjectHref);

  const prisma = getPrisma();
  const [lesson, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_11_SLUG }, select: { id: true } }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const [imports, prior, response] = await Promise.all([
    prisma.campaignDataImport.findMany({
      where: { userId: input.userId, projectId: { in: projectIds }, status: "READY" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectId: true,
        originalFileName: true,
        sourcePlatform: true,
        rowCount: true,
        columnCount: true,
      },
    }),
    lesson
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, projectId: { in: projectIds }, lessonId: { not: lesson.id } },
          select: { projectId: true },
        })
      : [],
    lesson
      ? prisma.lessonResponse.findUnique({
          where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
          select: { payload: true },
        })
      : null,
  ]);
  const linkedProjectId = projectIdFrom(response?.payload);
  const choices = projects.map((project) => ({
    id: project.id,
    name: project.name,
    contextNote: priorContextNote(prior.some((item) => item.projectId === project.id)),
    imports: imports
      .filter((item) => item.projectId === project.id)
      .map((item) => ({
        id: item.id,
        fileName: item.originalFileName ?? "Arquivo",
        sourcePlatform: item.sourcePlatform,
        rowCount: item.rowCount,
        columnCount: item.columnCount,
      })),
  }));
  const focus = choices.find((project) => project.id === linkedProjectId) ?? choices.find((project) => project.imports.length > 0) ?? null;
  const importId = focus ? preferredImportId(focus.imports.map((item) => item.id)) : null;
  let view: DiagnosisView | null = null;
  if (focus && importId) {
    try {
      view = await readDiagnosisView(input.userId, focus.id, importId, focus.contextNote);
    } catch {
      view = null;
    }
  }

  return {
    mode: "live",
    kind: "diagnosis",
    lessonSlug: LESSON_11_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    chooseProject: projects.length > 1,
    projects: choices,
    linkedProjectId,
    view,
  };
}

function emptyLive(blockKey: string, createProjectHref: string): CampaignDiagnosisPanel {
  return {
    mode: "live",
    kind: "diagnosis",
    lessonSlug: LESSON_11_SLUG,
    blockKey,
    authenticated: false,
    createProjectHref,
    chooseProject: false,
    projects: [],
    linkedProjectId: null,
    view: null,
  };
}

export async function openCampaignDiagnosisForUser(userId: string, projectId: string, importId: string) {
  const project = await getPrisma().project.findFirst({ where: { id: projectId, userId, status: "ACTIVE" }, select: { id: true } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  const started = Date.now();
  try {
    const view = await readDiagnosisView(userId, projectId, importId, null);
    if (!view) return { ok: false as const, message: "Arquivo não encontrado." };
    logSafe({ importId, status: "READY", rowCount: view.rowCount, durationMs: Date.now() - started });
    return { ok: true as const, view };
  } catch {
    logSafe({ importId, status: "FAILED", durationMs: Date.now() - started, code: "STORAGE_FAILED" });
    return { ok: false as const, message: "Não foi possível ler este arquivo." };
  }
}

export async function saveCampaignDiagnosisForUser(userId: string, slug: string, blockKey: string, projectId: string, importId: string) {
  const gate = await openLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const opened = await openCampaignDiagnosisForUser(userId, projectId, importId);
  if (!opened.ok) return opened;
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.lessonResult.findFirst({
      where: { userId, lessonId: gate.lessonId, projectId },
      select: { id: true },
    });
    if (existing) await tx.lessonResult.update({ where: { id: existing.id }, data: { payload: opened.view.result } });
    else await tx.lessonResult.create({ data: { userId, lessonId: gate.lessonId, projectId, payload: opened.view.result } });
    await tx.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: gate.lessonId, blockKey } },
      create: { userId, lessonId: gate.lessonId, blockKey, payload: { projectId } },
      update: { payload: { projectId } },
    });
    const now = new Date();
    await tx.lessonBlockProgress.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: gate.lessonId, blockKey } },
      create: { userId, lessonId: gate.lessonId, blockKey, viewedAt: now, completedAt: now },
      update: { completedAt: now },
    });
  });
  const snapshot = await recomputeProgress(userId, gate.lessonId, blockKey);
  const panel = await loadCampaignDiagnosisPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel, view: opened.view };
}

async function readDiagnosisView(userId: string, projectId: string, importId: string, contextNote: string | null): Promise<DiagnosisView | null> {
  const row = await getPrisma().campaignDataImport.findFirst({
    where: { id: importId, projectId, userId },
    select: {
      id: true,
      userId: true,
      projectId: true,
      status: true,
      sourcePlatform: true,
      currency: true,
      originalFileName: true,
      rowCount: true,
      columnCount: true,
      normalizedStoragePath: true,
      availableDimensions: true,
      availableMetrics: true,
    },
  });
  if (!importVisibleTo(userId, projectId, row) || !row?.normalizedStoragePath || !row.currency) return null;
  const bytes = await createPrivateBlobStorage().get(row.normalizedStoragePath);
  if (!bytes) return null;
  const aggregate = await aggregateCampaignBytes(bytes);
  const availableDimensions = stringList(row.availableDimensions).filter((item): item is DimensionId => KNOWN_DIMENSIONS.has(item));
  const availableMetrics = stringList(row.availableMetrics).filter((item): item is BaseMetricId | DerivedMetricId => KNOWN_METRICS.has(item));
  const result = buildDiagnosisResult({
    projectId,
    campaignDataImportId: row.id,
    sourcePlatform: row.sourcePlatform,
    currency: row.currency,
    availableDimensions,
    availableMetrics,
    aggregate,
    selectedDimension: null,
  });
  return {
    result,
    lines: metricLines(result, aggregate.derived),
    dimensions: aggregate.dimensions.map((dimension) => ({
      dimension: dimension.dimension,
      label: fieldLabel(dimension.dimension),
      segments: dimension.segments.map((segment) => ({
        key: segment.key,
        spendShare: segment.shares.spendShare,
        conversionShare: segment.shares.conversionShare,
        impressions: segment.totals.impressions ?? null,
        clicks: segment.totals.clicks ?? null,
        spend: segment.totals.spend ?? null,
        conversions: segment.totals.conversions ?? null,
      })),
    })),
    contextNote,
    fileName: row.originalFileName ?? "Arquivo",
    rowCount: row.rowCount ?? aggregate.rowCount,
    columnCount: row.columnCount ?? 0,
    bottleneckLabel: bottleneckLabel(result.primaryBottleneck),
  };
}

async function openLesson(userId: string, slug: string, blockKey?: string) {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  const entitled = lesson ? await hasActiveEntitlement(userId, lesson.id) : false;
  if (!lesson || !canReadLessonBody(lesson, { entitled })) return { ok: false as const, message: "Esta aula não está aberta para salvar." };
  if (blockKey) {
    const rules = await loadRuleBlocks(lesson.id);
    const block = rules.find((rule) => rule.blockKey === blockKey && !rule.retiredAt && rule.data.type === "TOOL");
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function projectIdFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("projectId" in payload)) return null;
  const value = payload.projectId;
  return typeof value === "string" ? value : null;
}

function logSafe(event: { importId: string; status: string; rowCount?: number; durationMs: number; code?: string }) {
  console.info(JSON.stringify({ scope: "campaign-diagnosis", ...event }));
}
