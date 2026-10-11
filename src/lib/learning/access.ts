export type LessonAccess = {
  status: "DRAFT" | "PUBLISHED";
  accessType: "FREE" | "PAID";
  publicPreview: string | null;
};

/** Aula publicada e gratuita abre o corpo. Aula paga só abre com entitlement ativo. */
export function canReadLessonBody(
  lesson: Pick<LessonAccess, "status" | "accessType">,
  options?: { entitled?: boolean },
): boolean {
  if (lesson.status !== "PUBLISHED") return false;
  if (lesson.accessType === "FREE") return true;
  return options?.entitled === true;
}

export function isPublicLesson(lesson: Pick<LessonAccess, "status">): boolean {
  return lesson.status === "PUBLISHED";
}

/** Aula gratuita sem corpo fica fora do índice. Rascunho nunca entra. */
export function canIndexLesson(lesson: LessonAccess, hasBody: boolean): boolean {
  if (lesson.status !== "PUBLISHED") return false;
  if (lesson.accessType === "FREE") return hasBody;
  return Boolean(lesson.publicPreview?.trim());
}

export function visibleBlocks<T>(
  lesson: Pick<LessonAccess, "status" | "accessType">,
  blocks: T[],
  options?: { entitled?: boolean },
): T[] {
  return canReadLessonBody(lesson, options) ? blocks : [];
}
