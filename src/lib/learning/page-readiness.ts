import type { Prisma } from "@/generated/prisma/client";
import { lessonToolReturnPath } from "@/lib/auth/messages";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import type { LessonBlockData } from "@/lib/learning/blocks";
import {
  SITE_AJUDA_A_VENDER_SLUG,
  conversionJourneyMapSchema,
  type ConversionJourneyMap,
} from "@/lib/learning/conversion-journey-map";
import {
  CONVERSION_PAGE_READINESS_TOOL,
  SITE_PAGE_READINESS_SLUG,
  contextFromLessons,
  conversionPageReadinessSchema,
  pageReadinessResponseSchema,
  parsePageReadinessForm,
  type ConversionPageReadiness,
} from "@/lib/learning/conversion-page-readiness";
import {
  SITE_LANDING_WHATSAPP_SLUG,
  digitalPresenceDecisionSchema,
  type DigitalPresenceDecision,
} from "@/lib/learning/digital-presence-decision";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export type ReadinessProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  context: ReturnType<typeof contextFromLessons>;
  readiness: ConversionPageReadiness | null;
  journeyMap: ConversionJourneyMap | null;
  presence: DigitalPresenceDecision | null;
};

export type PageReadinessPanel =
  | { mode: "preview"; kind: "pageReadiness" }
  | {
      mode: "live";
      kind: "pageReadiness";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      chooseProject: boolean;
      projects: ReadinessProjectChoice[];
      linkedProjectId: string | null;
      personalReadiness: ConversionPageReadiness | null;
      personalContext: ReturnType<typeof contextFromLessons>;
    };

export function pageReadinessPreviewState(): PageReadinessPanel {
  return { mode: "preview", kind: "pageReadiness" };
}

export async function loadPageReadinessPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<PageReadinessPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === CONVERSION_PAGE_READINESS_TOOL);
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(SITE_PAGE_READINESS_SLUG, "prontidao");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "pageReadiness",
      lessonSlug: SITE_PAGE_READINESS_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
      personalReadiness: null,
      personalContext: {},
    };
  }

  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_PAGE_READINESS_SLUG }, select: { id: true } });
  const lesson1 = await prisma.lesson.findUnique({ where: { slug: SITE_AJUDA_A_VENDER_SLUG }, select: { id: true } });
  const lesson2 = await prisma.lesson.findUnique({ where: { slug: SITE_LANDING_WHATSAPP_SLUG }, select: { id: true } });
  const projects = await prisma.project.findMany({
    where: { userId: input.userId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
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

  const journeyPersonal = lesson1
    ? await prisma.lessonResult.findFirst({
        where: { userId: input.userId, lessonId: lesson1.id, projectId: null },
        select: { payload: true },
      })
    : null;
  const journeyByProject = lesson1
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson1.id, projectId: { in: projects.map((project) => project.id) } },
        select: { projectId: true, payload: true },
      })
    : [];
  const presencePersonal = lesson2
    ? await prisma.lessonResult.findFirst({
        where: { userId: input.userId, lessonId: lesson2.id, projectId: null },
        select: { payload: true },
      })
    : null;
  const presenceByProject = lesson2
    ? await prisma.lessonResult.findMany({
        where: { userId: input.userId, lessonId: lesson2.id, projectId: { in: projects.map((project) => project.id) } },
        select: { projectId: true, payload: true },
      })
    : [];

  const response = lesson
    ? await prisma.lessonResponse.findUnique({
        where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
        select: { payload: true },
      })
    : null;
  const linked = pageReadinessResponseSchema.safeParse(response?.payload);
  const personalParsed = conversionPageReadinessSchema.safeParse(personal?.payload);
  const personalJourney = conversionJourneyMapSchema.safeParse(journeyPersonal?.payload);
  const personalPresence = digitalPresenceDecisionSchema.safeParse(presencePersonal?.payload);

  return {
    mode: "live",
    kind: "pageReadiness",
    lessonSlug: SITE_PAGE_READINESS_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    chooseProject: projects.length > 1,
    linkedProjectId: linked.success && linked.data.kind === "project" ? linked.data.projectId ?? null : null,
    personalReadiness: personalParsed.success ? personalParsed.data : null,
    personalContext: contextFromLessons({
      journey: personalJourney.success ? personalJourney.data : null,
      presence: personalPresence.success ? personalPresence.data : null,
    }),
    projects: projects.map((project) => {
      const stored = projectResults.find((row) => row.projectId === project.id);
      const readiness = stored ? conversionPageReadinessSchema.safeParse(stored.payload) : null;
      const journeyRow = journeyByProject.find((row) => row.projectId === project.id);
      const presenceRow = presenceByProject.find((row) => row.projectId === project.id);
      const journey = journeyRow ? conversionJourneyMapSchema.safeParse(journeyRow.payload) : null;
      const presence = presenceRow ? digitalPresenceDecisionSchema.safeParse(presenceRow.payload) : null;
      const journeyMap = journey?.success ? journey.data : null;
      const presenceData = presence?.success ? presence.data : null;
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        context: contextFromLessons({ journey: journeyMap, presence: presenceData }),
        readiness: readiness?.success ? readiness.data : null,
        journeyMap,
        presence: presenceData,
      };
    }),
  };
}

