import { lessonToolReturnPath } from "@/lib/auth/messages";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { resultSnapshotSchema } from "@/lib/diagnostic/score";
import { canReadLessonBody } from "@/lib/learning/access";
import { campaignBriefSchema, centsToReaisInput } from "@/lib/learning/campaign-brief";
import { destinationPlanSchema, type ChannelHint } from "@/lib/learning/destination-plan";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import {
  KEYWORDS_LESSON_SLUG,
  parseSearchBlueprintForm,
  searchBlueprintSchema,
  type SearchAdGroup,
  type SearchBlueprint,
  type SearchBlueprintFormInput,
} from "@/lib/learning/search-blueprint";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";

export type BlueprintProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  prefill: {
    campaignName: string;
    offer: string;
    businessObjective: string;
    primaryConversion: string;
    destinationType: string;
    destinationUrl: string;
    locationPlan: string;
    languagePlan: string;
    monthlyBudget: string;
    optimizationFocus: string;
    brandStrategy: string;
    searchPartnersDecision: string;
    adGroups: SearchAdGroup[];
    preLaunchIssue: string;
  };
  hasBrief: boolean;
  hasDestinationPlan: boolean;
  destinationNeedsPreparation: boolean;
  conversionSignalReady: boolean;
  channelHint: ChannelHint | null;
  blueprint: SearchBlueprint | null;
};

export type SearchBlueprintPanel =
  | { mode: "preview"; kind: "blueprint" }
  | {
      mode: "live";
      kind: "blueprint";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      lessonFourHref: string;
      lessonFiveHref: string;
      keywordsHref: string;
      keywordsTitle: string;
      chooseProject: boolean;
      projects: BlueprintProjectChoice[];
      linkedProjectId: string | null;
    };

export function searchBlueprintPreviewState(): SearchBlueprintPanel {
  return { mode: "preview", kind: "blueprint" };
}

