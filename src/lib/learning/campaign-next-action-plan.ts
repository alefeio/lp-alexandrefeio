import type { Prisma } from "@/generated/prisma/client";
import { lessonToolReturnPath } from "@/lib/auth/messages";
import { actionTypeLabel, bottleneckStageLabel, isCoherentDecision, planNextCampaignAction, type ActionType } from "@/lib/campaign-data/next-action";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import { campaignBriefSchema } from "@/lib/learning/campaign-brief";
import {
  buildNextActionResult,
  campaignNextActionSchema,
  decisionChoices,
  observationDaysFromBrief,
  preferredDiagnosisImportId,
  type CampaignNextActionResult,
} from "@/lib/learning/campaign-next-action";
import { campaignDiagnosisSchema, type CampaignDiagnosisResult } from "@/lib/learning/campaign-diagnosis";
import { openCampaignDiagnosisForUser } from "@/lib/learning/campaign-diagnosis-plan";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_11_SLUG } from "@/lib/learning/lesson-11";
import { LESSON_12_SLUG } from "@/lib/learning/lesson-12";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { parseWhen } from "@/lib/plan/service";

export type NextActionChoice = {
  actionType: ActionType;
  title: string;
  reason: string;
  system: boolean;
};

export type NextActionView = {
  diagnosis: CampaignDiagnosisResult;
  diagnosisResultId: string | null;
  plan: ReturnType<typeof planNextCampaignAction>;
  choices: NextActionChoice[];
  bottleneckLabel: string;
  fileName: string;
  observationDays: 7 | 14 | 21 | 30 | null;
  saved: CampaignNextActionResult | null;
};

export type NextActionImportChoice = {
  id: string;
  fileName: string;
  sourcePlatform: string;
  rowCount: number | null;
  hasDiagnosisResult: boolean;
};

export type NextActionProjectChoice = {
  id: string;
  name: string;
  imports: NextActionImportChoice[];
};

export type CampaignNextActionPanel =
  | { mode: "preview"; kind: "next-action" }
  | {
      mode: "live";
      kind: "next-action";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      chooseProject: boolean;
      projects: NextActionProjectChoice[];
      linkedProjectId: string | null;
      view: NextActionView | null;
    };

export function campaignNextActionPreviewState(): CampaignNextActionPanel {
  return { mode: "preview", kind: "next-action" };
}

export async function loadCampaignNextActionPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<CampaignNextActionPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "CAMPAIGN_NEXT_ACTION_PLAN_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_12_SLUG, "proxima-acao");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "next-action",
      lessonSlug: LESSON_12_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
      view: null,
    };
  }

  const prisma = getPrisma();
  const [lesson11, lesson12, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_11_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_12_SLUG }, select: { id: true } }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        campaignDataImports: {
          where: { status: "READY", deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, originalFileName: true, sourcePlatform: true, rowCount: true },
        },
      },
    }),
  ]);
  const response = lesson12
    ? await prisma.lessonResponse.findUnique({
        where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson12.id, blockKey: tool.blockKey } },
        select: { payload: true },
      })
    : null;

  const linkedProjectId = projectIdFrom(response?.payload);
  const diagnosisRows = lesson11
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson11.id, projectId: { not: null } },
        select: { id: true, projectId: true, payload: true },
      })
    : [];
  const savedRows = lesson12
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson12.id, projectId: { not: null } },
        select: { projectId: true, payload: true },
      })
    : [];

  const projectChoices: NextActionProjectChoice[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    imports: project.campaignDataImports.map((row) => ({
      id: row.id,
      fileName: row.originalFileName ?? "Arquivo",
      sourcePlatform: row.sourcePlatform,
      rowCount: row.rowCount,
      hasDiagnosisResult: diagnosisRows.some((item) => {
        const parsed = campaignDiagnosisSchema.safeParse(item.payload);
        return parsed.success && item.projectId === project.id && parsed.data.campaignDataImportId === row.id;
      }),
    })),
  }));

  const focusId = linkedProjectId && projectChoices.some((item) => item.id === linkedProjectId)
    ? linkedProjectId
    : projectChoices.length === 1
      ? projectChoices[0].id
      : null;
  const focus = projectChoices.find((item) => item.id === focusId) ?? null;
  const importId = focus ? preferredDiagnosisImportId(focus.imports.map((item) => item.id)) : null;
  let view: NextActionView | null = null;
  if (focus && importId) {
    view = await buildView(input.userId, focus.id, importId, diagnosisRows, savedRows);
  }

  return {
    mode: "live",
    kind: "next-action",
    lessonSlug: LESSON_12_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    chooseProject: projectChoices.length > 1,
    projects: projectChoices,
    linkedProjectId: focusId,
    view,
  };
}

