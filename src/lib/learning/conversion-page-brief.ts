import type { Prisma } from "@/generated/prisma/client";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import { conversionJourneyMapSchema, type ConversionJourneyMap, PRIMARY_ACTIONS, TRAFFIC_SOURCES } from "@/lib/learning/conversion-journey-map";
import { conversionPageReadinessSchema } from "@/lib/learning/conversion-page-readiness";
import { digitalPresenceDecisionSchema, RECOMMENDED_STRUCTURE_LABELS } from "@/lib/learning/digital-presence-decision";
import type { LessonBlockData } from "@/lib/learning/blocks";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import { loadRuleBlocks, recomputeProgress } from "@/lib/learning/state";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import {
  conversionBriefLessonSummary,
  parseConversionPageBrief,
  type ConversionPageBriefV1,
} from "@/lib/landing-page/brief";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import { saveConversionPageBrief, createLandingPageProject, listLandingPageProjects } from "@/lib/landing-page/service";
import { landingPageMessage } from "@/lib/landing-page/errors";

export const CONVERSION_PAGE_BRIEF_TOOL = "CONVERSION_PAGE_BRIEF_V1" as const;
export const SITE_OFFER_BRIEF_SLUG = "oferta-publico-acao-principal";

export const BRIEF_CONFLICT_MESSAGE = "Esta página foi alterada em outro lugar. Atualize os dados antes de salvar novamente.";

export type BriefPrefill = {
  offerName?: string;
  trafficSources?: ConversionPageBriefV1["arrivalContext"]["trafficSources"];
  pageGoal?: ConversionPageBriefV1["pageGoal"];
  primaryActionType?: ConversionPageBriefV1["primaryAction"]["type"];
  businessOutcome?: ConversionPageBriefV1["businessOutcome"];
  arrivalNote?: string;
  notes: string[];
};

export function prefillConversionBrief(input: {
  linkedProjectId: string | null;
  journeyProjectId: string | null;
  journey: ConversionJourneyMap | null;
  presenceProjectId: string | null;
  recommendedStructure: string | null;
  readinessProjectId: string | null;
  primaryBottleneck: string | null;
}): BriefPrefill {
  const notes: string[] = [];
  const same = (projectId: string | null) => Boolean(input.linkedProjectId) && projectId === input.linkedProjectId;
  const prefill: BriefPrefill = { notes };

  if (same(input.journeyProjectId) && input.journey) {
    prefill.offerName = input.journey.offer;
    if ((TRAFFIC_SOURCES as readonly string[]).includes(input.journey.trafficSource)) {
      prefill.trafficSources = [input.journey.trafficSource];
    }
    prefill.arrivalNote = input.journey.destinationDescription;
    const action = mapJourneyAction(input.journey.primaryAction);
    if (action) {
      prefill.pageGoal = action.pageGoal;
      prefill.primaryActionType = action.action;
    }
    const outcome = mapJourneyOutcome(input.journey.businessOutcome);
    if (outcome) prefill.businessOutcome = outcome;
  }

  if (same(input.presenceProjectId) && input.recommendedStructure && input.recommendedStructure !== "LANDING_PAGE") {
    const label = RECOMMENDED_STRUCTURE_LABELS[input.recommendedStructure as keyof typeof RECOMMENDED_STRUCTURE_LABELS] ?? input.recommendedStructure;
    notes.push(`Na etapa anterior, sua estrutura recomendada incluía ${label}. Aqui você construirá uma landing page para uma oferta específica.`);
  }

  if (same(input.readinessProjectId) && input.primaryBottleneck) {
    notes.push("O diagnóstico anterior continua disponível como contexto. Ele não altera este brief sozinho.");
  }

  return prefill;
}

function mapJourneyAction(action: (typeof PRIMARY_ACTIONS)[number]): { pageGoal: ConversionPageBriefV1["pageGoal"]; action?: ConversionPageBriefV1["primaryAction"]["type"] } | null {
  switch (action) {
    case "WHATSAPP":
    case "CONTACT":
    case "CALL":
      return { pageGoal: "START_CONVERSATION", action: "WHATSAPP" };
    case "FORM_SUBMIT":
      return { pageGoal: "GENERATE_LEAD", action: "FORM" };
    case "QUOTE_REQUEST":
      return { pageGoal: "REQUEST_QUOTE", action: "FORM" };
    case "BOOKING":
      return { pageGoal: "BOOK_APPOINTMENT", action: "FORM" };
    case "PURCHASE":
      return { pageGoal: "SELL" };
    case "SIGN_UP":
      return { pageGoal: "SIGN_UP", action: "FORM" };
    case "VISIT_PAGE":
      return { pageGoal: "INFORM_AND_ADVANCE", action: "INTERNAL_ROUTE" };
    default:
      return null;
  }
}

