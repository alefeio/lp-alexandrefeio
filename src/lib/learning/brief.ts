import { lessonToolReturnPath } from "@/lib/auth/messages";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import {
  campaignBriefLinkSchema,
  campaignBriefSchema,
  parseCampaignBriefForm,
  type CampaignBrief,
} from "@/lib/learning/campaign-brief";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { createLessonTaskForUser } from "@/lib/plan/service";

export type CampaignProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  prefill: {
    offer: string;
    objective: string;
    destination: string;
    monthlyBudget: string;
    websiteUrl: string | null;
    serviceArea: string | null;
    averageTicketCents: number | null;
    usesGoogleAds: boolean | null;
    usesMetaAds: boolean | null;
  };
  brief: CampaignBrief | null;
  hasPreparationTask: boolean;
};

export type CampaignBriefPanel =
  | { mode: "preview"; kind: "brief" }
  | {
      mode: "live";
      kind: "brief";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      chooseProject: boolean;
      projects: CampaignProjectChoice[];
      linkedProjectId: string | null;
    };

export function campaignBriefPreviewState(): CampaignBriefPanel {
  return { mode: "preview", kind: "brief" };
}

export async function loadCampaignBriefPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<CampaignBriefPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "CAMPAIGN_BRIEF_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_04_SLUG, "brief");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "brief",
      lessonSlug: LESSON_04_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
    };
  }

  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: LESSON_04_SLUG }, select: { id: true } });
  const projects = await prisma.project.findMany({
    where: { userId: input.userId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      primaryOffer: true,
      objective: true,
      destinationType: true,
      monthlyMediaBudgetCents: true,
      averageTicketCents: true,
      websiteUrl: true,
      serviceArea: true,
      usesGoogleAds: true,
      usesMetaAds: true,
    },
  });
  const results = lesson
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson.id, projectId: { in: projects.map((project) => project.id) } },
        select: { id: true, projectId: true, payload: true },
      })
    : [];
  const tasks = results.length
    ? await prisma.task.findMany({
        where: { lessonResultId: { in: results.map((result) => result.id) }, sourceType: "LESSON", status: { in: ["TODO", "IN_PROGRESS"] } },
        select: { lessonResultId: true },
      })
    : [];
  const openTasks = new Set(tasks.map((task) => task.lessonResultId));
  const response = lesson
    ? await prisma.lessonResponse.findUnique({
        where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
        select: { payload: true },
      })
    : null;
  const linked = campaignBriefLinkSchema.safeParse(response?.payload);

  return {
    mode: "live",
    kind: "brief",
    lessonSlug: LESSON_04_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    chooseProject: projects.length > 1,
    linkedProjectId: linked.success ? linked.data.projectId : null,
    projects: projects.map((project) => {
      const stored = results.find((result) => result.projectId === project.id);
      const brief = stored ? campaignBriefSchema.safeParse(stored.payload) : null;
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        prefill: {
          offer: project.primaryOffer ?? "",
          objective: project.objective ?? "",
          destination: project.destinationType ?? "",
          monthlyBudget: project.monthlyMediaBudgetCents != null ? centsToInput(project.monthlyMediaBudgetCents) : "",
          websiteUrl: project.websiteUrl,
          serviceArea: project.serviceArea,
          averageTicketCents: project.averageTicketCents,
          usesGoogleAds: project.usesGoogleAds,
          usesMetaAds: project.usesMetaAds,
        },
        brief: brief?.success ? brief.data : null,
        hasPreparationTask: Boolean(stored && openTasks.has(stored.id)),
      };
    }),
  };
}

export async function saveCampaignBriefForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    projectId: string;
    offer: string;
    objective: string;
    primaryConversion: string;
    destination: string;
    monthlyBudget: string;
    initialObservationDays: number;
    validationBeforeLaunch: string;
  },
) {
  const parsed = parseCampaignBriefForm(input);
  if (!parsed.ok) return parsed;
  const gate = await openBriefLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const project = await getPrisma().project.findFirst({ where: { id: parsed.projectId, userId } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não pode receber o brief." };

  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.lessonResult.findFirst({
      where: { userId, lessonId: gate.lessonId, projectId: project.id },
      select: { id: true },
    });
    if (existing) {
      await tx.lessonResult.update({ where: { id: existing.id }, data: { payload: parsed.brief } });
    } else {
      await tx.lessonResult.create({
        data: { userId, lessonId: gate.lessonId, projectId: project.id, payload: parsed.brief },
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
  const panel = await loadCampaignBriefPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

export async function syncCampaignBriefProject(userId: string, slug: string, projectId: string) {
  const gate = await openBriefLesson(userId, slug);
  if (!gate.ok) return gate;
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({ where: { id: projectId, userId, status: "ACTIVE" } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  const result = await prisma.lessonResult.findFirst({
    where: { userId, lessonId: gate.lessonId, projectId: project.id },
  });
  const brief = campaignBriefSchema.safeParse(result?.payload);
  if (!result || !brief.success) return { ok: false as const, message: "Salve o brief antes de atualizar o projeto." };

  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: {
        primaryOffer: brief.data.offer,
        objective: brief.data.objective,
        destinationType: brief.data.destination,
        monthlyMediaBudgetCents: brief.data.monthlyBudgetCents,
      },
    }),
    prisma.lessonResult.update({ where: { id: result.id }, data: { payload: brief.data } }),
  ]);
  const panel = await loadCampaignBriefPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, panel };
}

export async function addCampaignPreparationTask(userId: string, slug: string, projectId: string) {
  const gate = await openBriefLesson(userId, slug);
  if (!gate.ok) return gate;
  const result = await getPrisma().lessonResult.findFirst({
    where: { userId, lessonId: gate.lessonId, projectId },
  });
  const brief = campaignBriefSchema.safeParse(result?.payload);
  if (!result || !brief.success) return { ok: false as const, message: "Salve o brief antes de adicionar ao plano." };
  const existing = await getPrisma().task.findFirst({
    where: { lessonResultId: result.id, sourceType: "LESSON", status: { in: ["TODO", "IN_PROGRESS"] } },
    select: { id: true },
  });
  if (existing) return { ok: true as const, already: true };
  const title = `Preparar campanha: ${brief.data.offer}`.slice(0, 140);
  const created = await createLessonTaskForUser(userId, projectId, result.id, title);
  if (!created.ok) return created;
  return { ok: true as const, already: false };
}

async function openBriefLesson(userId: string, slug: string, blockKey?: string) {
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
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "CAMPAIGN_BRIEF_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}

function centsToInput(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  if (fraction === 0) return String(whole);
  return `${whole},${String(fraction).padStart(2, "0")}`;
}
