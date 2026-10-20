import { JOURNEY_STAGES, currentJourneyStage, type JourneyStageId } from "@/lib/home/home-continuation";
import { courseProgressPercent, firstGivenName } from "@/lib/home/student-home";

export type DashboardLesson = {
  slug: string;
  title: string;
  number: number;
  accessible: boolean;
  completed: boolean;
  inProgress: boolean;
  percent: number;
};

export type DashboardNextTone = "default" | "wait" | "celebrate";

export type DashboardNextAction = {
  kind: "start" | "learn" | "execute" | "analyze" | "wait" | "diagnostic" | "task" | "project" | "data" | "plan" | "completed";
  eyebrow: string;
  title: string;
  detail: string | null;
  href: string;
  cta: string;
  tone: DashboardNextTone;
  percent: number | null;
};

export type JourneyStageView = {
  id: JourneyStageId;
  label: string;
  status: "done" | "current" | "upcoming" | "locked";
};

export type MilestoneId =
  | "PRIMEIRA_AULA"
  | "PRIMEIRO_DIAGNOSTICO"
  | "PRIMEIRO_PLANO"
  | "PRIMEIRA_CAMPANHA"
  | "PRIMEIRO_DATASET"
  | "PRIMEIRA_ANALISE"
  | "PRIMEIRA_DECISAO"
  | "CURSO_CONCLUIDO";

export type MilestoneView = {
  id: MilestoneId;
  label: string;
  unlocked: boolean;
};

export type QuickAccessId = "course" | "project" | "data" | "plan" | "learning";

export type QuickAccessCard = {
  id: QuickAccessId;
  title: string;
  detail: string;
  href: string;
};

export type StudentDashboardViewModel = {
  userId: string;
  firstName: string;
  greeting: string;
  subtext: string;
  progress: {
    percentage: number;
    completedLessons: number;
    accessibleLessons: number;
    label: string;
  };
  currentStage: { id: JourneyStageId | null; label: string | null };
  nextAction: DashboardNextAction;
  journeyStages: JourneyStageView[];
  milestones: MilestoneView[];
  visibleMilestones: MilestoneView[];
  quickAccess: QuickAccessCard[];
  isNewStudent: boolean;
  courseCompleted: boolean;
};

export type DashboardBuildInput = {
  userId: string;
  name: string;
  lessons: DashboardLesson[];
  project: { id: string; name: string } | null;
  diagnostic: "none" | "in_progress" | "completed";
  importSummary: { total: number; ready: number };
  resultSlugs: readonly string[];
  planHint: string | null;
  operational: {
    kind: "none" | "task" | "recommendation" | "wait" | "diagnostic";
    recommendationType?: "LEARN" | "EXECUTE" | "ANALYZE" | "WAIT";
    title?: string | null;
    lessonSlug?: string | null;
    lessonTitle?: string | null;
    lessonPercent?: number | null;
  };
};

const MILESTONE_DEFS: ReadonlyArray<{ id: MilestoneId; label: string }> = [
  { id: "PRIMEIRA_AULA", label: "Primeira aula concluída" },
  { id: "PRIMEIRO_DIAGNOSTICO", label: "Primeiro diagnóstico" },
  { id: "PRIMEIRO_PLANO", label: "Primeiro plano criado" },
  { id: "PRIMEIRA_CAMPANHA", label: "Primeira campanha planejada" },
  { id: "PRIMEIRO_DATASET", label: "Primeiros dados enviados" },
  { id: "PRIMEIRA_ANALISE", label: "Primeira análise realizada" },
  { id: "PRIMEIRA_DECISAO", label: "Primeiro plano de ação" },
  { id: "CURSO_CONCLUIDO", label: "Curso concluído" },
];

const PLAN_SLUGS = new Set(["objetivo-oferta-orcamento", "destino-e-mensuracao"]);
const CAMPAIGN_SLUGS = new Set(["campanha-de-pesquisa", "campanhas-leads-whatsapp"]);
const ANALYZE_SLUG = "leia-os-numeros";
const DECIDE_SLUG = "o-que-mudar";

