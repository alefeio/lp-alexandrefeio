import { getPrisma } from "@/lib/db/prisma";
import { buildHomeContinuation, type ContinuationLesson, type HomeContinuationCard } from "@/lib/home/home-continuation";
import { homeBelongsToViewer } from "@/lib/home/public-home";
import { getPublishedCourse } from "@/lib/learning/catalog";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";

export async function loadHomeContinuation(userId: string, name: string): Promise<HomeContinuationCard> {
  const prisma = getPrisma();
  const [course, progress, entitlements] = await Promise.all([
    getPublishedCourse(FIRST_COURSE_SLUG),
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
    prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE" },
      select: { lessonId: true },
    }),
  ]);

  const entitled = new Set(entitlements.map((row) => row.lessonId));
  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  const published = course?.modules.flatMap((moduleRow) => moduleRow.lessons) ?? [];

  const lessons: ContinuationLesson[] = published.map((lesson, index) => {
    const row = progressByLesson.get(lesson.id);
    const accessible = lesson.accessType === "FREE" || entitled.has(lesson.id);
    return {
      slug: lesson.slug,
      title: lesson.title,
      number: index + 1,
      accessible,
      completed: Boolean(row?.completedAt),
      inProgress: Boolean(row && !row.completedAt),
      percent: row?.percent ?? 0,
    };
  });

  const card = buildHomeContinuation({ userId, name, lessons });
  if (!homeBelongsToViewer(card.userId, userId)) throw new Error("HOME_OWNER_MISMATCH");
  return card;
}
