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

export type LessonGateKind = "buy" | "owned-unavailable" | "soon" | "preparing";

/** Quem já tem a aula não vê convite de compra, mesmo sem corpo. */
export function lessonGateKind(input: {
  accessType: "FREE" | "PAID";
  entitled: boolean;
  forSale: boolean;
  hasBody: boolean;
}): LessonGateKind | null {
  if (input.entitled && !input.hasBody) return "owned-unavailable";
  if (input.entitled) return null;
  if (input.forSale) return "buy";
  if (input.accessType === "PAID") return "soon";
  if (!input.hasBody) return "preparing";
  return null;
}

export function visibleBlocks<T>(
  lesson: Pick<LessonAccess, "status" | "accessType">,
  blocks: T[],
  options?: { entitled?: boolean },
): T[] {
  return canReadLessonBody(lesson, options) ? blocks : [];
}
