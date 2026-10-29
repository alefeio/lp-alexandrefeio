import { canIndexLesson, canReadLessonBody, isPublicLesson } from "@/lib/learning/access";
import { PUBLIC_PREVIEW_TYPES } from "@/lib/learning/public-preview";
import { parseBlockData, toPublicBlockData, type LessonBlockData } from "@/lib/learning/blocks";
import { getPrisma } from "@/lib/db/prisma";
import { lessonsAvailableToStudy } from "@/lib/learning/available-study";
import type { SitemapCourse, SitemapLesson } from "@/lib/seo/public-sitemap";
import { savedCheckpointFeedback, type CheckpointFeedback } from "@/lib/learning/progress";
import { studentAreaState, type StudyCard } from "@/lib/learning/student-home";
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
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  priceCents: number | null;
  status: "DRAFT" | "PUBLISHED";
  courseSlug: string;
  courseTitle: string;
  courseId: string;
  moduleTitle: string;
  moduleId: string;
  publishedAt: Date | null;
  updatedAt: Date;
  modulePriceCents: number | null;
  moduleCommerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  coursePriceCents: number | null;
  courseCommerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
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
  hasPublicPreview: boolean;
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
    commerceStatus: row.commerceStatus,
    priceCents: row.priceCents,
    status: row.status,
    courseSlug: row.module.course.slug,
    courseTitle: row.module.course.title,
    courseId: row.module.course.id,
    moduleTitle: row.module.title,
    moduleId: row.module.id,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    modulePriceCents: row.module.bundlePriceCents,
    moduleCommerceStatus: row.module.commerceStatus,
    coursePriceCents: row.module.course.bundlePriceCents,
    courseCommerceStatus: row.module.course.commerceStatus,
  };

  const bodyCount = await getPrisma().lessonBlock.count({ where: { lessonId: row.id, retiredAt: null } });
  if (lesson.accessType === "FREE" && canReadLessonBody(lesson)) {
    return { lesson, blocks: await loadLessonBlocks(row.id, "full"), hasBody: bodyCount > 0, hasPublicPreview: false };
  }

  const preview = await loadLessonBlocks(row.id, "preview");
  return { lesson, blocks: preview, hasBody: bodyCount > 0, hasPublicPreview: preview.length > 0 };
}

export async function loadLessonBlocks(lessonId: string, scope: "full" | "preview" = "full"): Promise<PublicBlock[]> {
  const blockRows = await getPrisma().lessonBlock.findMany({
    where:
      scope === "preview"
        ? { lessonId, retiredAt: null, isPublicPreview: true, type: { in: [...PUBLIC_PREVIEW_TYPES] } }
        : { lessonId, retiredAt: null },
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
  return blocks;
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
        const previewCount =
          lesson.status === "PUBLISHED" && lesson.accessType === "PAID"
            ? await getPrisma().lessonBlock.count({
                where: { lessonId: lesson.id, retiredAt: null, isPublicPreview: true, type: { in: [...PUBLIC_PREVIEW_TYPES] } },
              })
            : 0;
        lessons.push({
          slug: lesson.slug,
          updatedAt: lesson.updatedAt,
          indexable: canIndexLesson(lesson, bodyCount > 0, previewCount > 0),
        });
      }
    }
  }
  return { courses: courseEntries, lessons };
}

export type LessonNeighbor = {
  slug: string;
  title: string;
  lessonId: string;
  access: "open" | "preview";
};

export async function adjacentLessons(courseSlug: string, lessonSlug: string): Promise<{
  previous: LessonNeighbor | null;
  next: LessonNeighbor | null;
  place: { number: number; total: number } | null;
}> {
  const course = await getPublishedCourse(courseSlug);
  if (!course) return { previous: null, next: null, place: null };
  const trail = course.modules.flatMap((moduleRow) => moduleRow.lessons);
  const index = trail.findIndex((lesson) => lesson.slug === lessonSlug);
  return {
    previous: await linkableNeighbor(trail[index - 1]),
    next: await linkableNeighbor(trail[index + 1]),
    place: index >= 0 ? { number: index + 1, total: trail.length } : null,
  };
}

async function linkableNeighbor(
  lesson: { id: string; slug: string; title: string; accessType: "FREE" | "PAID" } | undefined,
): Promise<LessonNeighbor | null> {
  if (!lesson) return null;
  const access = lesson.accessType === "FREE" ? "open" : "preview";
  if (lesson.accessType === "FREE") {
    const body = await getPrisma().lessonBlock.count({ where: { lessonId: lesson.id, retiredAt: null } });
    return body > 0 ? { slug: lesson.slug, title: lesson.title, lessonId: lesson.id, access } : null;
  }
  const preview = await getPrisma().lessonBlock.count({
    where: { lessonId: lesson.id, retiredAt: null, isPublicPreview: true, type: { in: [...PUBLIC_PREVIEW_TYPES] } },
  });
  return preview > 0 ? { slug: lesson.slug, title: lesson.title, lessonId: lesson.id, access } : null;
}

export async function continueStudying(userId: string) {
  return getPrisma().lessonProgress.findFirst({
    where: ownedContinue(userId),
    orderBy: { lastActiveAt: "desc" },
    include: { lesson: { select: { slug: true, title: true, status: true, accessType: true, estimatedMinutes: true } } },
  });
}

function visibleLesson(userId: string) {
  return {
    status: "PUBLISHED" as const,
    OR: [{ accessType: "FREE" as const }, { entitlements: { some: { userId, status: "ACTIVE" as const } } }],
  };
}

function ownedContinue(userId: string) {
  return {
    userId,
    completedAt: null,
    lesson: visibleLesson(userId),
  };
}

export async function studentLearningHome(userId: string) {
  const prisma = getPrisma();
  const lessonSelect = {
    slug: true,
    title: true,
    module: { select: { course: { select: { slug: true } } } },
  };
  const [inProgress, completed] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: ownedContinue(userId),
      orderBy: { lastActiveAt: "desc" },
      include: { lesson: { select: lessonSelect } },
    }),
    prisma.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: visibleLesson(userId) },
      orderBy: { completedAt: "desc" },
      include: { lesson: { select: lessonSelect } },
    }),
  ]);
  const cards = (rows: typeof inProgress): StudyCard[] =>
    rows.map((row) => ({ slug: row.lesson.slug, title: row.lesson.title, percent: row.percent }));
  const latest = completed[0];
  const nextLesson = latest ? (await adjacentLessons(latest.lesson.module.course.slug, latest.lesson.slug)).next : null;
  return studentAreaState({
    inProgress: cards(inProgress),
    completed: cards(completed),
    nextLesson,
  });
}

export async function learningLists(userId: string) {
  const prisma = getPrisma();
  const [inProgress, completed, notes, bookmarks, entitlements] = await Promise.all([
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
    prisma.entitlement.findMany({
      where: { userId, status: "ACTIVE" },
      select: { lessonId: true, lesson: { select: { slug: true, title: true } } },
    }),
  ]);
  const available = lessonsAvailableToStudy(
    entitlements.map((item) => ({
      lessonId: item.lessonId,
      slug: item.lesson.slug,
      title: item.lesson.title,
      status: "ACTIVE",
    })),
    [...inProgress, ...completed].map((item) => item.lessonId),
  );
  return { inProgress, completed, notes, bookmarks, available };
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
