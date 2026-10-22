export const SITE_LESSON_11_CANONICAL_SLUG = "configure-o-que-precisa-ser-medido";
export const SITE_LESSON_11_LEGACY_SLUG = "mensuracao-da-pagina";

export type LessonSlugRow = { id: string; slug: string; moduleId: string };

export type Lesson11SlugDecision =
  | { action: "none" }
  | { action: "rename"; id: string; from: string; to: string }
  | { action: "conflict" };

/**
 * Decide o slug da Aula 11 no futuro catalog deploy.
 * Não apaga linha. Se o slug antigo e o canônico coexistirem, o deploy deve parar.
 */
export function reconcileLesson11Slug(input: { courseModuleIds: string[]; lessons: LessonSlugRow[] }): Lesson11SlugDecision {
  const rows = input.lessons.filter(
    (lesson) =>
      input.courseModuleIds.includes(lesson.moduleId) &&
      (lesson.slug === SITE_LESSON_11_CANONICAL_SLUG || lesson.slug === SITE_LESSON_11_LEGACY_SLUG),
  );
  const canonical = rows.filter((lesson) => lesson.slug === SITE_LESSON_11_CANONICAL_SLUG);
  const legacy = rows.filter((lesson) => lesson.slug === SITE_LESSON_11_LEGACY_SLUG);
  if (canonical.length > 0 && legacy.length > 0) return { action: "conflict" };
  if (canonical.length > 0) return { action: "none" };
  if (legacy.length === 1) {
    return { action: "rename", id: legacy[0].id, from: SITE_LESSON_11_LEGACY_SLUG, to: SITE_LESSON_11_CANONICAL_SLUG };
  }
  return { action: "none" };
}

export async function reconcileSiteLesson11Slug(
  db: {
    findLessons(moduleId: string): Promise<LessonSlugRow[]>;
    renameLesson(id: string, slug: string): Promise<void>;
  },
  moduleId: string,
): Promise<void> {
  const lessons = await db.findLessons(moduleId);
  const decision = reconcileLesson11Slug({ courseModuleIds: [moduleId], lessons });
  if (decision.action === "conflict") {
    throw new Error("SITE_LESSON_11_SLUG_CONFLICT");
  }
  if (decision.action === "rename") {
    await db.renameLesson(decision.id, decision.to);
  }
}
