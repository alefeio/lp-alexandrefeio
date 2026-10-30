export type CourseMaterialNote = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  href: string;
  sectionTitle: string | null;
  body: string;
};

export type CourseMaterialBookmark = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  href: string;
  sectionTitle: string | null;
};

export type CourseMaterial = {
  notes: CourseMaterialNote[];
  bookmarks: CourseMaterialBookmark[];
};

type NoteInput = {
  id: string;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  blockKey: string;
  body: string;
};

type BookmarkInput = {
  id: string;
  lessonId: string;
  lessonSlug: string;
  lessonTitle: string;
  blockKey: string;
};

/** Mantém só o material das aulas deste curso. Não altera o armazenamento. */
export function selectCourseMaterial(
  lessonIds: ReadonlySet<string>,
  notes: readonly NoteInput[],
  bookmarks: readonly BookmarkInput[],
  sectionTitles: Readonly<Record<string, string>>,
): CourseMaterial {
  return {
    notes: notes.filter((note) => lessonIds.has(note.lessonId)).map((note) => ({
      id: note.id,
      lessonId: note.lessonId,
      lessonTitle: note.lessonTitle,
      href: `/aulas/${note.lessonSlug}#b-${note.blockKey}`,
      sectionTitle: sectionTitles[`${note.lessonId}:${note.blockKey}`] ?? null,
      body: note.body,
    })),
    bookmarks: bookmarks.filter((bookmark) => lessonIds.has(bookmark.lessonId)).map((bookmark) => ({
      id: bookmark.id,
      lessonId: bookmark.lessonId,
      lessonTitle: bookmark.lessonTitle,
      href: `/aulas/${bookmark.lessonSlug}#b-${bookmark.blockKey}`,
      sectionTitle: sectionTitles[`${bookmark.lessonId}:${bookmark.blockKey}`] ?? null,
    })),
  };
}
