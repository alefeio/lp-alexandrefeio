import { getPrisma } from "@/lib/db/prisma";
import { getPublishedCourse, sectionTitlesFor } from "@/lib/learning/catalog";
import { selectCourseMaterial, type CourseMaterial } from "@/lib/learning/course-material";
import {
  buildCourseJourney,
  knownLandingStatus,
  lessonStudyFromRecord,
  type CourseJourneyView,
} from "@/lib/learning/course-journey";

export type LoadedCourseJourney = {
  view: CourseJourneyView;
  material: CourseMaterial;
};

/** Lê a jornada do aluno autenticado. Não grava progresso, resultado nem landing page. */
export async function loadCourseJourney(userId: string, slug: string): Promise<LoadedCourseJourney | null> {
  const course = await getPublishedCourse(slug);
  if (!course) return null;
  const lessonIds = course.modules.flatMap((moduleRow) => moduleRow.lessons.map((lesson) => lesson.id));
  if (lessonIds.length === 0) return null;
  const prisma = getPrisma();
  const [progress, entitlements, results, landing, notes, bookmarks] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, completedAt: true, lastActiveAt: true },
    }),
    prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE", lessonId: { in: lessonIds } },
      select: { lessonId: true },
    }),
    prisma.lessonResult.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true },
    }),
    prisma.landingPageProject.findMany({
      where: { userId, courseId: course.id },
      select: { id: true, title: true, userId: true, status: true, publishedPublicationId: true, updatedAt: true },
    }),
    prisma.lessonNote.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, lessonId: true, blockKey: true, body: true, lesson: { select: { slug: true, title: true } } },
    }),
    prisma.lessonBookmark.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, lessonId: true, blockKey: true, lesson: { select: { slug: true, title: true } } },
    }),
  ]);
  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  const entitled = new Set(entitlements.map((row) => row.lessonId));
  const saved = new Set(results.map((row) => row.lessonId));

  const sectionTitles = await sectionTitlesFor([
    ...notes.map((note) => ({ lessonId: note.lessonId, blockKey: note.blockKey })),
    ...bookmarks.map((bookmark) => ({ lessonId: bookmark.lessonId, blockKey: bookmark.blockKey })),
  ]);
  const view = buildCourseJourney({
    viewerId: userId,
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
          resultSaved: saved.has(lesson.id),
        };
      }),
    })),
    landingPages: landing.flatMap((page) => {
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
  });
  if (!view) return null;
  return {
    view,
    material: selectCourseMaterial(
      new Set(lessonIds),
      notes.map((note) => ({
        id: note.id,
        lessonId: note.lessonId,
        lessonSlug: note.lesson.slug,
        lessonTitle: note.lesson.title,
        blockKey: note.blockKey,
        body: note.body,
      })),
      bookmarks.map((bookmark) => ({
        id: bookmark.id,
        lessonId: bookmark.lessonId,
        lessonSlug: bookmark.lesson.slug,
        lessonTitle: bookmark.lesson.title,
        blockKey: bookmark.blockKey,
      })),
      sectionTitles,
    ),
  };
}
