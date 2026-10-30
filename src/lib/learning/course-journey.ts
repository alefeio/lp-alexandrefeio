import { courseExperience, TRAFFIC_COURSE_SLUG, type CourseExperience } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

/** Aula em que a landing page pode ir ao ar. Espelha o fluxo de publicação, sem copiar o catálogo. */
export const JOURNEY_PUBLICATION_LESSON_SLUG = "revisao-antes-do-trafego";

export type JourneyStudy = "not_started" | "in_progress" | "completed";
export type JourneyAccess = "free" | "owned" | "locked";
export type JourneyPhaseStatus = "not_started" | "in_progress" | "available_complete" | "completed";
export type JourneyCourseStatus = "not_started" | "in_progress" | "available_complete" | "lessons_complete";
export type LandingPageJourneyState = "none" | "DRAFT" | "READY_TO_PREVIEW" | "PUBLISHED" | "UNPUBLISHED";

export type JourneyLessonInput = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  accessType: "FREE" | "PAID";
  entitled: boolean;
  completed: boolean;
  inProgress: boolean;
  lastActiveAt: Date | null;
  resultSaved: boolean;
};

export type JourneyModuleInput = {
  id: string;
  title: string;
  description: string;
  lessons: JourneyLessonInput[];
};

export type LandingPageJourneyInput = {
  id: string;
  title: string;
  userId: string;
  status: Exclude<LandingPageJourneyState, "none">;
  publishedPublicationId: string | null;
  updatedAt: Date;
};

export type CourseLandingPicture = {
  published: boolean;
  state: LandingPageJourneyState;
  label: string;
};

export type CourseJourneySource = {
  viewerId: string;
  course: {
    slug: string;
    title: string;
    subtitle: string | null;
    description: string;
  };
  modules: JourneyModuleInput[];
  landingPages: LandingPageJourneyInput[];
};

export type JourneyAction = { label: string; href: string };

export type CourseJourneyView = {
  slug: string;
  title: string;
  promise: string;
  finalOutcome: string;
  outcomeNote: string | null;
  moduleCount: number;
  publishedLessonCount: number;
  completedLessonCount: number;
  accessibleLessonCount: number;
  accessibleCompletedCount: number;
  progressLabel: string;
  accessLabel: string | null;
  status: JourneyCourseStatus;
  statusLabel: string;
  coursePromiseMet: boolean;
  campaignExecuted: false;
  sequentialGate: false;
  independenceNote: string | null;
  sharedProjectNote: string | null;
  primary: JourneyAction | null;
  here: { phaseTitle: string; lessonTitle: string; detail: string; href: string; linkLabel: string } | null;
  landing: CourseLandingPicture | null;
  artifacts: Array<{ id: string; title: string; label: string; produced: boolean }>;
  phases: Array<{
    id: string;
    index: number;
    title: string;
    objective: string;
    status: JourneyPhaseStatus;
    statusLabel: string;
    current: boolean;
    deliverables: string[];
    action: JourneyAction | null;
    lessons: Array<{
      id: string;
      title: string;
      statusLabel: string;
      current: boolean;
      href: string;
      cta: string;
    }>;
  }>;
};

const COURSE_STATUS_LABEL: Record<JourneyCourseStatus, string> = {
  not_started: "Não iniciado",
  in_progress: "Em andamento",
  available_complete: "Aulas disponíveis concluídas",
  lessons_complete: "Aulas publicadas concluídas",
};

const PHASE_STATUS_LABEL: Record<JourneyPhaseStatus, string> = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  available_complete: "Aulas disponíveis concluídas",
  completed: "Concluída",
};

/** Conclusão vem só de completedAt. Percentual e último bloco não concluem a aula. */
export function lessonStudyFromRecord(record: { completedAt: Date | null } | null): JourneyStudy {
  if (!record) return "not_started";
  if (record.completedAt) return "completed";
  return "in_progress";
}

/** Projeto de outro aluno não entra na jornada. READY_TO_PREVIEW não é publicação. */
export function knownLandingStatus(status: string): LandingPageJourneyState {
  if (status === "DRAFT" || status === "READY_TO_PREVIEW" || status === "PUBLISHED" || status === "UNPUBLISHED") return status;
  return "none";
}

function isActivePublication(page: LandingPageJourneyInput): boolean {
  return page.status === "PUBLISHED" && page.publishedPublicationId != null;
}

