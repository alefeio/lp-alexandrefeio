import { isCommerceEnabled, isProductForSale } from "@/lib/commerce/config";
import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { getPrisma } from "@/lib/db/prisma";
import { homeBelongsToViewer } from "@/lib/home/public-home";
import { buildStudentHome, firstGivenName, type HomeNext, type HomeTask, type StudentHomeView } from "@/lib/home/student-home";
import { adjacentLessons, getPublishedCourse } from "@/lib/learning/catalog";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";
import { LESSON_01_SLUG, lesson01Meta } from "@/lib/learning/lesson-01";
import { remainingMinutes } from "@/lib/learning/progress";
import { chooseNextAction } from "@/lib/plan/next-action";

const OPEN = ["TODO", "IN_PROGRESS"] as const;

export async function loadStudentHome(userId: string, name: string, now = new Date()): Promise<StudentHomeView> {
  const prisma = getPrisma();
  const commerce = isCommerceEnabled();
  const [course, progress, project, projectCount, entitlements] = await Promise.all([
    getPublishedCourse(FIRST_COURSE_SLUG),
    prisma.lessonProgress.findMany({
      where: { userId },
      orderBy: { lastActiveAt: "desc" },
      select: {
        lessonId: true,
        percent: true,
        completedAt: true,
        lastActiveAt: true,
        lesson: { select: { slug: true, title: true, estimatedMinutes: true, accessType: true, status: true } },
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
          select: { status: true, overallScore: true, primaryBottleneck: true },
        },
        recommendations: {
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            type: true,
            priority: true,
            title: true,
            description: true,
            lesson: {
              select: {
                id: true,
                slug: true,
                title: true,
                accessType: true,
                status: true,
                commerceStatus: true,
                priceCents: true,
                publicPreview: true,
              },
            },
            tasks: { where: { status: { in: [...OPEN] } }, select: { id: true } },
          },
        },
        tasks: {
          where: { status: { in: [...OPEN] } },
          select: { id: true, title: true, status: true, priority: true, dueAt: true, updatedAt: true },
        },
        reminders: {
          where: { dismissedAt: null },
          orderBy: { remindAt: "asc" },
          select: { id: true, type: true, title: true, remindAt: true, dismissedAt: true },
        },
      },
    }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE" },
      select: { lessonId: true },
    }),
  ]);

  const entitled = new Set(entitlements.map((row) => row.lessonId));
  const lessons = course?.modules.flatMap((moduleRow) => moduleRow.lessons) ?? [];
  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  let completedCount = 0;
  let inProgressCount = 0;
  let openCount = 0;
  let lockedCount = 0;
  for (const lesson of lessons) {
    const row = progressByLesson.get(lesson.id);
    if (row?.completedAt) completedCount += 1;
    else if (row) inProgressCount += 1;
    else if (lesson.accessType === "FREE" || entitled.has(lesson.id)) openCount += 1;
    else lockedCount += 1;
  }

  const resume = progress.find((row) => !row.completedAt && row.lesson.status === "PUBLISHED");
  const done = progress.find((row) => row.completedAt && row.lesson.status === "PUBLISHED");
  const first = lessons.find((lesson) => lesson.slug === LESSON_01_SLUG) ?? lessons.find((lesson) => lesson.accessType === "FREE");
  const continueLesson = resume
    ? {
        kind: "resume" as const,
        slug: resume.lesson.slug,
        title: resume.lesson.title,
        percent: resume.percent,
        remainingMinutes: remainingMinutes(resume.lesson.estimatedMinutes, resume.percent, false),
      }
    : done
      ? {
          kind: "done" as const,
          title: done.lesson.title,
          next: await nextPublished(done.lesson.slug),
        }
      : {
          kind: "start" as const,
          slug: first?.slug ?? LESSON_01_SLUG,
          title: first?.title ?? lesson01Meta.title,
        };

  const completedDiagnostic = project?.diagnostics.find((item) => item.status === "COMPLETED") ?? null;
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
        hasCompletedDiagnostic: Boolean(completedDiagnostic),
        now,
      })
    : ({ kind: "none" } as const);

  const next = mapNext(nextAction.kind === "none" && !project ? { kind: "none" } : nextAction, project);
  const learn = project?.recommendations.find((item) => item.type === "LEARN" && item.lesson?.status === "PUBLISHED");
  const recommended = learn?.lesson
    ? {
        slug: learn.lesson.slug,
        title: learn.lesson.title,
        access: learn.lesson.accessType,
        commerce: learn.lesson.commerceStatus,
        entitled: learn.lesson.accessType === "FREE" || entitled.has(learn.lesson.id),
        forSale: isProductForSale(learn.lesson.commerceStatus, learn.lesson.priceCents, commerce),
        reason: clip(learn.description),
      }
    : null;

  const tasks: HomeTask[] = (project?.tasks ?? []).map((task) => ({
    title: task.title,
    status: task.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO",
    priority: task.priority,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
  }));
  const upcoming = project?.reminders[0];

  const view = buildStudentHome({
    userId,
    firstName: firstGivenName(name),
    courseTitle: course?.title ?? "Tráfego Pago na Prática",
    continue: continueLesson,
    completedCount,
    inProgressCount,
    openCount,
    lockedCount,
    project: project
      ? {
          id: project.id,
          name: project.name,
          score: completedDiagnostic?.overallScore ?? null,
          bottleneck: completedDiagnostic ? dimensionLabel(knownDimension(completedDiagnostic.primaryBottleneck)) : null,
          recommendation: project.recommendations[0]?.title ?? null,
          otherProjects: projectCount > 1,
        }
      : null,
    diagnostic: !project ? "none" : completedDiagnostic ? "completed" : project.diagnostics.some((item) => item.status === "IN_PROGRESS") ? "in_progress" : "none",
    next,
    tasks,
    reminder: upcoming ? { title: upcoming.title, remindAt: upcoming.remindAt.toISOString() } : null,
    recommended,
    now: now.toISOString(),
  });
  if (!homeBelongsToViewer(view.userId, userId)) throw new Error("HOME_OWNER_MISMATCH");
  return view;
}