function mapJourneyOutcome(outcome: ConversionJourneyMap["businessOutcome"]): ConversionPageBriefV1["businessOutcome"] | null {
  switch (outcome) {
    case "LEAD":
    case "QUALIFIED_LEAD":
      return "LEAD";
    case "QUOTE":
      return "QUOTE";
    case "APPOINTMENT":
      return "APPOINTMENT";
    case "SALE":
    case "CUSTOMER":
      return "SALE";
    case "REGISTRATION":
      return "REGISTRATION";
    case "AWARENESS":
      return "OTHER";
    default:
      return null;
  }
}

export type ConversionBriefPanel = {
  kind: "conversion-brief";
  mode: "preview" | "live";
  preview: boolean;
  authenticated: boolean;
  blockKey: string;
  pages: Array<{ id: string; title: string; slug: string; draftRevision: number; projectId: string | null }>;
  projects: Array<{ id: string; name: string }>;
  prefillByProject: Record<string, BriefPrefill>;
  standalonePrefill: BriefPrefill;
};

export function conversionBriefPreviewState(): ConversionBriefPanel {
  return {
    kind: "conversion-brief",
    mode: "preview",
    preview: true,
    authenticated: false,
    blockKey: "ferramenta-brief",
    pages: [],
    projects: [],
    prefillByProject: {},
    standalonePrefill: { notes: [] },
  };
}

export async function loadConversionBriefPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<ConversionBriefPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === CONVERSION_PAGE_BRIEF_TOOL);
  if (!tool) return null;
  if (!input.userId) {
    return {
      kind: "conversion-brief",
      mode: "live",
      preview: false,
      authenticated: false,
      blockKey: tool.blockKey,
      pages: [],
      projects: [],
      prefillByProject: {},
      standalonePrefill: { notes: [] },
    };
  }
  const prisma = getPrisma();
  const pages = await listLandingPageProjects(createPrismaLandingPageStore(), { userId: input.userId });
  const projects = await prisma.project.findMany({
    where: { userId: input.userId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
  });
  const [lesson1, lesson2, lesson3] = await Promise.all([
    prisma.lesson.findUnique({ where: { slug: "site-ajuda-a-vender" }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: "site-landing-page-ou-whatsapp" }, select: { id: true } }),
    prisma.lesson.findUnique({ where: { slug: "pagina-pronta-para-converter" }, select: { id: true } }),
  ]);
  const projectIds = projects.map((project) => project.id);
  const results = async (lessonId: string | undefined) =>
    lessonId && projectIds.length
      ? prisma.lessonResult.findMany({
          where: { userId: input.userId!, lessonId, projectId: { in: projectIds } },
          select: { projectId: true, payload: true },
        })
      : [];
  const [journeys, presences, readiness] = await Promise.all([
    results(lesson1?.id),
    results(lesson2?.id),
    results(lesson3?.id),
  ]);
  const prefillByProject: Record<string, BriefPrefill> = {};
  for (const project of projects) {
    const journey = journeys.find((row) => row.projectId === project.id);
    const presence = presences.find((row) => row.projectId === project.id);
    const ready = readiness.find((row) => row.projectId === project.id);
    const journeyParsed = conversionJourneyMapSchema.safeParse(journey?.payload);
    const presenceParsed = digitalPresenceDecisionSchema.safeParse(presence?.payload);
    const readyParsed = conversionPageReadinessSchema.safeParse(ready?.payload);
    prefillByProject[project.id] = prefillConversionBrief({
      linkedProjectId: project.id,
      journeyProjectId: journeyParsed.success ? project.id : null,
      journey: journeyParsed.success ? journeyParsed.data : null,
      presenceProjectId: presenceParsed.success ? project.id : null,
      recommendedStructure: presenceParsed.success ? presenceParsed.data.recommendedStructure : null,
      readinessProjectId: readyParsed.success ? project.id : null,
      primaryBottleneck: readyParsed.success ? readyParsed.data.primaryBottleneck : null,
    });
  }
  return {
    kind: "conversion-brief",
    mode: "live",
    preview: false,
    authenticated: true,
    blockKey: tool.blockKey,
    pages: pages.map((page) => ({
      id: page.id,
      title: page.title,
      slug: page.slug,
      draftRevision: page.draftRevision,
      projectId: page.projectId,
    })),
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    prefillByProject,
    standalonePrefill: { notes: [] },
  };
}