/** Publicação do curso: qualquer página ativa conta. Sem publicação, o contexto é só o projeto mais recente. */
export function courseLandingPicture(viewerId: string, pages: readonly LandingPageJourneyInput[]): CourseLandingPicture {
  const owned = pages.filter((page) => page.userId === viewerId);
  if (owned.length === 0) {
    return { published: false, state: "none", label: "Você ainda não começou uma landing page neste curso." };
  }
  const published = owned.some(isActivePublication);
  const latest = [...owned].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];
  if (!latest) return { published: false, state: "none", label: "Você ainda não começou uma landing page neste curso." };
  if (published) {
    return { published: true, state: "PUBLISHED", label: publishedCourseLabel(latest) };
  }
  const state = latest.status === "DRAFT" || latest.status === "READY_TO_PREVIEW" ? latest.status : "UNPUBLISHED";
  return { published: false, state, label: unpublishedLatestLabel(state) };
}

type FlatLesson = JourneyLessonInput & {
  phaseId: string;
  phaseTitle: string;
  phaseIndex: number;
  study: JourneyStudy;
  access: JourneyAccess;
  outcome: string | null;
};

export function buildCourseJourney(source: CourseJourneySource): CourseJourneyView | null {
  if (!source.course.slug) return null;
  const experience = courseExperience(source.course.slug);
  const lessons = flatten(source.modules, experience);
  if (lessons.length === 0) return null;

  const sites = source.course.slug === SITES_COURSE_SLUG;
  const traffic = source.course.slug === TRAFFIC_COURSE_SLUG;
  const landing = sites ? courseLandingPicture(source.viewerId, source.landingPages) : null;

  const publishedLessonCount = lessons.length;
  const completedLessonCount = lessons.filter((lesson) => lesson.study === "completed").length;
  const accessible = lessons.filter((lesson) => lesson.access !== "locked");
  const accessibleCompletedCount = accessible.filter((lesson) => lesson.study === "completed").length;
  const started = lessons.some((lesson) => lesson.study !== "not_started");
  const lessonsComplete = completedLessonCount === publishedLessonCount;
  const availableComplete = accessible.length > 0 && accessibleCompletedCount === accessible.length && !lessonsComplete;
  const status: JourneyCourseStatus = lessonsComplete
    ? "lessons_complete"
    : availableComplete
      ? "available_complete"
      : started
        ? "in_progress"
        : "not_started";

  const position = pickPosition(lessons, status, sites, landing?.published ?? false);
  const phases = source.modules.map((moduleRow, index) => {
    const phaseLessons = lessons.filter((lesson) => lesson.phaseId === moduleRow.id);
    const phaseStatus = phaseStatusOf(phaseLessons);
    const phasePosition = pickPosition(phaseLessons, phaseStatus === "completed" ? "lessons_complete" : phaseStatus === "available_complete" ? "available_complete" : phaseStatus === "in_progress" ? "in_progress" : "not_started", false, false);
    return {
      id: moduleRow.id,
      index,
      title: moduleRow.title,
      objective: phaseObjective(moduleRow.description, phaseLessons),
      status: phaseStatus,
      statusLabel: PHASE_STATUS_LABEL[phaseStatus],
      current: position?.lesson.phaseId === moduleRow.id,
      deliverables: phaseLessons.map((lesson) => lesson.outcome ?? "Esta aula não declara um entregável específico."),
      action: phasePosition ? { label: phasePosition.linkLabel, href: phasePosition.lessonHref } : null,
      lessons: phaseLessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        statusLabel: lessonStatusLabel(lesson),
        current: position?.lesson.id === lesson.id,
        href: lessonHref(lesson),
        cta: lessonCta(lesson),
      })),
    };
  });

  const promise = experience?.transformation ?? (source.course.subtitle?.trim() || firstSentence(source.course.description));
  const coursePromiseMet = traffic ? lessonsComplete : sites ? lessonsComplete && landing?.published === true : lessonsComplete;

  return {
    slug: source.course.slug,
    title: source.course.title,
    promise,
    finalOutcome: experience?.shortOutcome ?? promise,
    outcomeNote: outcomeNote(traffic, sites, lessonsComplete, landing?.published === true),
    moduleCount: source.modules.length,
    publishedLessonCount,
    completedLessonCount,
    accessibleLessonCount: accessible.length,
    accessibleCompletedCount,
    progressLabel: `${completedLessonCount} de ${publishedLessonCount} ${publishedLessonCount === 1 ? "aula publicada" : "aulas publicadas"}`,
    accessLabel:
      accessible.length < publishedLessonCount
        ? accessible.length === 0
          ? "Nenhuma aula acessível ainda"
          : `${accessibleCompletedCount} de ${accessible.length} ${accessible.length === 1 ? "aula acessível" : "aulas acessíveis"}`
        : null,
    status,
    statusLabel: COURSE_STATUS_LABEL[status],
    coursePromiseMet,
    campaignExecuted: false,
    sequentialGate: false,
    independenceNote: traffic
      ? "Google e Meta são caminhos recomendados. Nenhum deles trava o outro."
      : null,
    sharedProjectNote: sites
      ? "Cada landing page é um projeto separado. Ao continuar uma página, as ferramentas das etapas seguintes trabalham sobre esse mesmo projeto."
      : null,
    primary: position ? { label: position.primaryLabel, href: position.lessonHref } : null,
    here: position
      ? {
          phaseTitle: position.lesson.phaseTitle,
          lessonTitle: position.lesson.title,
          detail: position.detail,
          href: position.lessonHref,
          linkLabel: position.linkLabel,
        }
      : null,
    landing,
    artifacts: lessons.map((lesson) => artifactOf(lesson, sites, landing)),
    phases,
  };
}

