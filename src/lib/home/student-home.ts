import { LESSON_01_SLUG } from "@/lib/learning/lesson-01";

export type HomeLessonAccess = "FREE" | "PAID";
export type HomeCommerce = "NOT_FOR_SALE" | "AVAILABLE";

export type HomeContinue =
  | { kind: "start"; slug: string; title: string }
  | { kind: "resume"; slug: string; title: string; percent: number; remainingMinutes: number | null }
  | { kind: "done"; title: string; next: { slug: string; title: string } | null };

export type HomeNext =
  | { kind: "task"; title: string }
  | { kind: "learn"; title: string; href: string }
  | { kind: "execute"; title: string }
  | { kind: "analyze"; title: string }
  | { kind: "wait"; title: string | null }
  | { kind: "diagnostic" }
  | { kind: "none" };

export type HomeTask = {
  title: string;
  status: "TODO" | "IN_PROGRESS";
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueAt: string | null;
};

export type HomeReminder = {
  title: string;
  remindAt: string;
};

export type HomeRecommendationLesson = {
  slug: string;
  title: string;
  access: HomeLessonAccess;
  commerce: HomeCommerce;
  entitled: boolean;
  forSale: boolean;
  reason: string;
};

export type StudentHomeInput = {
  userId: string;
  firstName: string;
  courseTitle: string;
  continue: HomeContinue;
  completedCount: number;
  inProgressCount: number;
  openCount: number;
  lockedCount: number;
  project: {
    id: string;
    name: string;
    score: number | null;
    bottleneck: string | null;
    recommendation: string | null;
    otherProjects: boolean;
  } | null;
  diagnostic: "none" | "in_progress" | "completed";
  next: HomeNext;
  tasks: HomeTask[];
  reminder: HomeReminder | null;
  recommended: HomeRecommendationLesson | null;
  now: string;
};

export type StudentHomeView = {
  userId: string;
  greeting: string;
  subtext: string;
  continue: {
    kind: "start" | "resume" | "done";
    title: string;
    detail: string | null;
    href: string | null;
    cta: string | null;
  };
  nextStep: { body: string; href: string | null; cta: string | null } | null;
  progress: { completed: number; inProgress: number; open: number; locked: number; percent: number; note: string | null };
  project: { name: string; score: string | null; bottleneck: string | null; recommendation: string | null; href: string; allHref: string | null } | null;
  projectEmpty: { body: string; href: string; cta: string } | null;
  diagnostic: { body: string; href: string; cta: string } | null;
  tasks: { items: string[]; href: string; cta: string } | null;
  reminder: string | null;
  recommended: { title: string; reason: string; href: string; label: string; note: string | null } | null;
  shortcuts: Array<{ label: string; href: string }>;
};

const SHORTCUTS = [
  { label: "Meu aprendizado", href: "/app/aprendizado" },
  { label: "Projetos", href: "/app/projetos" },
  { label: "Alertas", href: "/app/alertas" },
  { label: "Compras", href: "/app/compras" },
] as const;

export function firstGivenName(name: string): string {
  const part = name.trim().split(/\s+/)[0] ?? "";
  return part;
}

export function courseProgressPercent(completed: number, inProgress: number, open: number): number {
  const track = completed + inProgress + open;
  if (track <= 0) return 0;
  return Math.round((completed / track) * 100);
}

export function pickHomeTasks(tasks: HomeTask[], now: Date): HomeTask[] {
  const time = now.getTime();
  const overdue = tasks
    .filter((task) => task.dueAt && Date.parse(task.dueAt) < time)
    .sort((a, b) => Date.parse(a.dueAt ?? "") - Date.parse(b.dueAt ?? ""));
  const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS" && !overdue.includes(task));
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const todo = tasks
    .filter((task) => task.status === "TODO" && !overdue.includes(task))
    .sort((a, b) => rank[a.priority] - rank[b.priority]);
  return [...overdue, ...inProgress, ...todo].slice(0, 3);
}

export function reminderLine(reminder: HomeReminder, now: Date): string | null {
  const target = Date.parse(reminder.remindAt);
  if (!Number.isFinite(target)) return null;
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.round((startOfUtcDay(target) - startOfUtcDay(now.getTime())) / day);
  if (diff < 0 || diff > 7) return null;
  if (diff === 0) return `${reminder.title} hoje.`;
  if (diff === 1) return `${reminder.title} amanhã.`;
  return `${reminder.title} em ${diff} dias.`;
}

export function recommendedAccess(lesson: HomeRecommendationLesson): { label: string; note: string | null } {
  if (lesson.entitled || lesson.access === "FREE") {
    return { label: "Continuar aula", note: null };
  }
  if (lesson.forSale) return { label: "Ver acesso", note: null };
  return { label: "Ver prévia", note: "Disponível em breve." };
}

