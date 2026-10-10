import {
  activityResponseSchema,
  checklistResponseSchema,
  checkpointResponseSchema,
  type LessonBlockData,
} from "@/lib/learning/blocks";

export type ProgressRuleBlock = {
  blockKey: string;
  countsForProgress: boolean;
  required: boolean;
  retiredAt: Date | string | null;
  data: LessonBlockData;
};

export type BlockAnswer = {
  viewed: boolean;
  response?: unknown;
};

const VIEW_COMPLETE = new Set<LessonBlockData["type"]>([
  "TEXT",
  "HEADING",
  "CALLOUT",
  "EXAMPLE",
  "CONCLUSION",
  "IMAGE",
]);

export function isViewCompletedType(type: LessonBlockData["type"]): boolean {
  return VIEW_COMPLETE.has(type);
}

export function isBlockComplete(
  block: ProgressRuleBlock,
  answer: BlockAnswer | undefined,
  lessonResultSaved: boolean,
): boolean {
  if (block.retiredAt) return false;
  const viewed = answer?.viewed === true;

  switch (block.data.type) {
    case "CHECKPOINT": {
      const parsed = checkpointResponseSchema.safeParse(answer?.response);
      if (!parsed.success) return false;
      if (!block.data.options.some((option) => option.id === parsed.data.optionId)) return false;
      if (block.data.correctOptionId) return parsed.data.optionId === block.data.correctOptionId;
      return true;
    }
    case "ACTIVITY":
      return activityResponseSchema.safeParse(answer?.response).success;
    case "CHECKLIST": {
      const parsed = checklistResponseSchema.safeParse(answer?.response);
      if (!parsed.success) return false;
      return block.data.items.every((item) => parsed.data.checkedIds.includes(item.id));
    }
    case "RESULT":
      return lessonResultSaved;
    default:
      return viewed;
  }
}

export function progressPercent(
  blocks: ProgressRuleBlock[],
  answers: Record<string, BlockAnswer | undefined>,
  lessonResultSaved: boolean,
): number {
  const counting = blocks.filter((block) => !block.retiredAt && block.countsForProgress);
  if (counting.length === 0) return 0;
  const done = counting.filter((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved)).length;
  return Math.round((done / counting.length) * 100);
}

export function isLessonComplete(
  blocks: ProgressRuleBlock[],
  answers: Record<string, BlockAnswer | undefined>,
  lessonResultSaved: boolean,
): boolean {
  const active = blocks.filter((block) => !block.retiredAt);
  const counting = active.filter((block) => block.countsForProgress);
  if (counting.length === 0) return false;
  const countingDone = counting.every((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved));
  const requiredDone = active
    .filter((block) => block.required)
    .every((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved));
  return countingDone && requiredDone;
}

export function completedBlockKeys(
  blocks: ProgressRuleBlock[],
  answers: Record<string, BlockAnswer | undefined>,
  lessonResultSaved: boolean,
): string[] {
  return blocks
    .filter((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved))
    .map((block) => block.blockKey);
}

export const PROGRESS_BUCKETS = [25, 50, 75, 100] as const;
export type ProgressBucket = (typeof PROGRESS_BUCKETS)[number];

export function crossedProgressBuckets(previous: number, next: number): ProgressBucket[] {
  return PROGRESS_BUCKETS.filter((bucket) => previous < bucket && next >= bucket);
}
