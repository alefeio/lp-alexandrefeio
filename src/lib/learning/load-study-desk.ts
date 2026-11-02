import { sectionTitlesFor } from "@/lib/learning/catalog";
import { getPrisma } from "@/lib/db/prisma";
import { studyDeskFromRecords, type DeskNoteRecord, type DeskReviewRecord, type StudyDesk } from "@/lib/learning/study-desk";

const lessonSelect = {
  slug: true,
  title: true,
  status: true,
  accessType: true,
  module: { select: { course: { select: { title: true } } } },
} as const;

export async function loadStudyDesk(userId: string): Promise<StudyDesk> {
  const prisma = getPrisma();
  const [notes, bookmarks] = await Promise.all([
    prisma.lessonNote.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        userId: true,
        body: true,
        updatedAt: true,
        blockKey: true,
        lessonId: true,
        lesson: { select: lessonSelect },
      },
    }),
    prisma.lessonBookmark.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        blockKey: true,
        lessonId: true,
        lesson: { select: lessonSelect },
      },
    }),
  ]);

  const lessonIds = [...new Set([...notes, ...bookmarks].map((item) => item.lessonId))];
  const [blocks, entitlements, sectionTitles] = await Promise.all([
    lessonIds.length === 0
      ? Promise.resolve([])
      : prisma.lessonBlock.findMany({
          where: { lessonId: { in: lessonIds }, retiredAt: null },
          select: { lessonId: true, blockKey: true },
        }),
    lessonIds.length === 0
      ? Promise.resolve([])
      : prisma.entitlement.findMany({
          where: { userId, status: "ACTIVE", lessonId: { in: lessonIds } },
          select: { lessonId: true },
        }),
    sectionTitlesFor([...notes, ...bookmarks].map((item) => ({ lessonId: item.lessonId, blockKey: item.blockKey }))),
  ]);

  const active = new Set(blocks.map((block) => `${block.lessonId}:${block.blockKey}`));
  const entitled = new Set(entitlements.map((item) => item.lessonId));

  const noteRecords: DeskNoteRecord[] = notes.map((note) => ({
    id: note.id,
    userId: note.userId,
    body: note.body,
    updatedAt: note.updatedAt,
    blockKey: note.blockKey,
    lessonId: note.lessonId,
    lessonSlug: note.lesson.slug,
    lessonTitle: note.lesson.title,
    lessonStatus: note.lesson.status,
    accessType: note.lesson.accessType,
    entitled: entitled.has(note.lessonId) || note.lesson.accessType === "FREE",
    courseTitle: note.lesson.module.course.title,
    blockActive: active.has(`${note.lessonId}:${note.blockKey}`),
    sectionTitle: sectionTitles[`${note.lessonId}:${note.blockKey}`] ?? null,
  }));
  const reviewRecords: DeskReviewRecord[] = bookmarks.map((bookmark) => ({
    id: bookmark.id,
    userId: bookmark.userId,
    createdAt: bookmark.createdAt,
    blockKey: bookmark.blockKey,
    lessonId: bookmark.lessonId,
    lessonSlug: bookmark.lesson.slug,
    lessonTitle: bookmark.lesson.title,
    lessonStatus: bookmark.lesson.status,
    accessType: bookmark.lesson.accessType,
    entitled: entitled.has(bookmark.lessonId) || bookmark.lesson.accessType === "FREE",
    courseTitle: bookmark.lesson.module.course.title,
    blockActive: active.has(`${bookmark.lessonId}:${bookmark.blockKey}`),
    sectionTitle: sectionTitles[`${bookmark.lessonId}:${bookmark.blockKey}`] ?? null,
  }));

  return studyDeskFromRecords(userId, noteRecords, reviewRecords);
}
