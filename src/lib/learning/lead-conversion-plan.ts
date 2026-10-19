import { lessonToolReturnPath } from "@/lib/auth/messages";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { DIAGNOSTIC_VERSION } from "@/lib/diagnostic/definition";
import { resultSnapshotSchema } from "@/lib/diagnostic/score";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import { campaignBriefSchema, type CampaignBrief } from "@/lib/learning/campaign-brief";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { destinationPlanSchema, type DestinationPlan } from "@/lib/learning/destination-plan";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_09_SLUG } from "@/lib/learning/lesson-09";
import { LESSON_10_SLUG, LESSON_11_SLUG } from "@/lib/learning/lesson-10";
import {
  buildLeadConversionPrefill,
  leadConversionPlanSchema,
  parseLeadConversionForm,
  type LeadConversionFormInput,
  type LeadConversionPlan,
  type LeadConversionPrefill,
} from "@/lib/learning/lead-conversion";
import { metaCampaignPlanSchema, type ChannelHintName, type MetaCampaignPlan } from "@/lib/learning/meta-campaign";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";

export type LeadConversionProjectChoice = {
  id: string;
  name: string;
  prefill: LeadConversionPrefill;
  plan: LeadConversionPlan | null;
};

export type LeadConversionPanel =
  | { mode: "preview"; kind: "leads" }
  | {
      mode: "live";
      kind: "leads";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      lessonElevenHref: string;
      lessonElevenReady: boolean;
      chooseProject: boolean;
      projects: LeadConversionProjectChoice[];
      linkedProjectId: string | null;
    };

export function leadConversionPreviewState(): LeadConversionPanel {
  return { mode: "preview", kind: "leads" };
}

export async function loadLeadConversionPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<LeadConversionPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "META_LEAD_CONVERSION_PLAN_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_10_SLUG, "leads");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  const lessonElevenHref = `/aulas/${LESSON_11_SLUG}`;
  if (!input.userId) return emptyLive(tool.blockKey, createProjectHref, lessonElevenHref, false);

  const prisma = getPrisma();
  const [lesson, lessonFour, lessonFive, lessonNine, lessonEleven, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_10_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_04_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_05_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_09_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({
      where: { slug: LESSON_11_SLUG },
      select: { blocks: { where: { retiredAt: null, isPublicPreview: true }, select: { id: true } } },
    }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, primaryOffer: true },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const [plans, briefs, destinations, blueprints, diagnostics, response] = await Promise.all([
    lesson
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lesson.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
    lessonFour
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lessonFour.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
    lessonFive
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lessonFive.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
    lessonNine
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lessonNine.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
    prisma.diagnostic.findMany({
      where: { userId: input.userId, projectId: { in: projectIds }, version: DIAGNOSTIC_VERSION, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { projectId: true, resultSnapshot: true },
    }),
    lesson
      ? prisma.lessonResponse.findUnique({
          where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
          select: { payload: true },
        })
      : null,
  ]);
  const linkedProjectId =
    response?.payload && typeof response.payload === "object" && response.payload !== null && "projectId" in response.payload
      ? String(response.payload.projectId)
      : null;

  return {
    mode: "live",
    kind: "leads",
    lessonSlug: LESSON_10_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    lessonElevenHref,
    lessonElevenReady: (lessonEleven?.blocks.length ?? 0) > 0,
    chooseProject: projects.length > 1,
    linkedProjectId,
    projects: projects.map((project) => {
      const snapshot = diagnostics.find((item) => item.projectId === project.id)?.resultSnapshot;
      return {
        id: project.id,
        name: project.name,
        prefill: buildLeadConversionPrefill({
          projectOffer: project.primaryOffer ?? "",
          brief: parseBrief(briefs.find((result) => result.projectId === project.id)?.payload),
          destination: parseDestination(destinations.find((result) => result.projectId === project.id)?.payload),
          blueprint: parseBlueprint(blueprints.find((result) => result.projectId === project.id)?.payload),
          channelHint: channelFrom(snapshot),
          operationsAttention: operationsAttention(snapshot),
          saved: parseSaved(plans.find((result) => result.projectId === project.id)?.payload),
        }),
        plan: parseSaved(plans.find((result) => result.projectId === project.id)?.payload),
      };
    }),
  };
}

function emptyLive(blockKey: string, createProjectHref: string, lessonElevenHref: string, lessonElevenReady: boolean): LeadConversionPanel {
  return {
    mode: "live",
    kind: "leads",
    lessonSlug: LESSON_10_SLUG,
    blockKey,
    authenticated: false,
    createProjectHref,
    lessonElevenHref,
    lessonElevenReady,
    chooseProject: false,
    projects: [],
    linkedProjectId: null,
  };
}

export async function saveLeadConversionForUser(userId: string, slug: string, blockKey: string, input: LeadConversionFormInput) {
  const gate = await openLeadLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const project = await getPrisma().project.findFirst({ where: { id: input.projectId, userId } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não pode receber o plano." };
  const parsed = parseLeadConversionForm(input);
  if (!parsed.ok) return parsed;

  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.lessonResult.findFirst({
      where: { userId, lessonId: gate.lessonId, projectId: project.id },
      select: { id: true },
    });
    if (existing) {
      await tx.lessonResult.update({ where: { id: existing.id }, data: { payload: parsed.plan } });
    } else {
      await tx.lessonResult.create({
        data: { userId, lessonId: gate.lessonId, projectId: project.id, payload: parsed.plan },
      });
    }
    await tx.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: gate.lessonId, blockKey } },
      create: { userId, lessonId: gate.lessonId, blockKey, payload: { projectId: project.id } },
      update: { payload: { projectId: project.id } },
    });
    const now = new Date();
    await tx.lessonBlockProgress.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: gate.lessonId, blockKey } },
      create: { userId, lessonId: gate.lessonId, blockKey, viewedAt: now, completedAt: now },
      update: { completedAt: now },
    });
  });

  const snapshot = await recomputeProgress(userId, gate.lessonId, blockKey);
  const panel = await loadLeadConversionPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

async function openLeadLesson(userId: string, slug: string, blockKey?: string) {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  const entitled = lesson ? await hasActiveEntitlement(userId, lesson.id) : false;
  if (!lesson || !canReadLessonBody(lesson, { entitled })) {
    return { ok: false as const, message: "Esta aula não está aberta para salvar." };
  }
  if (blockKey) {
    const rules = await loadRuleBlocks(lesson.id);
    const block = rules.find((rule) => rule.blockKey === blockKey && !rule.retiredAt && rule.data.type === "TOOL");
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "META_LEAD_CONVERSION_PLAN_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}

function parseSaved(payload: unknown): LeadConversionPlan | null {
  const parsed = leadConversionPlanSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function parseBrief(payload: unknown): CampaignBrief | null {
  const parsed = campaignBriefSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function parseDestination(payload: unknown): DestinationPlan | null {
  const parsed = destinationPlanSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function parseBlueprint(payload: unknown): MetaCampaignPlan | null {
  const parsed = metaCampaignPlanSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function channelFrom(payload: unknown): ChannelHintName | null {
  const parsed = resultSnapshotSchema.safeParse(payload);
  return parsed.success ? parsed.data.channelHint : null;
}

function operationsAttention(payload: unknown): boolean {
  const parsed = resultSnapshotSchema.safeParse(payload);
  if (!parsed.success) return false;
  return parsed.data.primaryBottleneck === "OPERATIONS" || parsed.data.dimensionScores.OPERATIONS < 50;
}
