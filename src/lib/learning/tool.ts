import { lessonToolReturnPath, safeReturnPath } from "@/lib/auth/messages";
import { DIAGNOSTIC_VERSION } from "@/lib/diagnostic/definition";
import { dimensionLabel, knownDimension, resultSnapshotSchema } from "@/lib/diagnostic/score";
import { getPrisma } from "@/lib/db/prisma";
import { toolResponseSchema, type LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_03_SLUG } from "@/lib/learning/lesson-03";
import { recomputeProgress } from "@/lib/learning/state";

export type TrafficToolRecommendation = {
  id: string;
  type: "LEARN" | "EXECUTE" | "ANALYZE" | "WAIT";
  title: string;
  hasActiveTask: boolean;
  lesson: { title: string; href: string; soon: boolean } | null;
};

export type TrafficToolSummary = {
  projectId: string;
  projectName: string;
  diagnosticId: string;
  completedAtLabel: string;
  overallScore: number;
  bottleneckLabel: string;
  nextStepTitle: string;
  channelExplanation: string;
  resultHref: string;
  planHref: string;
  recommendation: TrafficToolRecommendation | null;
};

export type TrafficProjectChoice = {
  id: string;
  name: string;
  latest: {
    id: string;
    completedAtLabel: string;
    overallScore: number;
    bottleneckLabel: string;
  } | null;
  resumeHref: string | null;
  startHref: string;
};

export type TrafficToolPanel =
  | { mode: "preview" }
  | {
      mode: "live";
      lessonSlug: string;
      blockKey: string;
      authenticated: boolean;
      signupHref: string;
      loginHref: string;
      createProjectHref: string;
      chooseProject: boolean;
      projects: TrafficProjectChoice[];
      linked: TrafficToolSummary | null;
    };

export function trafficToolPreviewState(): TrafficToolPanel {
  return { mode: "preview" };
}

const dateLabel = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" });

export function lessonSlugFromReturn(value: string | null | undefined): string | null {
  const path = safeReturnPath(value);
  if (!path) return null;
  const match = /^\/aulas\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:#[A-Za-z0-9_-]+)?$/.exec(path);
  return match?.[1] ?? null;
}

export async function loadTrafficToolPanel(input: {
  userId: string | null;
  blocks: Array<{ blockKey: string; data: LessonBlockData }>;
}): Promise<TrafficToolPanel | null> {
  const tool = input.blocks.find((block) => block.data.type === "TOOL" && block.data.toolKey === "TRAFFIC_READINESS_V1");
  if (!tool || tool.data.type !== "TOOL") return null;
  const returnTo = lessonToolReturnPath(LESSON_03_SLUG);
  const encoded = encodeURIComponent(returnTo);
  if (!input.userId) {
    return {
      mode: "live",
      lessonSlug: LESSON_03_SLUG,
      blockKey: tool.blockKey,
      authenticated: false,
      signupHref: `/cadastro?next=${encoded}`,
      loginHref: `/entrar?next=${encoded}`,
      createProjectHref: `/app/projetos/novo?returnTo=${encoded}`,
      chooseProject: false,
      projects: [],
      linked: null,
    };
  }

  const prisma = getPrisma();
  const [projects, response] = await Promise.all([
    prisma.project.findMany({
      where: { userId: input.userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        diagnostics: {
          where: { userId: input.userId, version: DIAGNOSTIC_VERSION },
          orderBy: { updatedAt: "desc" },
          select: { id: true, status: true, completedAt: true, overallScore: true, primaryBottleneck: true },
        },
      },
    }),
    prisma.lessonResponse.findFirst({
      where: { userId: input.userId, blockKey: tool.blockKey, lesson: { slug: LESSON_03_SLUG } },
      select: { payload: true },
    }),
  ]);

  const parsed = toolResponseSchema.safeParse(response?.payload);
  const linked = parsed.success ? await summaryFor(input.userId, parsed.data.projectId, parsed.data.diagnosticId) : null;

  return {
    mode: "live",
    lessonSlug: LESSON_03_SLUG,
    blockKey: tool.blockKey,
    authenticated: true,
    signupHref: `/cadastro?next=${encoded}`,
    loginHref: `/entrar?next=${encoded}`,
    createProjectHref: `/app/projetos/novo?returnTo=${encoded}`,
    chooseProject: projects.length > 1,
    projects: projects.map((project) => {
      const completed = project.diagnostics.find((item) => item.status === "COMPLETED" && item.completedAt);
      const inProgress = project.diagnostics.find((item) => item.status === "IN_PROGRESS");
      return {
        id: project.id,
        name: project.name,
        latest: completed
          ? {
              id: completed.id,
              completedAtLabel: dateLabel.format(completed.completedAt ?? new Date()),
              overallScore: completed.overallScore ?? 0,
              bottleneckLabel: dimensionLabel(knownDimension(completed.primaryBottleneck)),
            }
          : null,
        resumeHref: inProgress ? diagnosticHref(project.id, returnTo) : null,
        startHref: diagnosticHref(project.id, returnTo),
      };
    }),
    linked,
  };
}