export async function savePageReadinessForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    pageExists: string;
    answers: Record<string, string>;
    context?: {
      offer?: string;
      currentDestination?: string;
      recommendedStructure?: string;
      primaryAction?: string;
    };
    projectId?: string;
  },
): Promise<{ ok: true; snapshot: LessonSnapshot; panel: PageReadinessPanel } | { ok: false; message: string }> {
  const opened = await openReadinessLesson(userId, slug, blockKey);
  if (!opened.ok) return opened;
  const parsed = parsePageReadinessForm(input);
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
    const projectPayload = { kind: "project", projectId: parsed.projectId, readiness: parsed.readiness } as Prisma.InputJsonValue;
    if (existing) {
      await prisma.lessonResult.update({
        where: { id: existing.id },
        data: { payload: parsed.readiness as Prisma.InputJsonValue },
      });
    } else {
      await prisma.lessonResult.create({
        data: {
          userId,
          lessonId: opened.lessonId,
          projectId: parsed.projectId,
          payload: parsed.readiness as Prisma.InputJsonValue,
        },
      });
    }
    await upsertPersonalLessonResult(userId, opened.lessonId, parsed.readiness as Prisma.InputJsonValue);
    await prisma.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
      create: {
        userId,
        lessonId: opened.lessonId,
        blockKey,
        payload: projectPayload,
      },
      update: { payload: projectPayload },
    });
  } else {
    const personalPayload = { kind: "personal", projectId: null, readiness: parsed.readiness } as Prisma.InputJsonValue;
    await upsertPersonalLessonResult(userId, opened.lessonId, parsed.readiness as Prisma.InputJsonValue);
    await prisma.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
      create: {
        userId,
        lessonId: opened.lessonId,
        blockKey,
        payload: personalPayload,
      },
      update: { payload: personalPayload },
    });
  }

  const now = new Date();
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
    create: { userId, lessonId: opened.lessonId, blockKey, viewedAt: now, completedAt: now },
    update: { viewedAt: now, completedAt: now },
  });

  const snapshot = await recomputeProgress(userId, opened.lessonId, blockKey);
  const panel = await loadPageReadinessPanel({ userId, blocks: opened.rules });
  if (!panel) return { ok: false, message: "Não foi possível recarregar o diagnóstico." };
  return { ok: true, snapshot, panel };
}

async function openReadinessLesson(userId: string, slug: string, blockKey: string) {
  if (slug !== SITE_PAGE_READINESS_SLUG) return { ok: false as const, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson) return { ok: false as const, message: "Aula não encontrada." };
  if (!canReadLessonBody(lesson)) return { ok: false as const, message: "Esta aula ainda não está disponível." };
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== CONVERSION_PAGE_READINESS_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida." };
  }
  return { ok: true as const, lessonId: lesson.id, rules };
}