async function nextPublished(slug: string): Promise<{ slug: string; title: string } | null> {
  const neighbors = await adjacentLessons(FIRST_COURSE_SLUG, slug);
  return neighbors.next;
}

function mapNext(
  action: { kind: string; taskId?: string; recommendationId?: string; reminderId?: string },
  project: {
    id: string;
    tasks: { id: string; title: string }[];
    recommendations: { id: string; type: string; title: string; lesson: { slug: string; status: string } | null }[];
    reminders: { id: string; title: string }[];
  } | null,
): HomeNext {
  if (!project || action.kind === "none") return { kind: "none" };
  if (action.kind === "diagnostic") return { kind: "diagnostic" };
  if (action.kind === "wait") {
    return { kind: "wait", title: project.reminders.find((item) => item.id === action.reminderId)?.title ?? null };
  }
  if (action.kind === "task") {
    return { kind: "task", title: project.tasks.find((item) => item.id === action.taskId)?.title ?? "Continue o plano." };
  }
  const recommendation = project.recommendations.find((item) => item.id === action.recommendationId);
  if (!recommendation) return { kind: "none" };
  if (recommendation.type === "LEARN" && recommendation.lesson?.status === "PUBLISHED") {
    return { kind: "learn", title: recommendation.title, href: `/aulas/${recommendation.lesson.slug}` };
  }
  if (recommendation.type === "ANALYZE") return { kind: "analyze", title: recommendation.title };
  if (recommendation.type === "WAIT") return { kind: "wait", title: recommendation.title };
  return { kind: "execute", title: recommendation.title };
}

function clip(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= 180) return clean;
  return `${clean.slice(0, 177).trimEnd()}…`;
}