function flatten(modules: JourneyModuleInput[], experience: CourseExperience | null): FlatLesson[] {
  const outcomes = new Map(experience?.lessons.map((lesson) => [lesson.slug, lesson.outcome]) ?? []);
  return modules.flatMap((moduleRow, phaseIndex) =>
    moduleRow.lessons.map((lesson) => {
      const study: JourneyStudy = lesson.completed ? "completed" : lesson.inProgress ? "in_progress" : "not_started";
      const access: JourneyAccess = lesson.accessType === "FREE" ? "free" : lesson.entitled ? "owned" : "locked";
      return {
        ...lesson,
        phaseId: moduleRow.id,
        phaseTitle: moduleRow.title,
        phaseIndex,
        study,
        access,
        outcome: outcomes.get(lesson.slug) ?? null,
      };
    }),
  );
}

function phaseStatusOf(lessons: FlatLesson[]): JourneyPhaseStatus {
  if (lessons.length === 0) return "not_started";
  if (lessons.every((lesson) => lesson.study === "completed")) return "completed";
  const accessible = lessons.filter((lesson) => lesson.access !== "locked");
  const accessibleDone = accessible.length > 0 && accessible.every((lesson) => lesson.study === "completed");
  if (accessibleDone && accessible.length < lessons.length) return "available_complete";
  if (lessons.some((lesson) => lesson.study !== "not_started")) return "in_progress";
  return "not_started";
}

type Position = {
  lesson: FlatLesson;
  primaryLabel: string;
  linkLabel: string;
  lessonHref: string;
  detail: string;
};

function pickPosition(
  lessons: FlatLesson[],
  status: JourneyCourseStatus,
  sites: boolean,
  landingPublished: boolean,
): Position | null {
  if (lessons.length === 0) return null;
  const resume = [...lessons]
    .filter((lesson) => lesson.access !== "locked" && lesson.study === "in_progress")
    .sort((left, right) => {
      const leftTime = left.lastActiveAt?.getTime() ?? 0;
      const rightTime = right.lastActiveAt?.getTime() ?? 0;
      if (rightTime !== leftTime) return rightTime - leftTime;
      return lessons.indexOf(left) - lessons.indexOf(right);
    })[0];
  if (resume) {
    return place(resume, "Continuar de onde parei", "Continuar", "Retome esta aula. O próximo passo é o ponto em que você parou.");
  }

  const next = lessons.find((lesson) => lesson.access !== "locked" && lesson.study !== "completed");
  if (next) {
    const fresh = lessons.every((lesson) => lesson.study === "not_started");
    return place(
      next,
      fresh ? "Começar" : "Continuar de onde parei",
      fresh ? "Começar" : "Continuar",
      fresh ? "Este é o primeiro passo disponível nesta jornada." : "A próxima aula disponível segue o que você já concluiu.",
    );
  }

  const pendingLocked = lessons.find((lesson) => lesson.access === "locked" && lesson.study !== "completed");
  if (pendingLocked && status !== "lessons_complete") {
    const finishedAccessible = lessons.some((lesson) => lesson.access !== "locked" && lesson.study === "completed");
    return place(
      pendingLocked,
      "Ver a prévia da próxima aula",
      "Ver prévia",
      finishedAccessible
        ? "As aulas que você já pode abrir estão concluídas. O restante continua sem acesso."
        : "Esta aula ainda não foi adquirida. A prévia não abre o conteúdo pago.",
    );
  }

  const publication = sites && !landingPublished ? lessons.find((lesson) => lesson.slug === JOURNEY_PUBLICATION_LESSON_SLUG) : null;
  const review = publication ?? lessons[lessons.length - 1];
  if (!review) return null;
  const unpublished = sites && !landingPublished;
  return place(
    review,
    unpublished ? "Revisar a publicação" : "Revisar",
    unpublished ? "Revisar a publicação" : "Revisar",
    unpublished
      ? "As aulas publicadas estão concluídas. A landing page ainda não está no ar."
      : "Você concluiu as aulas publicadas desta visão.",
  );
}

