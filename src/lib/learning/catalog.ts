import { canIndexLesson, canReadLessonBody, isPublicLesson } from "@/lib/learning/access";
import { parseBlockData, toPublicBlockData, type LessonBlockData } from "@/lib/learning/blocks";
import { getPrisma } from "@/lib/db/prisma";
import type { SitemapCourse, SitemapLesson } from "@/lib/seo/public-sitemap";
import { savedCheckpointFeedback, type CheckpointFeedback } from "@/lib/learning/progress";
import { loadSnapshot, type LessonSnapshot } from "@/lib/learning/state";

export type PublicBlock = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

export type PublicLesson = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publicPreview: string | null;
  estimatedMinutes: number | null;
  accessType: "FREE" | "PAID";
  priceCents: number | null;
  status: "DRAFT" | "PUBLISHED";
  courseSlug: string;
  courseTitle: string;
  moduleTitle: string;
};

export async function listPublishedCourses() {
  return getPrisma().course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    include: {
      modules: {
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            where: { status: "PUBLISHED" },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
}

export async function getPublishedCourse(slug: string) {
  const course = await getPrisma().course.findUnique({
    where: { slug },
    include: {
      modules: {
        where: { status: "PUBLISHED" },
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: {
            where: { status: "PUBLISHED" },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });
  if (!course || !isPublicLesson(course)) return null;
  return course;
}

export async function getPublicLesson(slug: string): Promise<{
  lesson: PublicLesson;
  blocks: PublicBlock[];
  hasBody: boolean;
} | null> {
  const row = await getPrisma().lesson.findUnique({
    where: { slug },
    include: {
      module: { include: { course: true } },
    },
  });
  if (!row || !isPublicLesson(row) || row.module.status !== "PUBLISHED" || row.module.course.status !== "PUBLISHED") {
    return null;
  }

  const lesson: PublicLesson = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publicPreview: row.publicPreview,
    estimatedMinutes: row.estimatedMinutes,
    accessType: row.accessType,
    priceCents: row.priceCents,
    status: row.status,
    courseSlug: row.module.course.slug,
    courseTitle: row.module.course.title,
    moduleTitle: row.module.title,
  };

  if (!canReadLessonBody(lesson)) {
    return { lesson, blocks: [], hasBody: false };
  }

  const blockRows = await getPrisma().lessonBlock.findMany({
    where: { lessonId: row.id, retiredAt: null },
    orderBy: { position: "asc" },
  });
  const blocks: PublicBlock[] = [];
  for (const block of blockRows) {
    const data = parseBlockData(block.payload);
    if (!data) continue;
    blocks.push({
      blockKey: block.blockKey,
      position: block.position,
      countsForProgress: block.countsForProgress,
      required: block.required,
      data: toPublicBlockData(data),
    });
  }

  return { lesson, blocks, hasBody: blocks.length > 0 };
}

export async function getReaderSnapshot(
  userId: string,
  lessonId: string,
): Promise<{ snapshot: LessonSnapshot; checkpointFeedback: CheckpointFeedback }> {
  const { loadRuleBlocks } = await import("@/lib/learning/state");
  const rules = await loadRuleBlocks(lessonId);
  const snapshot = await loadSnapshot(userId, lessonId, rules);
  return { snapshot, checkpointFeedback: savedCheckpointFeedback(rules, snapshot.responses) };
}

export async function sitemapLearningEntries(): Promise<{ courses: SitemapCourse[]; lessons: SitemapLesson[] }> {
  const courses = await getPrisma().course.findMany({
    where: { status: "PUBLISHED" },
    include: {
      modules: {
        where: { status: "PUBLISHED" },
        include: {
          lessons: true,
        },
      },
    },
  });

  const courseEntries: SitemapCourse[] = courses.map((course) => ({ slug: course.slug, updatedAt: course.updatedAt }));
  const lessons: SitemapLesson[] = [];
  for (const course of courses) {
    for (const moduleRow of course.modules) {
      for (const lesson of moduleRow.lessons) {
        const bodyCount =
          lesson.status === "PUBLISHED" && lesson.accessType === "FREE"
            ? await getPrisma().lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } })
            : 0;
        lessons.push({
          slug: lesson.slug,
          updatedAt: lesson.updatedAt,
          indexable: canIndexLesson(lesson, bodyCount > 0),
        });
      }
    }
  }
  return { courses: courseEntries, lessons };
}

export async function continueStudying(userId: string) {
  return getPrisma().lessonProgress.findFirst({
    where: ownedContinue(userId),
    orderBy: { lastActiveAt: "desc" },
    include: { lesson: { select: { slug: true, title: true, status: true, accessType: true, estimatedMinutes: true } } },
  });
}

function ownedContinue(userId: string) {
  return { userId, completedAt: null, lesson: { status: "PUBLISHED" as const, accessType: "FREE" as const } };
}

export async function learningLists(userId: string) {
  const prisma = getPrisma();
  const [inProgress, completed, notes, bookmarks] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: { userId, completedAt: null },
      orderBy: { lastActiveAt: "desc" },
      include: { lesson: { select: { slug: true, title: true } } },
    }),
    prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      include: { lesson: { select: { slug: true, title: true } } },
    }),
    prisma.lessonNote.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { lesson: { select: { slug: true, title: true } } },
    }),
    prisma.lessonBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { lesson: { select: { slug: true, title: true } } },
    }),
  ]);
  return { inProgress, completed, notes, bookmarks };
}

export async function sectionTitlesFor(items: { lessonId: string; blockKey: string | null }[]): Promise<Record<string, string>> {
  const lessonIds = [...new Set(items.map((item) => item.lessonId))];
  if (lessonIds.length === 0) return {};
  const rows = await getPrisma().lessonBlock.findMany({
    where: { lessonId: { in: lessonIds }, retiredAt: null },
    orderBy: { position: "asc" },
    select: { lessonId: true, blockKey: true, position: true, payload: true },
  });
  const byLesson = new Map<string, { blockKey: string; position: number; title: string | null }[]>();
  for (const row of rows) {
    const data = parseBlockData(row.payload);
    const list = byLesson.get(row.lessonId) ?? [];
    list.push({
      blockKey: row.blockKey,
      position: row.position,
      title: data?.type === "HEADING" ? data.text : null,
    });
    byLesson.set(row.lessonId, list);
  }

  const labels: Record<string, string> = {};
  for (const item of items) {
    if (!item.blockKey) continue;
    const blocks = byLesson.get(item.lessonId) ?? [];
    const current = blocks.find((block) => block.blockKey === item.blockKey);
    if (!current) continue;
    const heading = [...blocks].reverse().find((block) => block.title && block.position <= current.position);
    if (heading?.title) labels[`${item.lessonId}:${item.blockKey}`] = heading.title;
  }
  return labels;
}