export async function openCampaignNextActionForUser(userId: string, projectId: string, importId: string) {
  const project = await getPrisma().project.findFirst({ where: { id: projectId, userId, status: "ACTIVE" }, select: { id: true } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  const started = Date.now();
  try {
    const view = await buildView(userId, projectId, importId, null, null);
    if (!view) return { ok: false as const, message: "Arquivo ou diagnóstico não encontrado." };
    logSafe({ importId, status: "READY", durationMs: Date.now() - started });
    return { ok: true as const, view };
  } catch {
    logSafe({ importId, status: "FAILED", durationMs: Date.now() - started, code: "OPEN_FAILED" });
    return { ok: false as const, message: "Não foi possível montar o plano deste arquivo." };
  }
}

export async function saveCampaignNextActionForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    projectId: string;
    importId: string;
    actionType: ActionType;
    title: string;
    reviewDate?: string | null;
    createTask?: boolean;
    createReminder?: boolean;
  },
) {
  const gate = await openLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const opened = await openCampaignNextActionForUser(userId, input.projectId, input.importId);
  if (!opened.ok) return opened;

  const coherent = isCoherentDecision(opened.view.plan, input.actionType);
  const reviewDate = input.reviewDate?.trim() ? input.reviewDate.trim() : null;
  if (reviewDate) {
    const parsed = parseWhen(reviewDate);
    if (!parsed || parsed === "invalid") return { ok: false as const, message: "Informe uma data de revisão válida." };
  }

  const prisma = getPrisma();
  const context = await loadContext(userId, input.projectId);
  let taskId: string | null = null;
  let reminderId: string | null = null;
  let recommendationId: string | null = null;

  const result = await prisma.$transaction(async (tx) => {
    const recommendation = await upsertRecommendation(tx, {
      projectId: input.projectId,
      title: input.title,
      description: opened.view.plan.reason,
      type: input.actionType,
      priority: opened.view.plan.priority,
      lessonSlug: opened.view.plan.lessonSlug,
    });
    recommendationId = recommendation.id;

    if (input.createTask && (input.actionType === "EXECUTE" || input.actionType === "ANALYZE")) {
      const existingTask = await tx.task.findFirst({
        where: {
          projectId: input.projectId,
          recommendationId: recommendation.id,
          status: { in: ["TODO", "IN_PROGRESS"] },
        },
      });
      if (existingTask) {
        taskId = existingTask.id;
      } else {
        const created = await tx.task.create({
          data: {
            projectId: input.projectId,
            recommendationId: recommendation.id,
            title: input.title,
            description: opened.view.plan.reason,
            sourceType: "LESSON",
            priority: opened.view.plan.priority,
          },
        });
        taskId = created.id;
      }
    }

    if (input.createReminder && input.actionType === "WAIT" && reviewDate) {
      const remindAt = parseWhen(reviewDate);
      if (remindAt && remindAt !== "invalid") {
        const existingReminder = await tx.reminder.findFirst({
          where: {
            projectId: input.projectId,
            type: "REVIEW",
            dismissedAt: null,
            title: input.title,
            remindAt,
          },
        });
        if (existingReminder) {
          reminderId = existingReminder.id;
        } else {
          const created = await tx.reminder.create({
            data: {
              projectId: input.projectId,
              type: "REVIEW",
              title: input.title,
              message: opened.view.plan.reason.slice(0, 280),
              remindAt,
              emailEnabled: false,
            },
          });
          reminderId = created.id;
        }
      }
    }

    const payload = buildNextActionResult({
      projectId: input.projectId,
      campaignDataImportId: input.importId,
      diagnosisResultId: opened.view.diagnosisResultId,
      diagnosis: opened.view.diagnosis,
      context,
      userDecision: { actionType: input.actionType, title: input.title },
      reviewDate,
      taskId,
      reminderId,
      recommendationId,
    });

    const existing = await tx.lessonResult.findFirst({
      where: { userId, lessonId: gate.lessonId, projectId: input.projectId },
      select: { id: true },
    });
    if (existing) {
      await tx.lessonResult.update({ where: { id: existing.id }, data: { payload } });
      if (taskId) await tx.task.updateMany({ where: { id: taskId, lessonResultId: null }, data: { lessonResultId: existing.id } });
    } else {
      const created = await tx.lessonResult.create({
        data: { userId, lessonId: gate.lessonId, projectId: input.projectId, payload },
      });
      if (taskId) await tx.task.update({ where: { id: taskId }, data: { lessonResultId: created.id } });
    }

    await tx.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: gate.lessonId, blockKey } },
      create: { userId, lessonId: gate.lessonId, blockKey, payload: { projectId: input.projectId } },
      update: { payload: { projectId: input.projectId } },
    });
    const now = new Date();
    await tx.lessonBlockProgress.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: gate.lessonId, blockKey } },
      create: { userId, lessonId: gate.lessonId, blockKey, viewedAt: now, completedAt: now },
      update: { completedAt: now },
    });
    return payload;
  });

  const snapshot = await recomputeProgress(userId, gate.lessonId, blockKey);
  const panel = await loadCampaignNextActionPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  logSafe({
    importId: input.importId,
    status: result.readiness,
    durationMs: 0,
    code: coherent ? "SAVED" : "SAVED_OVERRIDE",
  });
  return { ok: true as const, snapshot, panel, view: { ...opened.view, saved: result }, overrideWarned: !coherent };
}

