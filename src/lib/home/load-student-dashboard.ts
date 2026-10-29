import { getPrisma } from "@/lib/db/prisma";
import { homeBelongsToViewer } from "@/lib/home/public-home";
import {
  buildStudentDashboard,
  type DashboardBuildInput,
  type DashboardLesson,
  type StudentCourseInput,
  type StudentDashboardViewModel,
} from "@/lib/home/student-dashboard";
import { listPublishedCourses } from "@/lib/learning/catalog";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";
import { chooseNextAction } from "@/lib/plan/next-action";

const OPEN = ["TODO", "IN_PROGRESS"] as const;

export async function loadStudentDashboard(userId: string, name: string, now = new Date()): Promise<StudentDashboardViewModel> {
  const prisma = getPrisma();
  const [publishedCourses, progress, project, entitlements, resultRows, importRows] = await Promise.all([
    listPublishedCourses(),
    prisma.lessonProgress.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
      select: {
        lessonId: true,
        percent: true,
        completedAt: true,
        lesson: { select: { slug: true, title: true } },
      },
    }),
    prisma.project.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        diagnostics: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, completedAt: true },
        },
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            type: true,
            priority: true,
            title: true,
            lesson: { select: { id: true, slug: true, title: true, status: true } },
            tasks: { where: { status: { in: [...OPEN] } }, select: { id: true } },
          },
        },
        tasks: {
          where: { status: { in: [...OPEN] } },
          select: { id: true, title: true, status: true, priority: true, dueAt: true, updatedAt: true },
          take: 20,
        },
        reminders: {
          where: { dismissedAt: null },
          orderBy: { remindAt: "asc" },
          select: { id: true, type: true, title: true, remindAt: true, dismissedAt: true },
          take: 8,
        },
      },
    }),
    prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE" },
      select: { lessonId: true },
    }),
    prisma.lessonResult.findMany({
      where: { userId },
      select: { lessonId: true, lesson: { select: { slug: true } } },
      distinct: ["lessonId"],
    }),
    prisma.campaignDataImport.findMany({
      where: { userId, deletedAt: null, status: { not: "DELETED" } },
      select: { status: true },
      take: 40,
    }),
  ]);

  const entitled = new Set(entitlements.map((row) => row.lessonId));
  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  const courses: StudentCourseInput[] = publishedCourses.map((course) => {
    const flat = course.modules.flatMap((moduleRow) =>
      moduleRow.lessons.map((lesson) => ({ lesson, moduleTitle: moduleRow.title })),
    );
    return {
      slug: course.slug,
      title: course.title,
      lessons: flat.map((item, index) => toDashboardLesson(item.lesson, item.moduleTitle, index, entitled, progressByLesson)),
    };
  });
  const lessons = courses.find((course) => course.slug === FIRST_COURSE_SLUG)?.lessons ?? courses[0]?.lessons ?? [];

  const completedDiagnosticRow = project?.diagnostics.find((item) => item.status === "COMPLETED") ?? null;
  const completedDiagnostic = Boolean(completedDiagnosticRow);
  const inProgressDiagnostic = project?.diagnostics.some((item) => item.status === "IN_PROGRESS") ?? false;
  const diagnosticHref = !project
    ? null
    : completedDiagnosticRow
      ? `/app/projetos/${project.id}/diagnosticos/${completedDiagnosticRow.id}`
      : `/app/projetos/${project.id}/diagnostico`;
  const diagnosticCompletedLabel = completedDiagnosticRow?.completedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(completedDiagnosticRow.completedAt)
    : null;
  const nextAction = project
    ? chooseNextAction({
        tasks: project.tasks.map((task) => ({
          id: task.id,
          priority: task.priority,
          status: task.status,
          dueAt: task.dueAt,
          updatedAt: task.updatedAt,
        })),
        recommendations: project.recommendations.map((item) => ({
          id: item.id,
          priority: item.priority,
          type: item.type,
          hasActiveTask: item.tasks.length > 0,
        })),
        reminders: project.reminders.map((item) => ({
          id: item.id,
          type: item.type,
          remindAt: item.remindAt,
          dismissedAt: item.dismissedAt,
        })),
        hasCompletedDiagnostic: completedDiagnostic,
        now,
      })
    : ({ kind: "none" } as const);

  const operational = mapOperational(nextAction, project, progressByLesson);
  const planHint =
    project?.tasks[0]?.title ??
    project?.recommendations.find((item) => item.type !== "WAIT")?.title ??
    project?.reminders[0]?.title ??
    null;

  const input: DashboardBuildInput = {
    userId,
    name,
    lessons,
    project: project ? { id: project.id, name: project.name } : null,
    diagnostic: !project ? "none" : completedDiagnostic ? "completed" : inProgressDiagnostic ? "in_progress" : "none",
    importSummary: {
      total: importRows.length,
      ready: importRows.filter((row) => row.status === "READY").length,
    },
    resultSlugs: resultRows.map((row) => row.lesson.slug),
    planHint,
    courses,
    diagnosticHref,
    diagnosticCompletedLabel,
    operational,
  };

  const view = buildStudentDashboard(input);
  if (!homeBelongsToViewer(view.userId, userId)) throw new Error("DASHBOARD_OWNER_MISMATCH");
  return view;
}

