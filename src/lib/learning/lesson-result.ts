import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export function personalLessonResultWhere(userId: string, lessonId: string) {
  return { userId, lessonId, projectId: null };
}

export async function findPersonalLessonResult(userId: string, lessonId: string) {
  return getPrisma().lessonResult.findFirst({ where: personalLessonResultWhere(userId, lessonId) });
}

export async function upsertPersonalLessonResult(userId: string, lessonId: string, payload: Prisma.InputJsonValue) {
  const prisma = getPrisma();
  const existing = await prisma.lessonResult.findFirst({ where: personalLessonResultWhere(userId, lessonId) });
  if (existing) {
    return prisma.lessonResult.update({ where: { id: existing.id }, data: { payload } });
  }
  return prisma.lessonResult.create({ data: { userId, lessonId, projectId: null, payload } });
}