async function buildView(
  userId: string,
  projectId: string,
  importId: string,
  diagnosisRows: Array<{ id: string; projectId: string | null; payload: unknown }> | null,
  savedRows: Array<{ projectId: string | null; payload: unknown }> | null,
): Promise<NextActionView | null> {
  const prisma = getPrisma();
  const rows =
    diagnosisRows ??
    (await prisma.lessonResult.findMany({
      where: { userId, lesson: { slug: LESSON_11_SLUG }, projectId },
      select: { id: true, projectId: true, payload: true },
    }));
  const saved =
    savedRows ??
    (await prisma.lessonResult.findMany({
      where: { userId, lesson: { slug: LESSON_12_SLUG }, projectId },
      select: { projectId: true, payload: true },
    }));

  let diagnosisResultId: string | null = null;
  let diagnosis: CampaignDiagnosisResult | null = null;
  for (const row of rows) {
    const parsed = campaignDiagnosisSchema.safeParse(row.payload);
    if (!parsed.success || row.projectId !== projectId) continue;
    if (parsed.data.campaignDataImportId !== importId) continue;
    diagnosis = parsed.data;
    diagnosisResultId = row.id;
    break;
  }

  if (!diagnosis) {
    const opened = await openCampaignDiagnosisForUser(userId, projectId, importId);
    if (!opened.ok) return null;
    diagnosis = opened.view.result;
  }

  if (diagnosis.projectId !== projectId || diagnosis.campaignDataImportId !== importId) return null;

  const importRow = await prisma.campaignDataImport.findFirst({
    where: { id: importId, projectId, userId, status: "READY", deletedAt: null },
    select: { originalFileName: true },
  });
  if (!importRow) return null;

  const context = await loadContext(userId, projectId);
  const plan = planNextCampaignAction(diagnosis, context);
  const savedPayload = saved.find((row) => row.projectId === projectId)?.payload;
  const parsedSaved = campaignNextActionSchemaSafe(savedPayload);

  return {
    diagnosis,
    diagnosisResultId,
    plan,
    choices: decisionChoices(plan),
    bottleneckLabel: bottleneckStageLabel(diagnosis.primaryBottleneck),
    fileName: importRow.originalFileName ?? "Arquivo",
    observationDays: context.observationDays ?? null,
    saved: parsedSaved,
  };
}

