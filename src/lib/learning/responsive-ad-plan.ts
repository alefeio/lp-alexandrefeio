import { lessonToolReturnPath } from "@/lib/auth/messages";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { keywordPlanSchema, type KeywordPlan } from "@/lib/learning/keyword-intent";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { LESSON_07_SLUG } from "@/lib/learning/lesson-07";
import { LESSON_08_SLUG } from "@/lib/learning/lesson-08";
import {
  buildResponsiveAdPrefill,
  parseResponsiveAdForm,
  responsiveAdPlanSchema,
  type ResponsiveAdFormInput,
  type ResponsiveAdPlan,
  type ResponsiveAdPrefill,
} from "@/lib/learning/responsive-search-ad";
import { searchBlueprintSchema, type SearchBlueprint } from "@/lib/learning/search-blueprint";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";

export type ResponsiveAdProjectChoice = {
  id: string;
  name: string;
  prefill: ResponsiveAdPrefill;
  plan: ResponsiveAdPlan | null;
  hasBlueprint: boolean;
  hasKeywordPlan: boolean;
};

export type ResponsiveAdPanel =
  | { mode: "preview"; kind: "ads" }
  | {
      mode: "live";
      kind: "ads";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      lessonSevenHref: string;
      chooseProject: boolean;
      projects: ResponsiveAdProjectChoice[];
      linkedProjectId: string | null;
    };

export function responsiveAdPreviewState(): ResponsiveAdPanel {
  return { mode: "preview", kind: "ads" };
}

export async function loadResponsiveAdPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<ResponsiveAdPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_08_SLUG, "anuncios");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  const lessonSevenHref = `/aulas/${LESSON_07_SLUG}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "ads",
      lessonSlug: LESSON_08_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      lessonSevenHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
    };
  }

  const prisma = getPrisma();
  const [lesson, lessonSix, lessonSeven, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_08_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_06_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_07_SLUG }, select: { id: true } }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, primaryOffer: true },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const [ads, blueprints, keywords, response] = await Promise.all([
    lesson
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lesson.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
    lessonSix
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lessonSix.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
    lessonSeven
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId, lessonId: lessonSeven.id, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [],
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
    kind: "ads",
    lessonSlug: LESSON_08_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    lessonSevenHref,
    chooseProject: projects.length > 1,
    linkedProjectId,
    projects: projects.map((project) => {
      const saved = parseSaved(ads.find((result) => result.projectId === project.id)?.payload);
      const blueprint = parseBlueprint(blueprints.find((result) => result.projectId === project.id)?.payload);
      const keywordPlan = parseKeywords(keywords.find((result) => result.projectId === project.id)?.payload);
      return {
        id: project.id,
        name: project.name,
        prefill: buildResponsiveAdPrefill({ projectOffer: project.primaryOffer ?? "", blueprint, keywordPlan, saved }),
        plan: saved,
        hasBlueprint: Boolean(blueprint),
        hasKeywordPlan: Boolean(keywordPlan),
      };
    }),
  };
}

export async function saveResponsiveAdForUser(userId: string, slug: string, blockKey: string, input: ResponsiveAdFormInput) {
  const gate = await openResponsiveAdLesson(userId, slug, blockKey);
  if (!gate.ok) return gate;
  const project = await getPrisma().project.findFirst({ where: { id: input.projectId, userId } });
  if (!project) return { ok: false as const, message: "Projeto não encontrado." };
  if (project.status !== "ACTIVE") return { ok: false as const, message: "Projeto arquivado não pode receber o plano." };
  const lessonSeven = await getPrisma().lesson.findUnique({ where: { slug: LESSON_07_SLUG }, select: { id: true } });
  const keywordRow = lessonSeven
    ? await getPrisma().lessonResult.findFirst({
        where: { userId, lessonId: lessonSeven.id, projectId: project.id },
        select: { payload: true },
      })
    : null;
  const parsed = parseResponsiveAdForm(input, { keywordPlan: parseKeywords(keywordRow?.payload) });
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
  const panel = await loadResponsiveAdPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

async function openResponsiveAdLesson(userId: string, slug: string, blockKey?: string) {
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
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "RESPONSIVE_SEARCH_AD_PLAN_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}

function parseSaved(payload: unknown): ResponsiveAdPlan | null {
  const parsed = responsiveAdPlanSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function parseBlueprint(payload: unknown): SearchBlueprint | null {
  const parsed = searchBlueprintSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function parseKeywords(payload: unknown): KeywordPlan | null {
  const parsed = keywordPlanSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}