function place(lesson: FlatLesson, primaryLabel: string, linkLabel: string, detail: string): Position {
  return { lesson, primaryLabel, linkLabel, lessonHref: lessonHref(lesson), detail };
}

function lessonHref(lesson: FlatLesson): string {
  if (lesson.access === "locked") return `/aulas/${lesson.slug}`;
  if (lesson.study === "in_progress") return `/aulas/${lesson.slug}?continuar=1`;
  return `/aulas/${lesson.slug}`;
}

function lessonCta(lesson: FlatLesson): string {
  if (lesson.access === "locked") return "Ver prévia";
  if (lesson.study === "in_progress") return "Continuar";
  if (lesson.study === "completed") return "Revisar";
  return "Começar";
}

function lessonStatusLabel(lesson: FlatLesson): string {
  const access = lesson.access === "free" ? "Gratuita" : lesson.access === "owned" ? "Adquirida" : "Não adquirida";
  if (lesson.study === "completed") return `Concluída · ${access}`;
  if (lesson.study === "in_progress") return `Em andamento · ${access}`;
  return access;
}

function phaseObjective(description: string, lessons: FlatLesson[]): string {
  const text = description.trim();
  if (text) return text;
  const outcome = lessons.find((lesson) => lesson.outcome)?.outcome;
  if (outcome) return `Nesta fase, um resultado esperado é: ${outcome}.`;
  return "As aulas publicadas desta fase aparecem abaixo.";
}

function artifactOf(lesson: FlatLesson, sites: boolean, landing: CourseLandingPicture | null): { id: string; title: string; label: string; produced: boolean } {
  const title = lesson.outcome ?? "Esta aula não declara um entregável específico.";
  const publication = sites && lesson.slug === JOURNEY_PUBLICATION_LESSON_SLUG;
  if (publication && landing) {
    if (landing.published) return { id: lesson.id, title, label: "Landing page publicada", produced: true };
    if (landing.state === "READY_TO_PREVIEW") return { id: lesson.id, title, label: "Pronta para visualizar, ainda não publicada", produced: false };
    if (landing.state === "DRAFT") return { id: lesson.id, title, label: "Rascunho salvo, ainda não publicada", produced: false };
    if (landing.state === "UNPUBLISHED") return { id: lesson.id, title, label: "Fora do ar", produced: false };
  }
  if (lesson.resultSaved) return { id: lesson.id, title, label: "Resultado salvo", produced: false };
  if (lesson.study === "completed") return { id: lesson.id, title, label: "Aula concluída", produced: false };
  return { id: lesson.id, title, label: "Resultado esperado", produced: false };
}

function publishedCourseLabel(latest: LandingPageJourneyInput): string {
  const base = "Você já publicou uma landing page neste curso.";
  if (isActivePublication(latest)) return base;
  if (latest.status === "DRAFT") return `${base} O projeto mais recente ainda é um rascunho.`;
  if (latest.status === "READY_TO_PREVIEW") return `${base} O projeto mais recente está pronto para visualizar.`;
  return `${base} O projeto mais recente está fora do ar.`;
}

function unpublishedLatestLabel(state: "DRAFT" | "READY_TO_PREVIEW" | "UNPUBLISHED"): string {
  if (state === "DRAFT") return "O projeto mais recente é um rascunho. Nenhuma landing page deste curso está publicada.";
  if (state === "READY_TO_PREVIEW") return "O projeto mais recente está pronto para visualizar. Isso ainda não é uma publicação.";
  return "O projeto mais recente está fora do ar. Nenhuma landing page deste curso está publicada.";
}

function outcomeNote(traffic: boolean, sites: boolean, lessonsComplete: boolean, landingPublished: boolean): string | null {
  if (traffic) return "Concluir as aulas não registra uma campanha executada.";
  if (sites && landingPublished) return "Você já publicou uma landing page neste curso.";
  if (sites && lessonsComplete) return "As aulas publicadas estão concluídas. Nenhuma landing page deste curso está publicada.";
  return null;
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end === -1 ? trimmed : trimmed.slice(0, end + 1);
}