function toDashboardLesson(
  lesson: { id: string; slug: string; title: string; accessType: "FREE" | "PAID" },
  moduleTitle: string,
  index: number,
  entitled: Set<string>,
  progressByLesson: { get(id: string): { percent: number; completedAt: Date | null } | undefined },
): DashboardLesson {
  const row = progressByLesson.get(lesson.id);
  const accessible = lesson.accessType === "FREE" || entitled.has(lesson.id);
  return {
    slug: lesson.slug,
    title: lesson.title,
    number: index + 1,
    moduleTitle,
    accessible,
    owned: lesson.accessType === "PAID" && entitled.has(lesson.id),
    completed: Boolean(row?.completedAt),
    inProgress: Boolean(row && !row.completedAt),
    percent: row?.percent ?? 0,
  };
}

function mapOperational(
  action: { kind: string; taskId?: string; recommendationId?: string; reminderId?: string },
  project: {
    tasks: { id: string; title: string }[];
    recommendations: {
      id: string;
      type: "LEARN" | "EXECUTE" | "ANALYZE" | "WAIT";
      title: string;
      lesson: { id: string; slug: string; title: string; status: string } | null;
    }[];
    reminders: { id: string; title: string }[];
  } | null,
  progressByLesson: Map<string, { percent: number; completedAt: Date | null }>,
): DashboardBuildInput["operational"] {
  if (!project || action.kind === "none") return { kind: "none" };
  if (action.kind === "diagnostic") return { kind: "diagnostic" };
  if (action.kind === "wait") {
    return {
      kind: "wait",
      title: project.reminders.find((item) => item.id === action.reminderId)?.title ?? "Revise quando houver dados novos.",
    };
  }
  if (action.kind === "task") {
    return {
      kind: "task",
      title: project.tasks.find((item) => item.id === action.taskId)?.title ?? "Continue o plano.",
    };
  }
  const recommendation = project.recommendations.find((item) => item.id === action.recommendationId);
  if (!recommendation) return { kind: "none" };
  const lessonProgress = recommendation.lesson ? progressByLesson.get(recommendation.lesson.id) : null;
  return {
    kind: "recommendation",
    recommendationType: recommendation.type,
    title: recommendation.title,
    lessonSlug: recommendation.lesson?.status === "PUBLISHED" ? recommendation.lesson.slug : null,
    lessonTitle: recommendation.lesson?.title ?? null,
    lessonPercent: lessonProgress && !lessonProgress.completedAt ? lessonProgress.percent : null,
  };
}