export function buildJourneyStages(lessons: DashboardLesson[]): JourneyStageView[] {
  const accessible = lessons.filter((lesson) => lesson.accessible);
  let sawIncomplete = false;
  return JOURNEY_STAGES.map((stage) => {
    const inStage = accessible.filter((lesson) => stage.slugs.includes(lesson.slug));
    if (inStage.length === 0) {
      return { id: stage.id, label: stage.label, status: "locked" as const };
    }
    const done = inStage.every((lesson) => lesson.completed);
    if (done) return { id: stage.id, label: stage.label, status: "done" as const };
    if (!sawIncomplete) {
      sawIncomplete = true;
      return { id: stage.id, label: stage.label, status: "current" as const };
    }
    return { id: stage.id, label: stage.label, status: "upcoming" as const };
  });
}

export function deriveMilestones(input: {
  completedCount: number;
  accessibleCount: number;
  diagnosticCompleted: boolean;
  readyImports: number;
  resultSlugs: readonly string[];
}): MilestoneView[] {
  const slugs = new Set(input.resultSlugs);
  const unlocked: Record<MilestoneId, boolean> = {
    PRIMEIRA_AULA: input.completedCount >= 1,
    PRIMEIRO_DIAGNOSTICO: input.diagnosticCompleted,
    PRIMEIRO_PLANO: [...PLAN_SLUGS].some((slug) => slugs.has(slug)),
    PRIMEIRA_CAMPANHA: [...CAMPAIGN_SLUGS].some((slug) => slugs.has(slug)),
    PRIMEIRO_DATASET: input.readyImports > 0,
    PRIMEIRA_ANALISE: slugs.has(ANALYZE_SLUG),
    PRIMEIRA_DECISAO: slugs.has(DECIDE_SLUG),
    CURSO_CONCLUIDO: input.accessibleCount > 0 && input.completedCount >= input.accessibleCount,
  };
  return MILESTONE_DEFS.map((item) => ({ id: item.id, label: item.label, unlocked: unlocked[item.id] }));
}

export function pickVisibleMilestones(milestones: MilestoneView[], limit = 4): MilestoneView[] {
  const unlocked = milestones.filter((item) => item.unlocked);
  if (unlocked.length >= limit) return unlocked.slice(-limit);
  const locked = milestones.filter((item) => !item.unlocked);
  return [...unlocked, ...locked].slice(0, limit);
}