async function loadContext(userId: string, projectId: string) {
  const prisma = getPrisma();
  const [briefLesson, project, completed] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: "objetivo-oferta-orcamento" }, select: { id: true } }),
    prisma.project.findFirst({ where: { id: projectId, userId }, select: { objective: true } }),
    prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: { status: "PUBLISHED" } },
      select: { lesson: { select: { slug: true } } },
    }),
  ]);
  let observationDays: 7 | 14 | 21 | 30 | null = null;
  if (briefLesson) {
    const brief = await prisma.lessonResult.findFirst({
      where: { userId, lessonId: briefLesson.id, projectId },
      select: { payload: true },
    });
    const parsed = campaignBriefSchema.safeParse(brief?.payload);
    observationDays = parsed.success ? parsed.data.initialObservationDays : observationDaysFromBrief(brief?.payload);
  }
  return {
    observationDays,
    objective: project?.objective ?? null,
    completedLessonSlugs: completed.map((row) => row.lesson.slug),
  };
}

async function upsertRecommendation(
  tx: Prisma.TransactionClient,
  input: {
    projectId: string;
    title: string;
    description: string;
    type: ActionType;
    priority: "HIGH" | "MEDIUM" | "LOW";
    lessonSlug: string | null;
  },
) {
  const lesson = input.lessonSlug
    ? await tx.lesson.findFirst({ where: { slug: input.lessonSlug, status: "PUBLISHED" }, select: { id: true } })
    : null;
  const existing = await tx.recommendation.findFirst({
    where: {
      projectId: input.projectId,
      title: input.title,
      type: input.type,
      diagnosticId: null,
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return tx.recommendation.update({
      where: { id: existing.id },
      data: {
        description: input.description.slice(0, 500),
        rationale: "Origem: Aula 12 — plano de próxima ação.",
        priority: input.priority,
        lessonId: lesson?.id ?? null,
      },
    });
  }
  return tx.recommendation.create({
    data: {
      projectId: input.projectId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      description: input.description.slice(0, 500),
      rationale: "Origem: Aula 12 — plano de próxima ação.",
      lessonId: lesson?.id ?? null,
    },
  });
}

async function openLesson(userId: string, slug: string, blockKey?: string) {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug }, select: { id: true, status: true, accessType: true } });
  const entitled = lesson ? await hasActiveEntitlement(userId, lesson.id) : false;
  if (!lesson || !canReadLessonBody(lesson, { entitled })) return { ok: false as const, message: "Esta aula não está aberta para salvar." };
  if (blockKey) {
    const rules = await loadRuleBlocks(lesson.id);
    const block = rules.find((rule) => rule.blockKey === blockKey && !rule.retiredAt && rule.data.type === "TOOL");
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "CAMPAIGN_NEXT_ACTION_PLAN_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}

function campaignNextActionSchemaSafe(payload: unknown): CampaignNextActionResult | null {
  const parsed = campaignNextActionSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function projectIdFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("projectId" in payload)) return null;
  return typeof payload.projectId === "string" ? payload.projectId : null;
}

function logSafe(event: { importId: string; status: string; durationMs: number; code?: string }) {
  console.info(JSON.stringify({ scope: "campaign-next-action", ...event }));
}

export { actionTypeLabel };
