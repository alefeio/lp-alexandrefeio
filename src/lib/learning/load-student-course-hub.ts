import { getPrisma } from "@/lib/db/prisma";
import { listPublishedCourses } from "@/lib/learning/catalog";
import { knownLandingStatus, lessonStudyFromRecord } from "@/lib/learning/course-journey";
import { buildStudentCourseHub, type StudentCourseHub } from "@/lib/learning/student-course-hub";

/** Lê todos os cursos publicados do catálogo. Não grava progresso nem landing page. */
export async function loadStudentCourseHub(userId: string): Promise<StudentCourseHub> {
  const courses = await listPublishedCourses();
  const lessonIds = courses.flatMap((course) => course.modules.flatMap((moduleRow) => moduleRow.lessons.map((lesson) => lesson.id)));
  const courseIds = courses.map((course) => course.id);
  const prisma = getPrisma();
  const [progress, entitlements, landing] = await Promise.all([
    lessonIds.length === 0
      ? []
      : prisma.lessonProgress.findMany({
          where: { userId, lessonId: { in: lessonIds } },
          select: { lessonId: true, completedAt: true, lastActiveAt: true },
        }),
    lessonIds.length === 0
      ? []
      : prisma.entitlement.findMany({
          where: { userId, status: "ACTIVE", lessonId: { in: lessonIds } },
          select: { lessonId: true },
        }),
    courseIds.length === 0
      ? []
      : prisma.landingPageProject.findMany({
          where: { userId, courseId: { in: courseIds } },
          select: { id: true, title: true, userId: true, courseId: true, status: true, publishedPublicationId: true, updatedAt: true },
        }),
  ]);
  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  const entitled = new Set(entitlements.map((row) => row.lessonId));

  return buildStudentCourseHub({
    viewerId: userId,
    courses: courses.map((course) => ({
      course: {
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
      },
      modules: course.modules.map((moduleRow) => ({
        id: moduleRow.id,
        slug: moduleRow.slug,
        title: moduleRow.title,
        description: moduleRow.description,
        lessons: moduleRow.lessons.map((lesson) => {
          const row = progressByLesson.get(lesson.id);
          const study = lessonStudyFromRecord(row ? { completedAt: row.completedAt } : null);
          return {
            id: lesson.id,
            slug: lesson.slug,
            title: lesson.title,
            summary: lesson.summary,
            accessType: lesson.accessType,
            entitled: entitled.has(lesson.id),
            completed: study === "completed",
            inProgress: study === "in_progress",
            lastActiveAt: row?.lastActiveAt ?? null,
            resultSaved: false,
          };
        }),
      })),
      landingPages: landing.flatMap((page) => {
        if (page.courseId !== course.id) return [];
        const status = knownLandingStatus(page.status);
        if (status === "none") return [];
        return [
          {
            id: page.id,
            title: page.title,
            userId: page.userId,
            status,
            publishedPublicationId: page.publishedPublicationId,
            updatedAt: page.updatedAt,
          },
        ];
      }),
    })),
  });
}
