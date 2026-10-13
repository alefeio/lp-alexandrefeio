import { lessonToolReturnPath } from "@/lib/auth/messages";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { resultSnapshotSchema } from "@/lib/diagnostic/score";
import { canReadLessonBody } from "@/lib/learning/access";
import { campaignBriefLinkSchema, campaignBriefSchema } from "@/lib/learning/campaign-brief";
import {
  GOOGLE_LESSON_SLUG,
  META_LESSON_SLUG,
  destinationPlanSchema,
  parseDestinationPlanForm,
  type ChannelHint,
  type DestinationPlan,
} from "@/lib/learning/destination-plan";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { createLessonTaskForUser } from "@/lib/plan/service";

export type MeasurementProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  prefill: {
    destinationType: string;
    destinationUrl: string;
    primaryConversion: string;
  };
  brief: {
    offer: string;
    objective: string;
    monthlyBudgetCents: number;
    initialObservationDays: number;
    destination: string;
    primaryConversion: string;
  } | null;
  plan: DestinationPlan | null;
  hasPreparationTask: boolean;
  channelHint: ChannelHint | null;
};

export type DestinationPlanPanel =
  | { mode: "preview"; kind: "destination" }
  | {
      mode: "live";
      kind: "destination";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      lessonFourHref: string;
      chooseProject: boolean;
      projects: MeasurementProjectChoice[];
      linkedProjectId: string | null;
      nextLessons: { slug: string; title: string }[];
    };

export function destinationPlanPreviewState(): DestinationPlanPanel {
  return { mode: "preview", kind: "destination" };
}

