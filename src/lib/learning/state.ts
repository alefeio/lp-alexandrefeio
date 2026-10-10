import type { Prisma } from "@/generated/prisma/client";
import { parseBlockData } from "@/lib/learning/blocks";
import { getPrisma } from "@/lib/db/prisma";
import {
  completedBlockKeys,
  isLessonComplete,
  progressPercent,
  type BlockAnswer,
  type ProgressRuleBlock,
} from "@/lib/learning/progress";
import { ownedLesson } from "@/lib/learning/ownership";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export type { LessonSnapshot };

export async function loadRuleBlocks(lessonId: string): Promise<ProgressRuleBlock[]> {
  const rows = await getPrisma().lessonBlock.findMany({
    where: { lessonId },
    orderBy: { position: "asc" },
  });
  const rules: ProgressRuleBlock[] = [];
  for (const row of rows) {
    const data = parseBlockData(row.payload);
    if (!data) continue;
    rules.push({
      blockKey: row.blockKey,
      countsForProgress: row.countsForProgress,
      required: row.required,
      retiredAt: row.retiredAt,
      data,
    });
  }
  return rules;
}

export async function loadSnapshot(userId: string, lessonId: string, rules: ProgressRuleBlock[]): Promise<LessonSnapshot> {
  const prisma = getPrisma();
  const scope = ownedLesson(userId, lessonId);
  const [progress, blockProgress, responses, notes, bookmarks, result] = await Promise.all([
    prisma.lessonProgress.findUnique({ where: { userId_lessonId: scope } }),
    prisma.lessonBlockProgress.findMany({ where: scope }),
    prisma.lessonResponse.findMany({ where: scope }),
    prisma.lessonNote.findMany({ where: scope }),
    prisma.lessonBookmark.findMany({ where: scope }),
    prisma.lessonResult.findFirst({ where: { ...scope, projectId: null } }),
  ]);

  const answers = answersFromRows(rules, blockProgress, responses, Boolean(result));
  const resultPayload = result ? asStringRecord(result.payload) : null;

  return {
    percent: progress?.percent ?? progressPercent(rules, answers, Boolean(resultPayload)),
    completed: Boolean(progress?.completedAt),
    lastBlockKey: progress?.lastBlockKey ?? null,
    viewedBlockKeys: blockProgress.filter((row) => row.viewedAt).map((row) => row.blockKey),
    completedBlockKeys: completedBlockKeys(rules, answers, Boolean(resultPayload)),
    responses: Object.fromEntries(responses.map((row) => [row.blockKey, row.payload])),
    notes: Object.fromEntries(notes.map((row) => [row.blockKey, row.body])),
    bookmarks: bookmarks.map((row) => row.blockKey),
    result: resultPayload,
  };
}

export async function recomputeProgress(
  userId: string,
  lessonId: string,
  lastBlockKey?: string | null,
): Promise<LessonSnapshot> {
  const rules = await loadRuleBlocks(lessonId);
  const prisma = getPrisma();
  const scope = ownedLesson(userId, lessonId);
  const [blockProgress, responses, result] = await Promise.all([
    prisma.lessonBlockProgress.findMany({ where: scope }),
    prisma.lessonResponse.findMany({ where: scope }),
    prisma.lessonResult.findFirst({ where: { ...scope, projectId: null } }),
  ]);
  const saved = Boolean(result);
  const answers = answersFromRows(rules, blockProgress, responses, saved);
  const percent = progressPercent(rules, answers, saved);
  const completed = isLessonComplete(rules, answers, saved);
  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: scope } });
  const now = new Date();

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: scope },
    create: {
      userId,
      lessonId,
      startedAt: now,
      lastActiveAt: now,
      lastBlockKey: lastBlockKey ?? null,
      percent,
      completedAt: completed ? now : null,
    },
    update: {
      lastActiveAt: now,
      lastBlockKey: lastBlockKey === undefined ? existing?.lastBlockKey : lastBlockKey,
      percent,
      completedAt: completed ? (existing?.completedAt ?? now) : null,
    },
  });

  return loadSnapshot(userId, lessonId, rules);
}

function answersFromRows(
  rules: ProgressRuleBlock[],
  blockProgress: { blockKey: string; viewedAt: Date | null }[],
  responses: { blockKey: string; payload: Prisma.JsonValue }[],
  lessonResultSaved: boolean,
): Record<string, BlockAnswer> {
  const viewed = new Set(blockProgress.filter((row) => row.viewedAt).map((row) => row.blockKey));
  const responseByKey = new Map(responses.map((row) => [row.blockKey, row.payload]));
  const answers: Record<string, BlockAnswer> = {};
  for (const rule of rules) {
    answers[rule.blockKey] = {
      viewed: viewed.has(rule.blockKey),
      response: responseByKey.get(rule.blockKey),
    };
  }
  void lessonResultSaved;
  return answers;
}

function asStringRecord(value: Prisma.JsonValue): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") record[key] = item;
  }
  return record;
}
