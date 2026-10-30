import { buildCourseJourney, type CourseJourneySource, type CourseJourneyView } from "@/lib/learning/course-journey";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export type StudentCourseCard = {
  slug: string;
  title: string;
  promise: string;
  moduleCount: number;
  publishedLessonCount: number;
  completedLessonCount: number;
  accessibleLessonCount: number;
  status: CourseJourneyView["status"];
  statusLabel: string;
  progressLabel: string;
  positionLabel: string | null;
  accessNote: string | null;
  ctaLabel: string;
  href: string;
};

export type StudentCourseHub = {
  title: string;
  subtitle: string;
  courses: StudentCourseCard[];
};

export type StudentCourseHubSource = {
  viewerId: string;
  courses: Array<Omit<CourseJourneySource, "viewerId">>;
};

/** Hub de cursos. Reusa a jornada e não cria outra regra de conclusão. */
export function buildStudentCourseHub(source: StudentCourseHubSource): StudentCourseHub {
  return {
    title: "Meus cursos",
    subtitle: "Escolha um curso para continuar sua jornada ou conhecer um novo caminho.",
    courses: source.courses.flatMap((course) => {
      const view = buildCourseJourney({ viewerId: source.viewerId, ...course });
      return view ? [cardFrom(view)] : [];
    }),
  };
}

function cardFrom(view: CourseJourneyView): StudentCourseCard {
  const publicationPending = view.slug === SITES_COURSE_SLUG && view.status === "lessons_complete" && view.landing?.published !== true;
  return {
    slug: view.slug,
    title: view.title,
    promise: view.finalOutcome,
    moduleCount: view.moduleCount,
    publishedLessonCount: view.publishedLessonCount,
    completedLessonCount: view.completedLessonCount,
    accessibleLessonCount: view.accessibleLessonCount,
    status: view.status,
    statusLabel: hubStatusLabel(view, publicationPending),
    progressLabel: `${view.completedLessonCount} de ${view.publishedLessonCount} aulas concluídas`,
    positionLabel:
      view.status === "in_progress" && view.here ? `Você está em: ${view.here.phaseTitle} · ${view.here.lessonTitle}` : null,
    accessNote: view.accessLabel,
    ctaLabel: hubCta(view.status),
    href: `/app/cursos/${view.slug}`,
  };
}

function hubStatusLabel(view: CourseJourneyView, publicationPending: boolean): string {
  if (view.status === "not_started") return "Ainda não iniciado";
  if (view.status === "in_progress") return "Em andamento";
  if (view.status === "available_complete") return "Você concluiu as aulas que possui";
  if (publicationPending) return "Aulas concluídas · publicação pendente";
  return "Aulas concluídas";
}

function hubCta(status: CourseJourneyView["status"]): string {
  if (status === "not_started") return "Conhecer curso";
  if (status === "in_progress") return "Continuar curso";
  if (status === "available_complete") return "Ver jornada";
  return "Revisar curso";
}