export async function loadDestinationPlanPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<DestinationPlanPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "DESTINATION_MEASUREMENT_PLAN_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_05_SLUG, "destino");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  const lessonFourHref = `/aulas/${LESSON_04_SLUG}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "destination",
      lessonSlug: LESSON_05_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      lessonFourHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
      nextLessons: [],
    };
  }

  const prisma = getPrisma();
  const [lesson, lessonFour, projects, nextLessons] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_05_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_04_SLUG }, select: { id: true } }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, destinationType: true, websiteUrl: true },
    }),
    prisma.lesson.findMany({
      where: { slug: { in: [GOOGLE_LESSON_SLUG, META_LESSON_SLUG] } },
      select: { slug: true, title: true },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const results = lesson
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson.id, projectId: { in: projectIds } },
        select: { id: true, projectId: true, payload: true },
      })
    : [];
  const briefs = lessonFour
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lessonFour.id, projectId: { in: projectIds } },
        select: { projectId: true, payload: true },
      })
    : [];
  const diagnostics = projectIds.length
    ? await prisma.diagnostic.findMany({
        where: { userId: input.userId, projectId: { in: projectIds }, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { projectId: true, resultSnapshot: true },
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
  const hintByProject = new Map<string, ChannelHint>();
  for (const diagnostic of diagnostics) {
    if (hintByProject.has(diagnostic.projectId)) continue;
    const snapshot = resultSnapshotSchema.safeParse(diagnostic.resultSnapshot);
    if (snapshot.success) hintByProject.set(diagnostic.projectId, snapshot.data.channelHint);
  }

  return {
    mode: "live",
    kind: "destination",
    lessonSlug: LESSON_05_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    lessonFourHref,
    chooseProject: projects.length > 1,
    linkedProjectId: linked.success ? linked.data.projectId : null,
    nextLessons,
    projects: projects.map((project) => {
      const stored = results.find((result) => result.projectId === project.id);
      const plan = stored ? destinationPlanSchema.safeParse(stored.payload) : null;
      const briefRow = briefs.find((result) => result.projectId === project.id);
      const brief = briefRow ? campaignBriefSchema.safeParse(briefRow.payload) : null;
      const saved = plan?.success ? plan.data : null;
      const knownBrief = brief?.success ? brief.data : null;
      const destinationType = saved?.destinationType ?? knownBrief?.destination ?? project.destinationType ?? "";
      const destinationUrl = saved
        ? (saved.destinationUrl ?? "")
        : destinationType === "LANDING_PAGE" || destinationType === "WEBSITE"
          ? (project.websiteUrl ?? "")
          : "";
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        prefill: {
          destinationType,
          destinationUrl,
          primaryConversion: saved?.primaryConversion ?? knownBrief?.primaryConversion ?? "",
        },
        brief: knownBrief
          ? {
              offer: knownBrief.offer,
              objective: knownBrief.objective,
              monthlyBudgetCents: knownBrief.monthlyBudgetCents,
              initialObservationDays: knownBrief.initialObservationDays,
              destination: knownBrief.destination,
              primaryConversion: knownBrief.primaryConversion,
            }
          : null,
        plan: saved,
        hasPreparationTask: Boolean(stored && openTasks.has(stored.id)),
        channelHint: hintByProject.get(project.id) ?? null,
      };
    }),
  };
}

export async function saveDestinationPlanForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    projectId: string;
    destinationType: string;
    destinationUrl: string;
    primaryCta: string;
    primaryConversion: string;
    offerIsClear: boolean;
    ctaIsVisible: boolean;
    mobileChecked: boolean;
    conversionPathTested: boolean;
    trafficSourceMethod: string;
    platformConversionStatus: string;
    analyticsStatus: string;
    businessOutcomeMethod: string;
    preLaunchIssue: string;
  },
) {
  const parsed = parseDestinationPlanForm(input);
  if (!parsed.ok) return parsed;
  const gate = await openPlanLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const project = await getPrisma().project.findFirst({ where: { id: parsed.projectId, userId } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não pode receber o plano." };

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
  const panel = await loadDestinationPlanPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

export async function syncDestinationPlanProject(userId: string, slug: string, projectId: string) {
  const gate = await openPlanLesson(userId, slug);
  if (!gate.ok) return gate;
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({ where: { id: projectId, userId, status: "ACTIVE" } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  const result = await prisma.lessonResult.findFirst({
    where: { userId, lessonId: gate.lessonId, projectId: project.id },
  });
  const plan = destinationPlanSchema.safeParse(result?.payload);
  if (!result || !plan.success) return { ok: false as const, message: "Salve o plano antes de atualizar o projeto." };
  const website =
    plan.data.destinationUrl && (plan.data.destinationType === "LANDING_PAGE" || plan.data.destinationType === "WEBSITE")
      ? plan.data.destinationUrl
      : undefined;

  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: {
        destinationType: plan.data.destinationType,
        ...(website ? { websiteUrl: website } : {}),
      },
    }),
    prisma.lessonResult.update({ where: { id: result.id }, data: { payload: plan.data } }),
  ]);
  const panel = await loadDestinationPlanPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, panel };
}

export async function addDestinationPreparationTask(userId: string, slug: string, projectId: string) {
  const gate = await openPlanLesson(userId, slug);
  if (!gate.ok) return gate;
  const result = await getPrisma().lessonResult.findFirst({
    where: { userId, lessonId: gate.lessonId, projectId },
  });
  const plan = destinationPlanSchema.safeParse(result?.payload);
  if (!result || !plan.success) return { ok: false as const, message: "Salve o plano antes de adicionar ao plano de ações." };
  if (plan.data.readinessStatus !== "NEEDS_PREPARATION") {
    return { ok: false as const, message: "Este plano não tem pendência para virar uma tarefa." };
  }
  const existing = await getPrisma().task.findFirst({
    where: { lessonResultId: result.id, sourceType: "LESSON", status: { in: ["TODO", "IN_PROGRESS"] } },
    select: { id: true },
  });
  if (existing) return { ok: true as const, already: true };
  const created = await createLessonTaskForUser(userId, projectId, result.id, "Corrigir destino e mensuração antes da campanha");
  if (!created.ok) return created;
  return { ok: true as const, already: false };
}

async function openPlanLesson(userId: string, slug: string, blockKey?: string) {
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
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "DESTINATION_MEASUREMENT_PLAN_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}
