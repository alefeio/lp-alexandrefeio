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
import { LESSON_09_SLUG, LESSON_10_SLUG } from "@/lib/learning/lesson-09";
import {
  buildMetaCampaignPrefill,
  measurementFromDestination,
  metaCampaignPlanSchema,
  parseMetaCampaignForm,
  type ChannelHintName,
  type MetaCampaignFormInput,
  type MetaCampaignPlan,
  type MetaCampaignPrefill,
} from "@/lib/learning/meta-campaign";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";

export type MetaCampaignProjectChoice = {
  id: string;
  name: string;
  prefill: MetaCampaignPrefill;
  plan: MetaCampaignPlan | null;
};

export type MetaCampaignPanel =
  | { mode: "preview"; kind: "meta" }
  | {
      mode: "live";
      kind: "meta";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      lessonTenHref: string;
      lessonTenReady: boolean;
      chooseProject: boolean;
      projects: MetaCampaignProjectChoice[];
      linkedProjectId: string | null;
    };

export function metaCampaignPreviewState(): MetaCampaignPanel {
  return { mode: "preview", kind: "meta" };
}

export async function loadMetaCampaignPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<MetaCampaignPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "META_CAMPAIGN_BLUEPRINT_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_09_SLUG, "meta");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  const lessonTenHref = `/aulas/${LESSON_10_SLUG}`;
  if (!input.userId) {
    return emptyLive(tool.blockKey, createProjectHref, lessonTenHref, false);
  }

  const prisma = getPrisma();
  const [lesson, lessonFour, lessonFive, lessonTen, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_09_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_04_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_05_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({
      where: { slug: LESSON_10_SLUG },
      select: { blocks: { where: { retiredAt: null, isPublicPreview: true }, select: { id: true } } },
    }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, primaryOffer: true, serviceArea: true },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const [plans, briefs, destinations, diagnostics, response] = await Promise.all([
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
    kind: "meta",
    lessonSlug: LESSON_09_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    lessonTenHref,
    lessonTenReady: (lessonTen?.blocks.length ?? 0) > 0,
    chooseProject: projects.length > 1,
    linkedProjectId,
    projects: projects.map((project) => {
      const saved = parseSaved(plans.find((result) => result.projectId === project.id)?.payload);
      const brief = parseBrief(briefs.find((result) => result.projectId === project.id)?.payload);
      const destination = parseDestination(destinations.find((result) => result.projectId === project.id)?.payload);
      const channelHint = channelFrom(diagnostics.find((item) => item.projectId === project.id)?.resultSnapshot);
      return {
        id: project.id,
        name: project.name,
        prefill: buildMetaCampaignPrefill({
          projectOffer: project.primaryOffer ?? "",
          projectArea: project.serviceArea,
          brief,
          destination,
          channelHint,
          saved,
        }),
        plan: saved,
      };
    }),
  };
}

function emptyLive(blockKey: string, createProjectHref: string, lessonTenHref: string, lessonTenReady: boolean): MetaCampaignPanel {
  return {
    mode: "live",
    kind: "meta",
    lessonSlug: LESSON_09_SLUG,
    blockKey,
    authenticated: false,
    createProjectHref,
    lessonTenHref,
    lessonTenReady,
    chooseProject: false,
    projects: [],
    linkedProjectId: null,
  };
}

export async function saveMetaCampaignForUser(userId: string, slug: string, blockKey: string, input: MetaCampaignFormInput) {
  const gate = await openMetaLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const project = await getPrisma().project.findFirst({ where: { id: input.projectId, userId } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não pode receber o plano." };
  const lessonFive = await getPrisma().lesson.findUnique({ where: { slug: LESSON_05_SLUG }, select: { id: true } });
  const destinationRow = lessonFive
    ? await getPrisma().lessonResult.findFirst({
        where: { userId, lessonId: lessonFive.id, projectId: project.id },
        select: { payload: true },
      })
    : null;
  const destination = parseDestination(destinationRow?.payload);
  const parsed = parseMetaCampaignForm(input, { measurementReadiness: measurementFromDestination(destination) });
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
  const panel = await loadMetaCampaignPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

async function openMetaLesson(userId: string, slug: string, blockKey?: string) {
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
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "META_CAMPAIGN_BLUEPRINT_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}

function parseSaved(payload: unknown): MetaCampaignPlan | null {
  const parsed = metaCampaignPlanSchema.safeParse(payload);
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

function channelFrom(payload: unknown): ChannelHintName | null {
  const parsed = resultSnapshotSchema.safeParse(payload);
  return parsed.success ? parsed.data.channelHint : null;
}
