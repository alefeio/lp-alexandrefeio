"use server";

import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { canReadLessonBody } from "@/lib/learning/access";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { noteBodySchema, blockKeySchema } from "@/lib/learning/blocks";
import { ownedByUser, ownedRecord } from "@/lib/learning/ownership";

export type PersonalNoteActionResult =
  | { ok: true; note: { id: string; body: string; lessonId: string | null; blockKey: string | null } }
  | { ok: false; message: string };

const optionalLessonSlug = z.string().trim().min(1).max(120).optional().nullable();

async function requireUserId() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session.user.id;
}

async function resolveOptionalLessonLink(userId: string, lessonSlug: string | null | undefined, blockKey: string | null | undefined) {
  if (!lessonSlug) return { ok: true as const, lessonId: null as string | null, blockKey: null as string | null };
  const lesson = await getPrisma().lesson.findUnique({
    where: { slug: lessonSlug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson) return { ok: false as const, message: "Não foi possível salvar a nota." };
  const entitled = lesson.accessType === "FREE" ? true : await hasActiveEntitlement(userId, lesson.id);
  if (!canReadLessonBody({ status: lesson.status, accessType: lesson.accessType }, { entitled })) {
    return { ok: false as const, message: "Não foi possível salvar a nota." };
  }
  if (!blockKey) return { ok: true as const, lessonId: lesson.id, blockKey: null };
  const parsedKey = blockKeySchema().safeParse(blockKey);
  if (!parsedKey.success) return { ok: false as const, message: "Não foi possível salvar a nota." };
  const block = await getPrisma().lessonBlock.findFirst({
    where: { lessonId: lesson.id, blockKey: parsedKey.data, retiredAt: null },
    select: { id: true },
  });
  if (!block) return { ok: false as const, message: "Não foi possível salvar a nota." };
  return { ok: true as const, lessonId: lesson.id, blockKey: parsedKey.data };
}

/** Cria ou atualiza nota pessoal. Sem userId do cliente. */
export async function savePersonalNote(input: {
  body: string;
  noteId?: string | null;
  linkToLessonSlug?: string | null;
  blockKey?: string | null;
}): Promise<PersonalNoteActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Entre na sua conta para salvar a nota." };
  const parsedBody = noteBodySchema.safeParse(input.body);
  if (!parsedBody.success) return { ok: false, message: "A nota precisa de texto." };
  const slug = optionalLessonSlug.safeParse(input.linkToLessonSlug ?? null);
  if (!slug.success) return { ok: false, message: "Não foi possível salvar a nota." };
  const link = await resolveOptionalLessonLink(userId, slug.data, input.blockKey ?? null);
  if (!link.ok) return link;

  const prisma = getPrisma();
  if (input.noteId) {
    const existing = await prisma.personalNote.findFirst({ where: ownedRecord(userId, input.noteId) });
    if (!existing) return { ok: false, message: "Não foi possível salvar a nota." };
    const updated = await prisma.personalNote.update({
      where: { id: existing.id },
      data: { body: parsedBody.data, lessonId: link.lessonId, blockKey: link.blockKey },
      select: { id: true, body: true, lessonId: true, blockKey: true },
    });
    return { ok: true, note: updated };
  }

  const created = await prisma.personalNote.create({
    data: {
      userId,
      body: parsedBody.data,
      lessonId: link.lessonId,
      blockKey: link.blockKey,
    },
    select: { id: true, body: true, lessonId: true, blockKey: true },
  });
  return { ok: true, note: created };
}

export async function deletePersonalNote(noteId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: "Entre na sua conta para excluir a nota." };
  if (!noteId.trim()) return { ok: false, message: "Não foi possível excluir a nota." };
  const result = await getPrisma().personalNote.deleteMany({
    where: { ...ownedByUser(userId), id: noteId },
  });
  if (result.count === 0) return { ok: false, message: "Não foi possível excluir a nota." };
  return { ok: true };
}
