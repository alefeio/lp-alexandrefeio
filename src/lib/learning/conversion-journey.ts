import { lessonToolReturnPath } from "@/lib/auth/messages";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import {
  CONVERSION_JOURNEY_MAP_TOOL,
  SITE_AJUDA_A_VENDER_SLUG,
  conversionJourneyMapSchema,
  journeyMapResponseSchema,
  parseConversionJourneyMapForm,
  type ConversionJourneyMap,
} from "@/lib/learning/conversion-journey-map";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export type JourneyProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  prefillOffer: string;
  map: ConversionJourneyMap | null;
};

export type ConversionJourneyPanel =
  | { mode: "preview"; kind: "journey" }
  | {
      mode: "live";
      kind: "journey";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      chooseProject: boolean;
      projects: JourneyProjectChoice[];
      linkedProjectId: string | null;
      personalMap: ConversionJourneyMap | null;
    };

export function conversionJourneyPreviewState(): ConversionJourneyPanel {
  return { mode: "preview", kind: "journey" };
}

export async function loadConversionJourneyPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<ConversionJourneyPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === CONVERSION_JOURNEY_MAP_TOOL);
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(SITE_AJUDA_A_VENDER_SLUG, "mapa");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "journey",
      lessonSlug: SITE_AJUDA_A_VENDER_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
      personalMap: null,
    };
  }

  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_AJUDA_A_VENDER_SLUG }, select: { id: true } });
  const projects = await prisma.project.findMany({
    where: { userId: input.userId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, primaryOffer: true },
  });
  const personal = lesson
    ? await prisma.lessonResult.findFirst({
        where: { userId: input.userId, lessonId: lesson.id, projectId: null },
        select: { payload: true },
      })
    : null;
  const projectResults = lesson
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson.id, projectId: { in: projects.map((project) => project.id) } },
        select: { projectId: true, payload: true },
      })
    : [];
  const response = lesson
    ? await prisma.lessonResponse.findUnique({
        where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
        select: { payload: true },
      })
    : null;
  const linked = journeyMapResponseSchema.safeParse(response?.payload);
  const personalParsed = conversionJourneyMapSchema.safeParse(personal?.payload);

  return {
    mode: "live",
    kind: "journey",
    lessonSlug: SITE_AJUDA_A_VENDER_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    chooseProject: projects.length > 1,
    linkedProjectId: linked.success && linked.data.kind === "project" ? linked.data.projectId ?? null : null,
    personalMap: personalParsed.success ? personalParsed.data : null,
    projects: projects.map((project) => {
      const stored = projectResults.find((row) => row.projectId === project.id);
      const map = stored ? conversionJourneyMapSchema.safeParse(stored.payload) : null;
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        prefillOffer: project.primaryOffer ?? "",
        map: map?.success ? map.data : null,
      };
    }),
  };
}

export async function saveConversionJourneyForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    offer: string;
    trafficSource: string;
    trafficSourceOther?: string;
    destinationType: string;
    destinationDescription: string;
    destinationUrl?: string;
    primaryAction: string;
    businessOutcome: string;
    currentFriction?: string;
    reflection?: string;
    projectId?: string;
  },
): Promise<{ ok: true; snapshot: LessonSnapshot; panel: ConversionJourneyPanel } | { ok: false; message: string }> {
  const opened = await openJourneyLesson(userId, slug, blockKey);
  if (!opened.ok) return opened;
  const parsed = parseConversionJourneyMapForm(input);
  if (!parsed.ok) return parsed;

  const prisma = getPrisma();
  if (parsed.projectId) {
    const owned = await prisma.project.findFirst({
      where: { id: parsed.projectId, userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!owned) return { ok: false, message: "Projeto inválido." };
    const existing = await prisma.lessonResult.findFirst({
      where: { userId, lessonId: opened.lessonId, projectId: parsed.projectId },
    });
    if (existing) {
      await prisma.lessonResult.update({ where: { id: existing.id }, data: { payload: parsed.map } });
    } else {
      await prisma.lessonResult.create({
        data: { userId, lessonId: opened.lessonId, projectId: parsed.projectId, payload: parsed.map },
      });
    }
    await upsertPersonalLessonResult(userId, opened.lessonId, parsed.map);
    await prisma.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
      create: {
        userId,
        lessonId: opened.lessonId,
        blockKey,
        payload: { kind: "project", projectId: parsed.projectId, map: parsed.map },
      },
      update: { payload: { kind: "project", projectId: parsed.projectId, map: parsed.map } },
    });
  } else {
    await upsertPersonalLessonResult(userId, opened.lessonId, parsed.map);
    await prisma.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
      create: {
        userId,
        lessonId: opened.lessonId,
        blockKey,
        payload: { kind: "personal", projectId: null, map: parsed.map },
      },
      update: { payload: { kind: "personal", projectId: null, map: parsed.map } },
    });
  }

  const now = new Date();
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
    create: { userId, lessonId: opened.lessonId, blockKey, viewedAt: now, completedAt: now },
    update: { viewedAt: now, completedAt: now },
  });

  const snapshot = await recomputeProgress(userId, opened.lessonId, blockKey);
  const panel = await loadConversionJourneyPanel({ userId, blocks: opened.rules });
  if (!panel) return { ok: false, message: "Não foi possível recarregar o mapa." };
  return { ok: true, snapshot, panel };
}

async function openJourneyLesson(userId: string, slug: string, blockKey: string) {
  if (slug !== SITE_AJUDA_A_VENDER_SLUG) return { ok: false as const, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson) return { ok: false as const, message: "Aula não encontrada." };
  if (!canReadLessonBody(lesson)) return { ok: false as const, message: "Esta aula ainda não está disponível." };
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== CONVERSION_JOURNEY_MAP_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida." };
  }
  return { ok: true as const, lessonId: lesson.id, rules };
}
