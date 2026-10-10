export type LessonAccess = {
  status: "DRAFT" | "PUBLISHED";
  accessType: "FREE" | "PAID";
  publicPreview: string | null;
};

/** Corpo só existe para aula publicada e gratuita. Pago espera entitlement. */
export function canReadLessonBody(lesson: Pick<LessonAccess, "status" | "accessType">): boolean {
  return lesson.status === "PUBLISHED" && lesson.accessType === "FREE";
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

export function visibleBlocks<T>(lesson: Pick<LessonAccess, "status" | "accessType">, blocks: T[]): T[] {
  return canReadLessonBody(lesson) ? blocks : [];
}
