"use server";

import { canReadLessonBody } from "@/lib/learning/access";
import {
  activityResponseSchema,
  blockKeySchema,
  checklistResponseSchema,
  checkpointResponseSchema,
  noteBodySchema,
  resultResponseSchema,
} from "@/lib/learning/blocks";
import { mergeLessonProgress, type LocalLessonProgress } from "@/lib/learning/local-progress";
import { isViewCompletedType } from "@/lib/learning/progress";
import { upsertPersonalLessonResult } from "@/lib/learning/lesson-result";
import { ownedByUser, ownedLesson } from "@/lib/learning/ownership";
import { loadRuleBlocks, loadSnapshot, recomputeProgress, type LessonSnapshot } from "@/lib/learning/state";
import { getSession } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";

export type LearningActionResult =
  | { ok: true; snapshot: LessonSnapshot; explanation?: string; correct?: boolean }
  | { ok: false; message: string };

async function authorizedLesson(slug: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, message: "Entre na sua conta para salvar." };
  const lesson = await getPrisma().lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true, publicPreview: true },
  });
  if (!lesson || !canReadLessonBody(lesson)) {
    return { ok: false as const, message: "Esta aula não está aberta para salvar." };
  }
  return { ok: true as const, userId: session.user.id, lessonId: lesson.id };
}

export async function saveViewedBlocks(slug: string, blockKeys: string[]): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const keys = blockKeys.filter((key) => blockKeySchema().safeParse(key).success).slice(0, 40);
  if (keys.length === 0) return { ok: false, message: "Nenhum bloco válido." };

  const rules = await loadRuleBlocks(auth.lessonId);
  const allowed = new Set(rules.filter((rule) => !rule.retiredAt && isViewCompletedType(rule.data.type)).map((rule) => rule.blockKey));
  const now = new Date();
  const prisma = getPrisma();
  let last: string | null = null;

  for (const blockKey of keys) {
    if (!allowed.has(blockKey)) continue;
    last = blockKey;
    const rule = rules.find((item) => item.blockKey === blockKey);
    await prisma.lessonBlockProgress.upsert({
      where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey } },
      create: {
        userId: auth.userId,
        lessonId: auth.lessonId,
        blockKey,
        viewedAt: now,
        completedAt: rule && isViewCompletedType(rule.data.type) ? now : null,
      },
      update: {
        viewedAt: now,
        completedAt: rule && isViewCompletedType(rule.data.type) ? now : undefined,
      },
    });
  }

  if (!last) return { ok: true, snapshot: await loadSnapshot(auth.userId, auth.lessonId, rules) };
  return { ok: true, snapshot: await recomputeProgress(auth.userId, auth.lessonId, last) };
}

export async function gradeCheckpoint(
  slug: string,
  blockKey: string,
  optionId: string,
): Promise<{ ok: true; correct: boolean; explanation?: string } | { ok: false; message: string }> {
  const parsedKey = blockKeySchema().safeParse(blockKey);
  const parsed = checkpointResponseSchema.safeParse({ optionId });
  if (!parsedKey.success || !parsed.success) return { ok: false, message: "Resposta inválida." };
  const lesson = await getPrisma().lesson.findUnique({
    where: { slug },
    select: { id: true, status: true, accessType: true },
  });
  if (!lesson || !canReadLessonBody(lesson)) return { ok: false, message: "Esta aula não está aberta." };
  const rules = await loadRuleBlocks(lesson.id);
  const rule = rules.find((item) => item.blockKey === parsedKey.data && !item.retiredAt && item.data.type === "CHECKPOINT");
  if (!rule || rule.data.type !== "CHECKPOINT") return { ok: false, message: "Checkpoint inválido." };
  if (!rule.data.options.some((option) => option.id === parsed.data.optionId)) {
    return { ok: false, message: "Opção inválida." };
  }
  return {
    ok: true,
    correct: !rule.data.correctOptionId || rule.data.correctOptionId === parsed.data.optionId,
    explanation: rule.data.explanation,
  };
}

export async function saveCheckpoint(slug: string, blockKey: string, optionId: string): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const parsedKey = blockKeySchema().safeParse(blockKey);
  const parsed = checkpointResponseSchema.safeParse({ optionId });
  if (!parsedKey.success || !parsed.success) return { ok: false, message: "Resposta inválida." };

  const rules = await loadRuleBlocks(auth.lessonId);
  const rule = rules.find((item) => item.blockKey === parsedKey.data && !item.retiredAt && item.data.type === "CHECKPOINT");
  if (!rule || rule.data.type !== "CHECKPOINT") return { ok: false, message: "Checkpoint inválido." };
  if (!rule.data.options.some((option) => option.id === parsed.data.optionId)) {
    return { ok: false, message: "Opção inválida." };
  }

  const now = new Date();
  const correct = !rule.data.correctOptionId || rule.data.correctOptionId === parsed.data.optionId;
  await getPrisma().lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } },
    create: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data, payload: parsed.data },
    update: { payload: parsed.data },
  });
  await getPrisma().lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } },
    create: {
      userId: auth.userId,
      lessonId: auth.lessonId,
      blockKey: parsedKey.data,
      viewedAt: now,
      completedAt: correct ? now : null,
    },
    update: { viewedAt: now, completedAt: correct ? now : null },
  });

  return {
    ok: true,
    correct,
    explanation: rule.data.explanation,
    snapshot: await recomputeProgress(auth.userId, auth.lessonId, parsedKey.data),
  };
}