export function buildStudentHome(input: StudentHomeInput): StudentHomeView {
  const name = firstGivenName(input.firstName);
  const greeting = name ? `Olá, ${name}.` : "Olá.";
  const hasStudy = input.continue.kind !== "start";
  const subtext = hasStudy
    ? `Você está avançando no curso ${input.courseTitle}.`
    : input.next.kind === "none"
      ? `Comece o curso ${input.courseTitle} pelas aulas gratuitas.`
      : "Seu próximo passo já está definido.";

  return {
    userId: input.userId,
    greeting,
    subtext,
    continue: continueBlock(input.continue),
    nextStep: nextStepBlock(input),
    progress: {
      completed: input.completedCount,
      inProgress: input.inProgressCount,
      open: input.openCount,
      locked: input.lockedCount,
      percent: courseProgressPercent(input.completedCount, input.inProgressCount, input.openCount),
      note: input.lockedCount > 0 ? "Aulas pagas sem acesso ficam de fora desta conta." : null,
    },
    project: input.project
      ? {
          name: input.project.name,
          score: input.project.score == null ? null : `${input.project.score}/100`,
          bottleneck: input.project.bottleneck,
          recommendation: input.project.recommendation,
          href: `/app/projetos/${input.project.id}`,
          allHref: input.project.otherProjects ? "/app/projetos" : null,
        }
      : null,
    projectEmpty: input.project
      ? null
      : {
          body: "Crie um projeto para aplicar o aprendizado ao seu próprio negócio.",
          href: "/app/projetos/novo",
          cta: "Criar meu projeto",
        },
    diagnostic: diagnosticBlock(input),
    tasks: taskBlock(input.tasks, input.project?.id ?? null, input.now),
    reminder: input.reminder ? reminderLine(input.reminder, new Date(input.now)) : null,
    recommended: input.recommended ? recommendedBlock(input.recommended) : null,
    shortcuts: [...SHORTCUTS],
  };
}

const PRIVATE_HOME_KEYS = ["email", "answers", "payload", "resultSnapshot", "password"] as const;

export function studentHomeHasPrivateKeys(view: StudentHomeView): boolean {
  return PRIVATE_HOME_KEYS.some((key) => key in view);
}

function continueBlock(current: HomeContinue): StudentHomeView["continue"] {
  if (current.kind === "start") {
    return {
      kind: "start",
      title: "Comece pelas aulas gratuitas.",
      detail: current.title,
      href: `/aulas/${current.slug || LESSON_01_SLUG}`,
      cta: "Começar Aula 1",
    };
  }
  if (current.kind === "resume") {
    const remaining = current.remainingMinutes == null ? null : `cerca de ${current.remainingMinutes} min restantes`;
    return {
      kind: "resume",
      title: current.title,
      detail: `${current.percent}%${remaining ? ` · ${remaining}` : ""}`,
      href: `/aulas/${current.slug}?continuar=1`,
      cta: "Continuar aula",
    };
  }
  return {
    kind: "done",
    title: `Você concluiu ${current.title}.`,
    detail: current.next?.title ?? null,
    href: current.next ? `/aulas/${current.next.slug}` : null,
    cta: current.next ? "Começar próxima aula" : null,
  };
}

function nextStepBlock(input: StudentHomeInput): StudentHomeView["nextStep"] {
  const next = input.next;
  if (next.kind === "none") return null;
  if (next.kind === "wait") {
    return {
      body: next.title ? `Agora, o melhor próximo passo é aguardar. ${next.title}` : "Agora, o melhor próximo passo é aguardar.",
      href: null,
      cta: null,
    };
  }
  if (next.kind === "diagnostic") {
    const href = input.project ? `/app/projetos/${input.project.id}/diagnostico` : "/app/projetos/novo";
    return { body: "Faça o diagnóstico do seu negócio.", href, cta: "Fazer diagnóstico" };
  }
  if (next.kind === "learn") {
    return { body: next.title, href: next.href, cta: "Abrir conteúdo" };
  }
  if (next.kind === "task" && input.project) {
    return { body: next.title, href: `/app/projetos/${input.project.id}/plano`, cta: "Ver plano completo" };
  }
  if ((next.kind === "execute" || next.kind === "analyze") && input.project) {
    return { body: next.title, href: `/app/projetos/${input.project.id}/plano`, cta: "Ver plano completo" };
  }
  return { body: "title" in next ? next.title : "", href: null, cta: null };
}

function diagnosticBlock(input: StudentHomeInput): StudentHomeView["diagnostic"] {
  if (!input.project || input.diagnostic === "none") {
    return {
      body: "Descubra se seu negócio está pronto para anunciar.",
      href: input.project ? `/app/projetos/${input.project.id}/diagnostico` : "/app/projetos/novo",
      cta: "Fazer diagnóstico",
    };
  }
  if (input.diagnostic === "in_progress") {
    return {
      body: "O diagnóstico deste projeto está em andamento.",
      href: `/app/projetos/${input.project.id}/diagnostico`,
      cta: "Continuar diagnóstico",
    };
  }
  return {
    body: input.project.score == null ? "Diagnóstico concluído." : `Último diagnóstico: ${input.project.score}/100.`,
    href: `/app/projetos/${input.project.id}`,
    cta: "Ver projeto",
  };
}

function taskBlock(tasks: HomeTask[], projectId: string | null, now: string): StudentHomeView["tasks"] {
  if (!projectId) return null;
  const picked = pickHomeTasks(tasks, new Date(now));
  if (picked.length === 0) return null;
  return {
    items: picked.map((task) => task.title),
    href: `/app/projetos/${projectId}/plano`,
    cta: "Ver plano completo",
  };
}

function recommendedBlock(lesson: HomeRecommendationLesson): StudentHomeView["recommended"] {
  const access = recommendedAccess(lesson);
  return {
    title: lesson.title,
    reason: lesson.reason,
    href: `/aulas/${lesson.slug}`,
    label: access.label,
    note: access.note,
  };
}

function startOfUtcDay(time: number): number {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
  return Date.parse(`${key}T00:00:00.000Z`);
}
