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
  DIGITAL_PRESENCE_DECISION_TOOL,
  SITE_LANDING_WHATSAPP_SLUG,
  digitalPresenceDecisionSchema,
  digitalPresenceResponseSchema,
  parseDigitalPresenceForm,
  prefillFromJourneyMap,
  type DigitalPresenceDecision,
  type DigitalPresenceInputs,
} from "@/lib/learning/digital-presence-decision";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export type PresenceProjectChoice = {
  id: string;
  name: string;
  projectHref: string;
  prefill: Partial<DigitalPresenceInputs> & { offer?: string };
  decision: DigitalPresenceDecision | null;
  journeyMap: ConversionJourneyMap | null;
};

export type DigitalPresencePanel =
  | { mode: "preview"; kind: "presence" }
  | {
      mode: "live";
      kind: "presence";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      createProjectHref: string;
      chooseProject: boolean;
      projects: PresenceProjectChoice[];
      linkedProjectId: string | null;
      personalDecision: DigitalPresenceDecision | null;
      personalPrefill: Partial<DigitalPresenceInputs> & { offer?: string };
    };

export function digitalPresencePreviewState(): DigitalPresencePanel {
  return { mode: "preview", kind: "presence" };
}

export async function loadDigitalPresencePanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<DigitalPresencePanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === DIGITAL_PRESENCE_DECISION_TOOL);
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(SITE_LANDING_WHATSAPP_SLUG, "estrutura");
  const createProjectHref = `/app/projetos/novo?returnTo=${encodeURIComponent(returnTo)}`;
  if (!input.userId) {
    return {
      mode: "live",
      kind: "presence",
      lessonSlug: SITE_LANDING_WHATSAPP_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      createProjectHref,
      chooseProject: false,
      projects: [],
      linkedProjectId: null,
      personalDecision: null,
      personalPrefill: {},
    };
  }

  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: SITE_LANDING_WHATSAPP_SLUG }, select: { id: true } });
  const lesson1 = await prisma.lesson.findUnique({ where: { slug: SITE_AJUDA_A_VENDER_SLUG }, select: { id: true } });
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
  const response = lesson
    ? await prisma.lessonResponse.findUnique({
        where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: tool.blockKey } },
        select: { payload: true },
      })
    : null;
  const linked = digitalPresenceResponseSchema.safeParse(response?.payload);
  const personalParsed = digitalPresenceDecisionSchema.safeParse(personal?.payload);
  const personalJourney = conversionJourneyMapSchema.safeParse(journeyPersonal?.payload);

  return {
    mode: "live",
    kind: "presence",
    lessonSlug: SITE_LANDING_WHATSAPP_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    createProjectHref,
    chooseProject: projects.length > 1,
    linkedProjectId: linked.success && linked.data.kind === "project" ? linked.data.projectId ?? null : null,
    personalDecision: personalParsed.success ? personalParsed.data : null,
    personalPrefill: personalJourney.success ? prefillFromJourneyMap(personalJourney.data) : {},
    projects: projects.map((project) => {
      const stored = projectResults.find((row) => row.projectId === project.id);
      const decision = stored ? digitalPresenceDecisionSchema.safeParse(stored.payload) : null;
      const journeyRow = journeyByProject.find((row) => row.projectId === project.id);
      const journey = journeyRow ? conversionJourneyMapSchema.safeParse(journeyRow.payload) : null;
      const journeyMap = journey?.success ? journey.data : null;
      const fromJourney: Partial<DigitalPresenceInputs> & { offer?: string } = journeyMap
        ? prefillFromJourneyMap(journeyMap)
        : {};
      return {
        id: project.id,
        name: project.name,
        projectHref: `/app/projetos/${project.id}`,
        prefill: {
          ...fromJourney,
          offer: fromJourney.offer || project.primaryOffer || "",
        },
        decision: decision?.success ? decision.data : null,
        journeyMap,
      };
    }),
  };
}

export async function saveDigitalPresenceForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    offer: string;
    numberOfOffers: string;
    explanationNeed: string;
    trustNeed: string;
    trafficSources: string[];
    primaryAction: string;
    currentStructure: string;
    contentNeed: string;
    projectId?: string;
  },
): Promise<{ ok: true; snapshot: LessonSnapshot; panel: DigitalPresencePanel } | { ok: false; message: string }> {
  const opened = await openPresenceLesson(userId, slug, blockKey);
  if (!opened.ok) return opened;
  const parsed = parseDigitalPresenceForm(input);
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
      await prisma.lessonResult.update({ where: { id: existing.id }, data: { payload: parsed.decision } });
    } else {
      await prisma.lessonResult.create({
        data: { userId, lessonId: opened.lessonId, projectId: parsed.projectId, payload: parsed.decision },
      });
    }
    await upsertPersonalLessonResult(userId, opened.lessonId, parsed.decision);
    await prisma.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
      create: {
        userId,
        lessonId: opened.lessonId,
        blockKey,
        payload: { kind: "project", projectId: parsed.projectId, decision: parsed.decision },
      },
      update: { payload: { kind: "project", projectId: parsed.projectId, decision: parsed.decision } },
    });
  } else {
    await upsertPersonalLessonResult(userId, opened.lessonId, parsed.decision);
    await prisma.lessonResponse.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
      create: {
        userId,
        lessonId: opened.lessonId,
        blockKey,
        payload: { kind: "personal", projectId: null, decision: parsed.decision },
      },
      update: { payload: { kind: "personal", projectId: null, decision: parsed.decision } },
    });
  }

  const now = new Date();
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: opened.lessonId, blockKey } },
    create: { userId, lessonId: opened.lessonId, blockKey, viewedAt: now, completedAt: now },
    update: { viewedAt: now, completedAt: now },
  });

  const snapshot = await recomputeProgress(userId, opened.lessonId, blockKey);
  const panel = await loadDigitalPresencePanel({ userId, blocks: opened.rules });
  if (!panel) return { ok: false, message: "Não foi possível recarregar a decisão." };
  return { ok: true, snapshot, panel };
}

async function openPresenceLesson(userId: string, slug: string, blockKey: string) {
  if (slug !== SITE_LANDING_WHATSAPP_SLUG) return { ok: false as const, message: "Aula inválida." };
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson) return { ok: false as const, message: "Aula não encontrada." };
  if (!canReadLessonBody(lesson)) return { ok: false as const, message: "Esta aula ainda não está disponível." };
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== DIGITAL_PRESENCE_DECISION_TOOL) {
    return { ok: false as const, message: "Ferramenta inválida." };
  }
  return { ok: true as const, lessonId: lesson.id, rules };
}