export function resolveDashboardNextAction(input: DashboardBuildInput): DashboardNextAction {
  const accessible = input.lessons.filter((lesson) => lesson.accessible);
  const completed = accessible.filter((lesson) => lesson.completed);
  const resume = accessible.find((lesson) => lesson.inProgress);
  const nextOpen = accessible.find((lesson) => !lesson.completed);
  const courseDone = accessible.length > 0 && completed.length === accessible.length;
  const noStudyYet = accessible.every((lesson) => !lesson.completed && !lesson.inProgress);
  const planHref = input.project ? `/app/projetos/${input.project.id}/plano` : "/app/projetos/novo";

  if (input.operational.kind === "wait") {
    return {
      kind: "wait",
      eyebrow: "Agora é hora de observar",
      title: "Você ainda não precisa alterar a campanha.",
      detail: input.operational.title ?? "Acompanhe os indicadores no Plano Vivo.",
      href: planHref,
      cta: "Ver o que acompanhar",
      tone: "wait",
      percent: null,
    };
  }

  if (input.operational.kind === "task" && input.project) {
    return {
      kind: "task",
      eyebrow: "Próxima ação",
      title: input.operational.title ?? "Execute o próximo item do plano.",
      detail: input.planHint,
      href: planHref,
      cta: "Ver plano",
      tone: "default",
      percent: null,
    };
  }

  if (input.operational.kind === "recommendation") {
    const type = input.operational.recommendationType ?? "EXECUTE";
    if (type === "LEARN" && input.operational.lessonSlug) {
      return {
        kind: "learn",
        eyebrow: "Próximo aprendizado",
        title: input.operational.lessonTitle ?? input.operational.title ?? "Continue a aula recomendada.",
        detail: input.operational.title ?? null,
        href: `/aulas/${input.operational.lessonSlug}`,
        cta: "Continuar aula",
        tone: "default",
        percent: input.operational.lessonPercent ?? null,
      };
    }
    if (type === "ANALYZE") {
      return {
        kind: "analyze",
        eyebrow: "Próxima análise",
        title: input.operational.title ?? "Verificar termos de pesquisa",
        detail: null,
        href: planHref,
        cta: "Continuar",
        tone: "default",
        percent: null,
      };
    }
    return {
      kind: "execute",
      eyebrow: "Próxima ação",
      title: input.operational.title ?? "Revisar o próximo grupo",
      detail: null,
      href: planHref,
      cta: "Ver plano",
      tone: "default",
      percent: null,
    };
  }

  if (input.operational.kind === "diagnostic" && input.project) {
    return {
      kind: "diagnostic",
      eyebrow: "Seu próximo passo",
      title: input.diagnostic === "in_progress" ? "Continue o diagnóstico." : "Faça o diagnóstico do seu negócio.",
      detail: null,
      href: `/app/projetos/${input.project.id}/diagnostico`,
      cta: input.diagnostic === "in_progress" ? "Continuar diagnóstico" : "Fazer diagnóstico",
      tone: "default",
      percent: null,
    };
  }

  if (resume) {
    return {
      kind: "learn",
      eyebrow: "Seu próximo passo",
      title: `Continue: “${resume.title}”`,
      detail: `Aula ${resume.number}`,
      href: `/aulas/${resume.slug}?continuar=1`,
      cta: "Continuar aula",
      tone: "default",
      percent: resume.percent,
    };
  }

  if (noStudyYet) {
    const first = nextOpen ?? accessible[0];
    return {
      kind: "start",
      eyebrow: "Seu próximo passo",
      title: "Vamos começar?",
      detail: first ? `Comece pela Aula ${first.number}.` : "Comece pelas aulas gratuitas.",
      href: first ? `/aulas/${first.slug}` : "/cursos",
      cta: "Começar primeira aula",
      tone: "default",
      percent: null,
    };
  }

  if (courseDone && input.project) {
    if (input.importSummary.ready > 0) {
      return {
        kind: "completed",
        eyebrow: "Curso concluído ✓",
        title: "Seu próximo passo está no Plano Vivo.",
        detail: input.planHint ?? "Revise a campanha ou envie um novo período de dados.",
        href: planHref,
        cta: "Ver meu plano",
        tone: "celebrate",
        percent: 100,
      };
    }
    if (input.importSummary.total === 0 && input.diagnostic === "completed") {
      return {
        kind: "data",
        eyebrow: "Curso concluído ✓",
        title: "Envie os dados da campanha para analisar.",
        detail: null,
        href: `/app/projetos/${input.project.id}/dados`,
        cta: "Enviar dados",
        tone: "celebrate",
        percent: 100,
      };
    }
    return {
      kind: "completed",
      eyebrow: "Curso concluído ✓",
      title: "Seu próximo passo está no seu Plano Vivo.",
      detail: input.planHint,
      href: planHref,
      cta: "Ver meu plano",
      tone: "celebrate",
      percent: 100,
    };
  }

  if (nextOpen) {
    return {
      kind: "learn",
      eyebrow: "Seu próximo passo",
      title: nextOpen.title,
      detail: `Aula ${nextOpen.number}`,
      href: `/aulas/${nextOpen.slug}`,
      cta: "Começar aula",
      tone: "default",
      percent: null,
    };
  }

  if (!input.project) {
    return {
      kind: "project",
      eyebrow: "Seu próximo passo",
      title: "Crie seu primeiro projeto",
      detail: "Guarde o contexto do negócio para aplicar o que aprender.",
      href: "/app/projetos/novo",
      cta: "Criar projeto",
      tone: "default",
      percent: null,
    };
  }

  if (courseDone) {
    return {
      kind: "completed",
      eyebrow: "Curso concluído ✓",
      title: "Seu próximo passo está no seu Plano Vivo.",
      detail: input.planHint,
      href: planHref,
      cta: "Ver meu plano",
      tone: "celebrate",
      percent: 100,
    };
  }

  return {
    kind: "plan",
    eyebrow: "Seu próximo passo",
    title: "Revise seu Plano Vivo",
    detail: input.planHint,
    href: planHref,
    cta: "Ver plano",
    tone: "default",
    percent: null,
  };
}

