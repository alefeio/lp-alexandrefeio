import { lessonToolReturnPath } from "@/lib/auth/messages";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import {
  buildKeywordPrefill,
  keywordPlanSchema,
  parseKeywordPlanForm,
  type KeywordPlan,
  type KeywordPlanFormInput,
  type KeywordPrefill,
} from "@/lib/learning/keyword-intent";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { LESSON_07_SLUG, LESSON_08_SLUG } from "@/lib/learning/lesson-07";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import { searchBlueprintSchema, type SearchBlueprint } from "@/lib/learning/search-blueprint";

export type KeywordProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  prefill: KeywordPrefill;
  plan: KeywordPlan | null;
  hasBlueprint: boolean;
};

export type KeywordIntentPanel =
  | { mode: "preview"; kind: "keywords" }
  | {
      mode: "live";
      kind: "keywords";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      lessonSixHref: string;
      adsLessonReady: boolean;
      adsLessonHref: string;
      chooseProject: boolean;
      projects: KeywordProjectChoice[];
      linkedProjectId: string | null;
    };

export function keywordIntentPreviewState(): KeywordIntentPanel {
  return { mode: "preview", kind: "keywords" };
}

export async function loadKeywordIntentPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<KeywordIntentPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "KEYWORD_INTENT_PLAN_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_07_SLUG, "palavras");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  const lessonSixHref = `/aulas/${LESSON_06_SLUG}`;
  const adsLessonHref = `/aulas/${LESSON_08_SLUG}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "keywords",
      lessonSlug: LESSON_07_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      lessonSixHref,
      adsLessonReady: false,
      adsLessonHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
    };
  }

  const prisma = getPrisma();
  const [lesson, lessonSix, lessonEight, projects] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: LESSON_07_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_06_SLUG }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: LESSON_08_SLUG }, select: { id: true } }),
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, primaryOffer: true },
    }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const [plans, blueprints, response, adsPreview] = await Promise.all([
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
    lesson
      ? prisma.lessonResponse.findUnique({
          where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
          select: { payload: true },
        })
      : null,
    lessonEight
      ? prisma.lessonBlock.count({
          where: { lessonId: lessonEight.id, retiredAt: null, isPublicPreview: true },
        })
      : 0,
  ]);
  const linkedProjectId =
    response?.payload && typeof response.payload === "object" && response.payload !== null && "projectId" in response.payload
      ? String(response.payload.projectId)
      : null;

  return {
    mode: "live",
    kind: "keywords",
    lessonSlug: LESSON_07_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    lessonSixHref,
    adsLessonReady: adsPreview > 0,
    adsLessonHref,
    chooseProject: projects.length > 1,
    linkedProjectId,
    projects: projects.map((project) => {
      const savedRow = plans.find((result) => result.projectId === project.id);
      const savedParsed = savedRow ? keywordPlanSchema.safeParse(savedRow.payload) : null;
      const saved = savedParsed?.success ? savedParsed.data : null;
      const blueprintRow = blueprints.find((result) => result.projectId === project.id);
      const blueprintParsed = blueprintRow ? searchBlueprintSchema.safeParse(blueprintRow.payload) : null;
      const blueprint: SearchBlueprint | null = blueprintParsed?.success ? blueprintParsed.data : null;
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        prefill: buildKeywordPrefill({ projectOffer: project.primaryOffer ?? "", blueprint, saved }),
        plan: saved,
        hasBlueprint: Boolean(blueprint),
      };
    }),
  };
}

export async function saveKeywordIntentForUser(userId: string, slug: string, blockKey: string, input: KeywordPlanFormInput) {
  const parsed = parseKeywordPlanForm(input);
  if (!parsed.ok) return parsed;
  const gate = await openKeywordLesson(userId, slug, blockKey);
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
  const panel = await loadKeywordIntentPanel({ userId, blocks: await loadRuleBlocks(gate.lessonId) });
  return { ok: true as const, snapshot, panel };
}

async function openKeywordLesson(userId: string, slug: string, blockKey?: string) {
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
    if (!block || block.data.type !== "TOOL" || block.data.toolKey !== "KEYWORD_INTENT_PLAN_V1") {
      return { ok: false as const, message: "Bloco inválido." };
    }
  }
  return { ok: true as const, lessonId: lesson.id };
}