export async function saveActivity(slug: string, blockKey: string, text: string): Promise<LearningActionResult> {
  return saveTypedResponse(slug, blockKey, "ACTIVITY", activityResponseSchema.safeParse({ text }));
}

export async function saveChecklist(slug: string, blockKey: string, checkedIds: string[]): Promise<LearningActionResult> {
  return saveTypedResponse(slug, blockKey, "CHECKLIST", checklistResponseSchema.safeParse({ checkedIds }));
}

async function saveTypedResponse(
  slug: string,
  blockKey: string,
  type: "ACTIVITY" | "CHECKLIST",
  parsed: { success: true; data: { text: string } | { checkedIds: string[] } } | { success: false },
): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const parsedKey = blockKeySchema().safeParse(blockKey);
  if (!parsedKey.success || !parsed.success) return { ok: false, message: "Resposta inválida." };

  const rules = await loadRuleBlocks(auth.lessonId);
  const rule = rules.find((item) => item.blockKey === parsedKey.data && !item.retiredAt && item.data.type === type);
  if (!rule) return { ok: false, message: "Bloco inválido." };

  if (type === "CHECKLIST" && rule.data.type === "CHECKLIST" && "checkedIds" in parsed.data) {
    const allowed = new Set(rule.data.items.map((item) => item.id));
    if (parsed.data.checkedIds.some((id) => !allowed.has(id))) return { ok: false, message: "Item inválido." };
  }

  const now = new Date();
  await getPrisma().lessonResponse.upsert({
    where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } },
    create: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data, payload: parsed.data },
    update: { payload: parsed.data },
  });
  await getPrisma().lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } },
    create: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data, viewedAt: now, completedAt: now },
    update: { viewedAt: now, completedAt: now },
  });

  return { ok: true, snapshot: await recomputeProgress(auth.userId, auth.lessonId, parsedKey.data) };
}

export async function saveLessonResult(slug: string, values: Record<string, string>): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const parsed = resultResponseSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: "Resultado inválido." };

  const rules = await loadRuleBlocks(auth.lessonId);
  const resultBlock = rules.find((item) => !item.retiredAt && item.data.type === "RESULT");
  if (!resultBlock || resultBlock.data.type !== "RESULT") return { ok: false, message: "Esta aula não tem resultado." };
  const allowed = new Set(resultBlock.data.fields.map((field) => field.key));
  const payload: Record<string, string> = {};
  for (const field of resultBlock.data.fields) {
    const value = parsed.data[field.key]?.trim();
    if (!value) return { ok: false, message: "Preencha todos os campos do resultado." };
    if (!allowed.has(field.key)) return { ok: false, message: "Campo inválido." };
    payload[field.key] = value;
  }

  const now = new Date();
  await upsertPersonalLessonResult(auth.userId, auth.lessonId, payload);
  await getPrisma().lessonBlockProgress.upsert({
    where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: resultBlock.blockKey } },
    create: {
      userId: auth.userId,
      lessonId: auth.lessonId,
      blockKey: resultBlock.blockKey,
      viewedAt: now,
      completedAt: now,
    },
    update: { viewedAt: now, completedAt: now },
  });

  return { ok: true, snapshot: await recomputeProgress(auth.userId, auth.lessonId, resultBlock.blockKey) };
}

export async function saveNote(slug: string, blockKey: string, body: string): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const parsedKey = blockKeySchema().safeParse(blockKey);
  const parsedBody = noteBodySchema.safeParse(body);
  if (!parsedKey.success || !parsedBody.success) return { ok: false, message: "A nota precisa de texto." };
  const rules = await loadRuleBlocks(auth.lessonId);
  if (!rules.some((rule) => rule.blockKey === parsedKey.data && !rule.retiredAt)) {
    return { ok: false, message: "Bloco inválido." };
  }

  await getPrisma().lessonNote.upsert({
    where: { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } },
    create: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data, body: parsedBody.data },
    update: { body: parsedBody.data },
  });
  return { ok: true, snapshot: await loadSnapshot(auth.userId, auth.lessonId, rules) };
}

