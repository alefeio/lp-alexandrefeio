import { getPrisma } from "@/lib/db/prisma";
import { loadOwnedLessonIds } from "@/lib/commerce/catalog";
import { listPublishedCourses } from "@/lib/learning/catalog";

export type CourseCatalogCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  lessonCount: number;
  moduleCount: number;
  freeLessonCount: number;
  href: string;
  ctaLabel: "Conhecer o curso" | "Continuar curso";
  microcopy: string | null;
  progress: { label: "Em andamento"; detail: string } | null;
};

type PublishedCourse = Awaited<ReturnType<typeof listPublishedCourses>>[number];

export function buildCourseCatalogCard(
  course: PublishedCourse,
  input: { ownedLessonIds: string[]; completedLessonIds: string[] } = {
    ownedLessonIds: [],
    completedLessonIds: [],
  },
): CourseCatalogCard {
  const lessons = course.modules.flatMap((moduleRow) => moduleRow.lessons);
  const owned = new Set(input.ownedLessonIds);
  const completed = new Set(input.completedLessonIds);
  const freeLessonCount = lessons.filter((lesson) => lesson.accessType === "FREE").length;
  const accessible = lessons.filter((lesson) => lesson.accessType === "FREE" || owned.has(lesson.id));
  const completedAccessible = accessible.filter((lesson) => completed.has(lesson.id)).length;
  const inProgress = accessible.length > 0 && completedAccessible > 0 && completedAccessible < accessible.length;
  const started = accessible.some((lesson) => completed.has(lesson.id)) || inProgress;

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.subtitle?.trim() || course.description.trim(),
    lessonCount: lessons.length,
    moduleCount: course.modules.length,
    freeLessonCount,
    href: `/cursos/${course.slug}`,
    ctaLabel: started ? "Continuar curso" : "Conhecer o curso",
    microcopy: freeLessonCount > 0 && !started ? "Comece gratuitamente" : null,
    progress:
      started && accessible.length > 0
        ? {
            label: "Em andamento",
            detail: `${completedAccessible} de ${accessible.length} aulas`,
          }
        : null,
  };
}

export async function loadCourseCatalog(userId?: string | null): Promise<CourseCatalogCard[]> {
  const courses = await listPublishedCourses();
  if (!userId) {
    return courses.map((course) => buildCourseCatalogCard(course));
  }

  const [ownedLessonIds, completedRows] = await Promise.all([
    loadOwnedLessonIds(userId),
    getPrisma().lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      select: { lessonId: true },
    }),
  ]);
  const completedLessonIds = completedRows.map((row) => row.lessonId);
  return courses.map((course) => buildCourseCatalogCard(course, { ownedLessonIds, completedLessonIds }));
}