export async function saveConversionBriefForUser(
  userId: string,
  slug: string,
  blockKey: string,
  input: {
    mode: "create" | "select";
    landingPageProjectId?: string;
    expectedRevision?: number;
    title?: string;
    slugSuggestion?: string;
    projectId?: string | null;
    brief: unknown;
  },
): Promise<{ ok: true; snapshot: LessonSnapshot; landingPageProjectId: string; draftRevision: number } | { ok: false; message: string; code?: string }> {
  if (slug !== SITE_OFFER_BRIEF_SLUG) return { ok: false, message: "Aula inválida." };
  const brief = parseConversionPageBrief(input.brief);
  if (!brief.ok) return { ok: false, message: "Revise os campos do brief antes de salvar." };

  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true, priceCents: true },
  });
  if (!lesson || !canReadLessonBody(lesson, { entitled: await hasActiveEntitlement(userId, lesson.id) })) {
    return { ok: false, message: "Esta aula ainda não está disponível." };
  }
  const rules = await loadRuleBlocks(lesson.id);
  const block = rules.find((item) => item.blockKey === blockKey && !item.retiredAt);
  if (!block || block.data.type !== "TOOL" || block.data.toolKey !== CONVERSION_PAGE_BRIEF_TOOL) {
    return { ok: false, message: "Ferramenta inválida." };
  }

  const store = createPrismaLandingPageStore();
  let landingPageProjectId = input.landingPageProjectId ?? "";
  let expectedRevision = input.expectedRevision ?? 0;
  if (input.mode === "create") {
    const created = await createLandingPageProject(store, {
      userId,
      title: input.title ?? brief.brief.offer.name,
      slug: input.slugSuggestion ?? "",
      projectId: input.projectId,
    });
    if (!created.ok) return { ok: false, message: landingPageMessage(created.code), code: created.code };
    landingPageProjectId = created.value.id;
    expectedRevision = created.value.draftRevision;
  }

  const saved = await saveConversionPageBrief(store, {
    userId,
    landingPageProjectId,
    expectedRevision,
    brief: brief.brief,
  });
  if (!saved.ok) {
    return {
      ok: false,
      message: saved.code === "LANDING_PAGE_DRAFT_CONFLICT" ? BRIEF_CONFLICT_MESSAGE : landingPageMessage(saved.code),
      code: saved.code,
    };
  }

  const summary = conversionBriefLessonSummary(landingPageProjectId, brief.brief, new Date().toISOString());
  const payload = summary as unknown as Prisma.InputJsonValue;
  const linkedProject = saved.value.projectId;
  if (linkedProject) {
    const existing = await prisma.lessonResult.findFirst({
      where: { userId, lessonId: lesson.id, projectId: linkedProject },
    });
    if (existing) {
      await prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
    } else {
      await prisma.lessonResult.create({
        data: { userId, lessonId: lesson.id, projectId: linkedProject, payload },
      });
    }
  }
  await upsertPersonalLessonResult(userId, lesson.id, {
    kind: summary.kind,
    landingPageProjectId: summary.landingPageProjectId,
    briefVersion: String(summary.briefVersion),
    oferta: summary.offerName,
    publico: summary.audienceSummary,
    acao: summary.primaryActionType,
    pageGoal: summary.pageGoal,
    businessOutcome: summary.businessOutcome,
    objectionCount: String(summary.objectionCount),
    completedAt: summary.completedAt,
  });
  await prisma.lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: lesson.id, blockKey } },
    create: { userId, lessonId: lesson.id, blockKey, payload },
    update: { payload },
  });
  const now = new Date();
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId, lessonId: lesson.id, blockKey } },
    create: { userId, lessonId: lesson.id, blockKey, viewedAt: now, completedAt: now },
    update: { completedAt: now },
  });
  const snapshot = await recomputeProgress(userId, lesson.id, blockKey);
  return { ok: true, snapshot, landingPageProjectId, draftRevision: saved.value.draftRevision };
}
