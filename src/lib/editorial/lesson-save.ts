import { parseExpectedUpdatedAt } from "@/lib/admin/pricing-core";

export type LessonSaveAccess = "FREE" | "PAID";
export type LessonSaveStatus = "DRAFT" | "PUBLISHED";

/** PAID: não toca preço. FREE: limpa preço comercial. */
export function lessonEditorialPriceData(accessType: LessonSaveAccess): { priceCents: null } | Record<string, never> {
  return accessType === "FREE" ? { priceCents: null } : {};
}

export function parseLessonSaveUpdatedAt(raw: string) {
  return parseExpectedUpdatedAt(raw);
}

export type LessonSaveRecord = {
  id: string;
  accessType: LessonSaveAccess;
  status: LessonSaveStatus;
  commerceStatus: "NOT_FOR_SALE" | "AVAILABLE";
  priceCents: number | null;
  updatedAt: Date;
  publishedAt: Date | null;
  sortOrder: number;
  estimatedMinutes: number | null;
  title: string;
  summary: string;
  publicPreview: string | null;
};

export type LessonSaveWriteDb = {
  findUnique: (args: { where: { id: string } }) => Promise<LessonSaveRecord | null>;
  updateMany: (args: {
    where: { id: string; updatedAt: Date };
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
};

export const LESSON_SAVE_CONFLICT = "Este conteúdo foi atualizado em outra aba. Recarregue antes de salvar.";

export function buildLessonSaveData(input: {
  title: string;
  summary: string;
  publicPreview: string | null;
  estimatedMinutes: number | null;
  sortOrder: number;
  accessType: LessonSaveAccess;
  status: LessonSaveStatus;
  publishedAt: Date | null;
  cover?: { coverImageUrl?: string | null; coverImagePublicId?: string | null };
  updatedById: string;
}): Record<string, unknown> {
  return {
    title: input.title,
    summary: input.summary,
    publicPreview: input.publicPreview,
    estimatedMinutes: input.estimatedMinutes,
    sortOrder: input.sortOrder,
    accessType: input.accessType,
    status: input.status,
    publishedAt: input.publishedAt,
    ...(input.cover ?? {}),
    updatedById: input.updatedById,
    ...lessonEditorialPriceData(input.accessType),
  };
}