export function buildQuickAccess(input: DashboardBuildInput): QuickAccessCard[] {
  const accessible = input.lessons.filter((lesson) => lesson.accessible);
  const completed = accessible.filter((lesson) => lesson.completed).length;
  const cards: QuickAccessCard[] = [
    {
      id: "course",
      title: "Cursos",
      detail: accessible.length === 0 || completed === 0 ? "Veja os cursos disponíveis" : "Continue sua jornada",
      href: "/cursos",
    },
  ];

  cards.push(
    input.project
      ? {
          id: "project",
          title: "Meu projeto",
          detail: input.project.name,
          href: `/app/projetos/${input.project.id}`,
        }
      : {
          id: "project",
          title: "Meu projeto",
          detail: "Crie seu primeiro projeto",
          href: "/app/projetos/novo",
        },
  );

  const hasStudy = completed > 0 || accessible.some((lesson) => lesson.inProgress);
  if (!hasStudy && !input.project) {
    return cards.slice(0, 2);
  }

  if (input.project) {
    const dataDetail =
      input.importSummary.ready > 0
        ? input.importSummary.ready === 1
          ? "1 arquivo pronto"
          : "Dados prontos para análise"
        : input.importSummary.total > 0
          ? "Arquivo em processamento"
          : "Nenhum arquivo";
    cards.push({
      id: "data",
      title: "Dados da campanha",
      detail: dataDetail,
      href: `/app/projetos/${input.project.id}/dados`,
    });
  }

  if (input.project && (input.diagnostic !== "none" || input.planHint || input.operational.kind !== "none")) {
    cards.push({
      id: "plan",
      title: "Plano Vivo",
      detail: input.planHint ?? "Acompanhe o próximo item",
      href: `/app/projetos/${input.project.id}/plano`,
    });
  }

  if (hasStudy) {
    cards.push({
      id: "learning",
      title: "Meu aprendizado",
      detail: "Progresso, notas e marcações",
      href: "/app/aprendizado",
    });
  }

  return cards.slice(0, 5);
}

export function buildStudentDashboard(input: DashboardBuildInput): StudentDashboardViewModel {
  const firstName = firstGivenName(input.name);
  const greeting = firstName ? `Olá, ${firstName} 👋` : "Olá 👋";
  const accessible = input.lessons.filter((lesson) => lesson.accessible);
  const completedLessons = accessible.filter((lesson) => lesson.completed).length;
  const inProgressCount = accessible.filter((lesson) => lesson.inProgress).length;
  const openCount = accessible.length - completedLessons - inProgressCount;
  const percentage = courseProgressPercent(completedLessons, inProgressCount, openCount);
  const stage = currentJourneyStage(input.lessons);
  const courseCompleted = accessible.length > 0 && completedLessons === accessible.length;
  const isNewStudent =
    completedLessons === 0 &&
    inProgressCount === 0 &&
    !input.project &&
    input.diagnostic === "none" &&
    input.importSummary.total === 0;
  const milestones = deriveMilestones({
    completedCount: completedLessons,
    accessibleCount: accessible.length,
    diagnosticCompleted: input.diagnostic === "completed",
    readyImports: input.importSummary.ready,
    resultSlugs: input.resultSlugs,
  });
  const nextAction = resolveDashboardNextAction(input);

  return {
    userId: input.userId,
    firstName,
    greeting,
    subtext: isNewStudent ? "Vamos começar?" : courseCompleted ? "Curso concluído ✓" : "Continue avançando.",
    progress: {
      percentage,
      completedLessons,
      accessibleLessons: accessible.length,
      label: "Seu progresso",
    },
    currentStage: { id: stage.id, label: stage.label },
    nextAction,
    journeyStages: buildJourneyStages(input.lessons),
    milestones,
    visibleMilestones: pickVisibleMilestones(milestones),
    quickAccess: buildQuickAccess(input),
    isNewStudent,
    courseCompleted,
  };
}

export function dashboardHasPrivateKeys(view: StudentDashboardViewModel): boolean {
  const blob = JSON.stringify(view);
  return ["email", "answers", "payload", "password", "resultSnapshot", "rawStoragePath"].some((key) =>
    blob.includes(`"${key}"`),
  );
}