export async function linkTrafficReadiness(input: {
  userId: string;
  slug: string;
  blockKey: string;
  projectId: string;
  diagnosticId: string;
}): Promise<{ ok: true; href: string } | { ok: false; message: string; reason: "invalid" | "no-tool" }> {
  const prisma = getPrisma();
  const lesson = await prisma.lesson.findUnique({ where: { slug: input.slug }, select: { id: true, slug: true, status: true, accessType: true } });
  if (!lesson || lesson.status !== "PUBLISHED" || lesson.accessType !== "FREE") {
    return { ok: false, message: "Esta aula não está aberta.", reason: "invalid" };
  }
  const block = await prisma.lessonBlock.findFirst({
    where: { lessonId: lesson.id, blockKey: input.blockKey, retiredAt: null, type: "TOOL" },
  });
  const payload = block?.payload;
  const tool = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  if (!block || !tool || (tool as { toolKey?: string }).toolKey !== "TRAFFIC_READINESS_V1") {
    return { ok: false, message: "Esta aula não tem o diagnóstico.", reason: "no-tool" };
  }
  const owned = await ownedCompletedDiagnostic(input.userId, input.projectId, input.diagnosticId);
  if (!owned) return { ok: false, message: "Diagnóstico não encontrado.", reason: "invalid" };

  const now = new Date();
  const body = { projectId: owned.projectId, diagnosticId: owned.id };
  await prisma.lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: block.blockKey } },
    create: { userId: input.userId, lessonId: lesson.id, blockKey: block.blockKey, payload: body },
    update: { payload: body },
  });
  await prisma.lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId: input.userId, lessonId: lesson.id, blockKey: block.blockKey } },
    create: { userId: input.userId, lessonId: lesson.id, blockKey: block.blockKey, viewedAt: now, completedAt: now },
    update: { completedAt: now },
  });
  await recomputeProgress(input.userId, lesson.id, block.blockKey);
  return { ok: true, href: lessonToolReturnPath(lesson.slug) };
}

export async function linkTrafficReadinessFromReturn(input: {
  userId: string;
  returnTo: string | null;
  projectId: string;
  diagnosticId: string;
}) {
  const slug = lessonSlugFromReturn(input.returnTo);
  if (!slug) return { ok: false as const, message: "Retorno inválido.", reason: "invalid" as const };
  const prisma = getPrisma();
  const block = await prisma.lessonBlock.findFirst({
    where: { lesson: { slug }, retiredAt: null, type: "TOOL" },
    select: { blockKey: true },
  });
  if (!block) return { ok: false as const, message: "Esta aula não tem o diagnóstico.", reason: "no-tool" as const };
  return linkTrafficReadiness({
    userId: input.userId,
    slug,
    blockKey: block.blockKey,
    projectId: input.projectId,
    diagnosticId: input.diagnosticId,
  });
}

async function ownedCompletedDiagnostic(userId: string, projectId: string, diagnosticId: string) {
  return getPrisma().diagnostic.findFirst({
    where: {
      id: diagnosticId,
      projectId,
      userId,
      status: "COMPLETED",
      version: DIAGNOSTIC_VERSION,
      project: { userId, id: projectId, status: "ACTIVE" },
    },
    select: { id: true, projectId: true },
  });
}

async function summaryFor(userId: string, projectId: string, diagnosticId: string): Promise<TrafficToolSummary | null> {
  const diagnostic = await getPrisma().diagnostic.findFirst({
    where: {
      id: diagnosticId,
      projectId,
      userId,
      status: "COMPLETED",
      version: DIAGNOSTIC_VERSION,
      project: { userId, status: "ACTIVE" },
    },
    select: {
      id: true,
      projectId: true,
      overallScore: true,
      primaryBottleneck: true,
      completedAt: true,
      resultSnapshot: true,
      project: { select: { name: true } },
      recommendations: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          id: true,
          type: true,
          title: true,
          tasks: { where: { status: { in: ["TODO", "IN_PROGRESS"] } }, take: 1, select: { id: true } },
          lesson: { select: { slug: true, title: true, accessType: true, status: true, commerceStatus: true } },
        },
      },
    },
  });
  if (!diagnostic || diagnostic.overallScore == null) return null;
  const snapshot = resultSnapshotSchema.safeParse(diagnostic.resultSnapshot);
  const recommendation = diagnostic.recommendations[0];
  const lesson = recommendation?.lesson && recommendation.lesson.status === "PUBLISHED" ? recommendation.lesson : null;
  return {
    projectId: diagnostic.projectId,
    projectName: diagnostic.project.name,
    diagnosticId: diagnostic.id,
    completedAtLabel: dateLabel.format(diagnostic.completedAt ?? new Date()),
    overallScore: diagnostic.overallScore,
    bottleneckLabel: dimensionLabel(knownDimension(diagnostic.primaryBottleneck)),
    nextStepTitle: snapshot.success ? snapshot.data.nextStepTitle : "Veja o diagnóstico completo.",
    channelExplanation: snapshot.success ? snapshot.data.channelExplanation : "",
    resultHref: `/app/projetos/${diagnostic.projectId}/diagnosticos/${diagnostic.id}`,
    planHref: `/app/projetos/${diagnostic.projectId}/plano`,
    recommendation: recommendation
      ? {
          id: recommendation.id,
          type: recommendation.type,
          title: recommendation.title,
          hasActiveTask: recommendation.tasks.length > 0,
          lesson: lesson
            ? {
                title: lesson.title,
                href: `/aulas/${lesson.slug}`,
                soon: lesson.accessType === "PAID" && lesson.commerceStatus !== "AVAILABLE",
              }
            : null,
        }
      : null,
  };
}

function diagnosticHref(projectId: string, returnTo: string) {
  return `/app/projetos/${projectId}/diagnostico?returnTo=${encodeURIComponent(returnTo)}`;
}