export async function deleteNote(slug: string, blockKey: string): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const parsedKey = blockKeySchema().safeParse(blockKey);
  if (!parsedKey.success) return { ok: false, message: "Bloco inválido." };
  await getPrisma().lessonNote.deleteMany({
    where: { ...ownedByUser(auth.userId), lessonId: auth.lessonId, blockKey: parsedKey.data },
  });
  const rules = await loadRuleBlocks(auth.lessonId);
  return { ok: true, snapshot: await loadSnapshot(auth.userId, auth.lessonId, rules) };
}

export async function toggleBookmark(slug: string, blockKey: string): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const parsedKey = blockKeySchema().safeParse(blockKey);
  if (!parsedKey.success) return { ok: false, message: "Bloco inválido." };
  const rules = await loadRuleBlocks(auth.lessonId);
  if (!rules.some((rule) => rule.blockKey === parsedKey.data && !rule.retiredAt)) {
    return { ok: false, message: "Bloco inválido." };
  }

  const prisma = getPrisma();
  const where = { userId_lessonId_blockKey: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } };
  const existing = await prisma.lessonBookmark.findUnique({ where });
  if (existing && existing.userId !== auth.userId) return { ok: false, message: "Marcador inválido." };
  if (existing) await prisma.lessonBookmark.delete({ where });
  else await prisma.lessonBookmark.create({ data: { userId: auth.userId, lessonId: auth.lessonId, blockKey: parsedKey.data } });

  return { ok: true, snapshot: await loadSnapshot(auth.userId, auth.lessonId, rules) };
}

export async function importLocalProgress(slug: string, local: LocalLessonProgress): Promise<LearningActionResult> {
  const auth = await authorizedLesson(slug);
  if (!auth.ok) return auth;
  const rules = await loadRuleBlocks(auth.lessonId);
  const current = await loadSnapshot(auth.userId, auth.lessonId, rules);
  const existing = await getPrisma().lessonProgress.findUnique({
    where: { userId_lessonId: ownedLesson(auth.userId, auth.lessonId) },
  });
  const server = existing
    ? {
        updatedAt: existing.updatedAt.toISOString(),
        lastBlockKey: current.lastBlockKey,
        viewedBlockKeys: current.viewedBlockKeys,
        responses: current.responses,
        result: current.result,
      }
    : null;

  const order = rules.filter((rule) => !rule.retiredAt).map((rule) => rule.blockKey);
  const merged = mergeLessonProgress(server, local, order);
  if (!merged.write || !merged.progress) {
    return { ok: true, snapshot: current };
  }

  await applyImported(auth.userId, auth.lessonId, rules, merged.progress);
  return { ok: true, snapshot: await recomputeProgress(auth.userId, auth.lessonId, merged.progress.lastBlockKey) };
}

async function applyImported(
  userId: string,
  lessonId: string,
  rules: Awaited<ReturnType<typeof loadRuleBlocks>>,
  progress: LocalLessonProgress,
) {
  const prisma = getPrisma();
  const known = new Map(rules.filter((rule) => !rule.retiredAt).map((rule) => [rule.blockKey, rule]));
  const now = new Date(progress.updatedAt);
  const stamp = Number.isNaN(now.getTime()) ? new Date() : now;

  for (const blockKey of progress.viewedBlockKeys) {
    const rule = known.get(blockKey);
    if (!rule || !isViewCompletedType(rule.data.type)) continue;
    await prisma.lessonBlockProgress.upsert({
      where: { userId_lessonId_blockKey: { userId, lessonId, blockKey } },
      create: { userId, lessonId, blockKey, viewedAt: stamp, completedAt: stamp },
      update: {},
    });
  }

  for (const [blockKey, response] of Object.entries(progress.responses)) {
    const rule = known.get(blockKey);
    if (!rule) continue;
    const existing = await prisma.lessonResponse.findUnique({
      where: { userId_lessonId_blockKey: { userId, lessonId, blockKey } },
    });
    if (existing) continue;
    if (rule.data.type === "CHECKPOINT" && checkpointResponseSchema.safeParse(response).success) {
      await prisma.lessonResponse.create({ data: { userId, lessonId, blockKey, payload: response as object } });
    }
    if (rule.data.type === "ACTIVITY" && activityResponseSchema.safeParse(response).success) {
      await prisma.lessonResponse.create({ data: { userId, lessonId, blockKey, payload: response as object } });
    }
    if (rule.data.type === "CHECKLIST" && checklistResponseSchema.safeParse(response).success) {
      await prisma.lessonResponse.create({ data: { userId, lessonId, blockKey, payload: response as object } });
    }
  }

  if (progress.result && !(await prisma.lessonResult.findFirst({ where: { userId, lessonId, projectId: null } }))) {
    const parsed = resultResponseSchema.safeParse(progress.result);
    if (parsed.success) {
      await prisma.lessonResult.create({ data: { userId, lessonId, projectId: null, payload: parsed.data } });
    }
  }
}