export async function loadSearchBlueprintPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<SearchBlueprintPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_06_SLUG, "blueprint");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  const lessonFourHref = `/aulas/${LESSON_04_SLUG}`;
  const lessonFiveHref = `/aulas/${LESSON_05_SLUG}`;
  const keywordsHref = `/aulas/${KEYWORDS_LESSON_SLUG}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "blueprint",
      lessonSlug: LESSON_06_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      lessonFourHref,
      lessonFiveHref,
      keywordsHref,
      keywordsTitle: "Escolha palavras-chave com intenção de compra",
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
    };
  }

  const prisma = getPrisma();
  const [lesson, lessonFour, lessonFive, keywords, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_06_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_04_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_05_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: KEYWORDS_LESSON_SLUG }, select: { title: true } }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        primaryOffer: true,
        objective: true,
        destinationType: true,
        websiteUrl: true,
        serviceArea: true,
        monthlyMediaBudgetCents: true,
      },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const [blueprints, briefs, plans, diagnostics, response] = await Promise.all([
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
    projectIds.length
      ? prisma.diagnostic.findMany({
          where: { userId: input.userId, projectId: { in: projectIds }, status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          select: { projectId: true, resultSnapshot: true },
        })
      : [],
    lesson
      ? prisma.lessonResponse.findUnique({
          where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
          select: { payload: true },
        })
      : null,
  ]);
  const hintByProject = new Map<string, ChannelHint>();
  for (const diagnostic of diagnostics) {
    if (hintByProject.has(diagnostic.projectId)) continue;
    const snapshot = resultSnapshotSchema.safeParse(diagnostic.resultSnapshot);
    if (snapshot.success) hintByProject.set(diagnostic.projectId, snapshot.data.channelHint);
  }
  const linkedProjectId =
    response?.payload && typeof response.payload === "object" && response.payload !== null && "projectId" in response.payload
      ? String(response.payload.projectId)
      : null;

  return {
    mode: "live",
    kind: "blueprint",
    lessonSlug: LESSON_06_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    lessonFourHref,
    lessonFiveHref,
    keywordsHref,
    keywordsTitle: keywords?.title ?? "Escolha palavras-chave com intenção de compra",
    chooseProject: projects.length > 1,
    linkedProjectId,
    projects: projects.map((project) => {
      const stored = blueprints.find((result) => result.projectId === project.id);
      const blueprint = stored ? searchBlueprintSchema.safeParse(stored.payload) : null;
      const saved = blueprint?.success ? blueprint.data : null;
      const briefRow = briefs.find((result) => result.projectId === project.id);
      const briefParsed = briefRow ? campaignBriefSchema.safeParse(briefRow.payload) : null;
      const brief = briefParsed?.success ? briefParsed.data : null;
      const planRow = plans.find((result) => result.projectId === project.id);
      const planParsed = planRow ? destinationPlanSchema.safeParse(planRow.payload) : null;
      const plan = planParsed?.success ? planParsed.data : null;
      const destinationType = saved?.destinationType ?? plan?.destinationType ?? brief?.destination ?? project.destinationType ?? "";
      const offer = saved?.offer ?? brief?.offer ?? project.primaryOffer ?? "";
      const monthlyCents = saved
        ? (saved.monthlyBudgetCents ?? null)
        : (brief?.monthlyBudgetCents ?? project.monthlyMediaBudgetCents ?? null);
      const blankGroup: SearchAdGroup = { name: "", theme: "", intent: "" };
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        prefill: {
          campaignName: saved?.campaignName ?? (offer ? `Pesquisa | ${offer}`.slice(0, 120) : ""),
          offer,
          businessObjective: saved?.businessObjective ?? brief?.objective ?? project.objective ?? "",
          primaryConversion: saved?.primaryConversion ?? plan?.primaryConversion ?? brief?.primaryConversion ?? "",
          destinationType,
          destinationUrl: saved
            ? (saved.destinationUrl ?? "")
            : (plan?.destinationUrl ??
              (destinationType === "LANDING_PAGE" || destinationType === "WEBSITE" ? (project.websiteUrl ?? "") : "")),
          locationPlan: saved?.locationPlan ?? project.serviceArea ?? "",
          languagePlan: saved?.languagePlan ?? "",
          monthlyBudget: monthlyCents == null ? "" : centsToReaisInput(monthlyCents),
          optimizationFocus: saved?.optimizationFocus ?? "",
          brandStrategy: saved?.brandStrategy ?? "",
          searchPartnersDecision: saved?.searchPartnersDecision ?? "",
          adGroups: saved?.adGroups.length ? saved.adGroups : [blankGroup],
          preLaunchIssue: saved?.preLaunchIssue ?? "",
        },
        hasBrief: Boolean(brief),
        hasDestinationPlan: Boolean(plan),
        destinationNeedsPreparation: plan?.readinessStatus === "NEEDS_PREPARATION",
        conversionSignalReady: plan?.readinessStatus === "READY_TO_CONFIGURE" && plan.platformConversionStatus === "CONFIGURED",
        channelHint: hintByProject.get(project.id) ?? null,
        blueprint: saved,
      };
    }),
  };
}

export async function saveSearchBlueprintForUser(userId: string, slug: string, blockKey: string, input: SearchBlueprintFormInput) {
  const parsed = parseSearchBlueprintForm(input);
  if (!parsed.ok) return parsed;
  const gate = await openBlueprintLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const project = await getPrisma().project.findFirst({ where: { id: parsed.projectId, userId } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não pode receber o Blueprint." };

  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.lessonResult.findFirst({
      where: { userId, lessonId: gate.lessonId, projectId: project.id },
      select: { id: true },
    });
    if (existing) {
      await tx.lessonResult.update({ where: { id: existing.id }, data: { payload: parsed.blueprint } });
    } else {
      await tx.lessonResult.create({
        data: { userId, lessonId: gate.lessonId, projectId: project.id, payload: parsed.blueprint },
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
  const panel = await loadSearchBlueprintPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

export async function syncSearchBlueprintProject(userId: string, slug: string, projectId: string) {
  const gate = await openBlueprintLesson(userId, slug);
  if (!gate.ok) return gate;
  const prisma = getPrisma();
  const project = await prisma.project.findFirst({ where: { id: projectId, userId, status: "ACTIVE" } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  const result = await prisma.lessonResult.findFirst({
    where: { userId, lessonId: gate.lessonId, projectId: project.id },
  });
  const blueprint = searchBlueprintSchema.safeParse(result?.payload);
  if (!result || !blueprint.success) return { ok: false as const, message: "Salve o Blueprint antes de atualizar o projeto." };
  const data = blueprint.data;
  const website =
    data.destinationUrl && (data.destinationType === "LANDING_PAGE" || data.destinationType === "WEBSITE")
      ? data.destinationUrl
      : undefined;
  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: {
        ...(data.offer.length <= 160 ? { primaryOffer: data.offer } : {}),
        ...(data.businessObjective !== "UNDEFINED" ? { objective: data.businessObjective } : {}),
        destinationType: data.destinationType,
        ...(website ? { websiteUrl: website } : {}),
        ...(data.monthlyBudgetCents != null ? { monthlyMediaBudgetCents: data.monthlyBudgetCents } : {}),
        ...(data.locationPlan.length <= 160 ? { serviceArea: data.locationPlan } : {}),
      },
    }),
    prisma.lessonResult.update({ where: { id: result.id }, data: { payload: data } }),
  ]);
  const panel = await loadSearchBlueprintPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, panel };
}

async function openBlueprintLesson(userId: string, slug: string, blockKey?: string) {
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
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "SEARCH_CAMPAIGN_BLUEPRINT_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}
