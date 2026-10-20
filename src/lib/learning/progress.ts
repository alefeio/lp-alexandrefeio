import { campaignBriefLinkSchema } from "@/lib/learning/campaign-brief";
import {
  activityResponseSchema,
  checklistResponseSchema,
  checkpointResponseSchema,
  toolResponseSchema,
  type LessonBlockData,
} from "@/lib/learning/blocks";
import { journeyMapResponseSchema } from "@/lib/learning/conversion-journey-map";
import { digitalPresenceResponseSchema } from "@/lib/learning/digital-presence-decision";
import { pageReadinessResponseSchema } from "@/lib/learning/conversion-page-readiness";

const EMPTY_BRIEF_PROJECTS: ReadonlySet<string> = new Set();
const EMPTY_PLAN_PROJECTS: ReadonlySet<string> = new Set();

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

/** Faixa mínima que precisa cruzar o viewport. Blocos mais baixos contam inteiros. */
export const READING_MIN_VISIBLE_PX = 48;

export function isViewCompletedType(type: LessonBlockData["type"]): boolean {
  return VIEW_COMPLETE.has(type);
}

/** Leitura que entra no percentual. Título de seção não entra. */
export function countsAsReading(type: LessonBlockData["type"]): boolean {
  return isViewCompletedType(type) && type !== "HEADING";
}

export type ReadingSpan = {
  blockKey: string;
  top: number;
  bottom: number;
  countsAsReading: boolean;
};

/**
 * Registra o bloco de leitura quando pelo menos uma faixa mínima dele
 * cruza a região varrida pelo scroll. Um salto de índice passa `jumping`
 * e não marca o que ficou para trás; ao pousar, a chamada usa o mesmo
 * scroll nos dois extremos e só vê o viewport de destino.
 */
export function readingKeysFromUserScroll(input: {
  blocks: ReadingSpan[];
  previousScrollY: number;
  currentScrollY: number;
  viewportHeight: number;
  jumping: boolean;
}): string[] {
  if (input.jumping || input.viewportHeight <= 0) return [];
  const sweepTop = Math.min(input.previousScrollY, input.currentScrollY);
  const sweepBottom = Math.max(input.previousScrollY, input.currentScrollY) + input.viewportHeight;
  const keys: string[] = [];
  for (const block of input.blocks) {
    if (!block.countsAsReading) continue;
    const height = block.bottom - block.top;
    if (!(height > 0)) continue;
    const overlap = Math.min(block.bottom, sweepBottom) - Math.max(block.top, sweepTop);
    const minimum = Math.min(height, READING_MIN_VISIBLE_PX);
    if (overlap + 0.5 >= minimum) keys.push(block.blockKey);
  }
  return keys;
}

export function hasUnreadEarlierReading(
  blocks: { blockKey: string; position: number; countsForProgress: boolean; type: LessonBlockData["type"] }[],
  completedKeys: readonly string[],
  currentKey: string | null,
): boolean {
  if (!currentKey) return false;
  const current = blocks.find((block) => block.blockKey === currentKey);
  if (!current) return false;
  const done = new Set(completedKeys);
  return blocks.some(
    (block) =>
      block.position < current.position &&
      block.countsForProgress &&
      countsAsReading(block.type) &&
      !done.has(block.blockKey),
  );
}

export function isBlockComplete(
  block: ProgressRuleBlock,
  answer: BlockAnswer | undefined,
  lessonResultSaved: boolean,
  briefProjectIds: ReadonlySet<string> = EMPTY_BRIEF_PROJECTS,
  planProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  blueprintProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  keywordProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  adProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  metaProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  leadProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  diagnosisProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  nextActionProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
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
    case "TOOL":
      if (block.data.toolKey === "CONVERSION_JOURNEY_MAP_V1") {
        return journeyMapResponseSchema.safeParse(answer?.response).success;
      }
      if (block.data.toolKey === "DIGITAL_PRESENCE_DECISION_V1") {
        return digitalPresenceResponseSchema.safeParse(answer?.response).success;
      }
      if (block.data.toolKey === "CONVERSION_PAGE_READINESS_V1") {
        return pageReadinessResponseSchema.safeParse(answer?.response).success;
      }
      if (
        block.data.toolKey === "CAMPAIGN_BRIEF_V1" ||
        block.data.toolKey === "DESTINATION_MEASUREMENT_PLAN_V1" ||
        block.data.toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1" ||
        block.data.toolKey === "KEYWORD_INTENT_PLAN_V1" ||
        block.data.toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1" ||
        block.data.toolKey === "META_CAMPAIGN_BLUEPRINT_V1" ||
        block.data.toolKey === "META_LEAD_CONVERSION_PLAN_V1" ||
        block.data.toolKey === "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1" ||
        block.data.toolKey === "CAMPAIGN_NEXT_ACTION_PLAN_V1"
      ) {
        const parsed = campaignBriefLinkSchema.safeParse(answer?.response);
        const ids =
          block.data.toolKey === "CAMPAIGN_BRIEF_V1"
            ? briefProjectIds
            : block.data.toolKey === "DESTINATION_MEASUREMENT_PLAN_V1"
              ? planProjectIds
              : block.data.toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1"
                ? blueprintProjectIds
                : block.data.toolKey === "KEYWORD_INTENT_PLAN_V1"
                  ? keywordProjectIds
                  : block.data.toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1"
                    ? adProjectIds
                    : block.data.toolKey === "META_CAMPAIGN_BLUEPRINT_V1"
                      ? metaProjectIds
                      : block.data.toolKey === "META_LEAD_CONVERSION_PLAN_V1"
                        ? leadProjectIds
                        : block.data.toolKey === "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1"
                          ? diagnosisProjectIds
                          : nextActionProjectIds;
        return parsed.success && ids.has(parsed.data.projectId);
      }
      return toolResponseSchema.safeParse(answer?.response).success;
    default:
      return viewed;
  }
}

export function progressPercent(
  blocks: ProgressRuleBlock[],
  answers: Record<string, BlockAnswer | undefined>,
  lessonResultSaved: boolean,
  briefProjectIds: ReadonlySet<string> = EMPTY_BRIEF_PROJECTS,
  planProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  blueprintProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  keywordProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  adProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  metaProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  leadProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  diagnosisProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  nextActionProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
): number {
  const counting = blocks.filter((block) => !block.retiredAt && block.countsForProgress);
  if (counting.length === 0) return 0;
  const done = counting.filter((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved, briefProjectIds, planProjectIds, blueprintProjectIds, keywordProjectIds, adProjectIds, metaProjectIds, leadProjectIds, diagnosisProjectIds, nextActionProjectIds)).length;
  return Math.round((done / counting.length) * 100);
}

export function isLessonComplete(
  blocks: ProgressRuleBlock[],
  answers: Record<string, BlockAnswer | undefined>,
  lessonResultSaved: boolean,
  briefProjectIds: ReadonlySet<string> = EMPTY_BRIEF_PROJECTS,
  planProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  blueprintProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  keywordProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  adProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  metaProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  leadProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  diagnosisProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  nextActionProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
): boolean {
  const active = blocks.filter((block) => !block.retiredAt);
  const counting = active.filter((block) => block.countsForProgress);
  if (counting.length === 0) return false;
  const countingDone = counting.every((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved, briefProjectIds, planProjectIds, blueprintProjectIds, keywordProjectIds, adProjectIds, metaProjectIds, leadProjectIds, diagnosisProjectIds, nextActionProjectIds));
  const requiredDone = active
    .filter((block) => block.required)
    .every((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved, briefProjectIds, planProjectIds, blueprintProjectIds, keywordProjectIds, adProjectIds, metaProjectIds, leadProjectIds, diagnosisProjectIds, nextActionProjectIds));
  return countingDone && requiredDone;
}

export function completedBlockKeys(
  blocks: ProgressRuleBlock[],
  answers: Record<string, BlockAnswer | undefined>,
  lessonResultSaved: boolean,
  briefProjectIds: ReadonlySet<string> = EMPTY_BRIEF_PROJECTS,
  planProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  blueprintProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  keywordProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  adProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  metaProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  leadProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  diagnosisProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
  nextActionProjectIds: ReadonlySet<string> = EMPTY_PLAN_PROJECTS,
): string[] {
  return blocks
    .filter((block) => isBlockComplete(block, answers[block.blockKey], lessonResultSaved, briefProjectIds, planProjectIds, blueprintProjectIds, keywordProjectIds, adProjectIds, metaProjectIds, leadProjectIds, diagnosisProjectIds, nextActionProjectIds))
    .map((block) => block.blockKey);
}

export const PROGRESS_BUCKETS = [25, 50, 75, 100] as const;
export type ProgressBucket = (typeof PROGRESS_BUCKETS)[number];

export function crossedProgressBuckets(previous: number, next: number): ProgressBucket[] {
  return PROGRESS_BUCKETS.filter((bucket) => previous < bucket && next >= bucket);
}

export function lessonProgressEvents(previous: number, next: number): Array<{
  event: "lesson_progress" | "lesson_completed";
  bucket: ProgressBucket;
}> {
  return crossedProgressBuckets(previous, next).map((bucket) =>
    bucket === 100 ? { event: "lesson_completed", bucket } : { event: "lesson_progress", bucket },
  );
}

export function remainingMinutes(estimatedMinutes: number | null, percent: number, completed: boolean): number | null {
  if (completed || estimatedMinutes == null || estimatedMinutes < 1 || percent <= 0 || percent >= 100) return null;
  return Math.max(1, Math.round((estimatedMinutes * (100 - percent)) / 100));
}

export type CheckpointFeedback = Record<string, { correct: boolean; explanation?: string }>;

export function savedCheckpointFeedback(
  blocks: ProgressRuleBlock[],
  responses: Record<string, unknown>,
): CheckpointFeedback {
  const feedback: CheckpointFeedback = {};
  for (const block of blocks) {
    if (block.retiredAt || block.data.type !== "CHECKPOINT") continue;
    const parsed = checkpointResponseSchema.safeParse(responses[block.blockKey]);
    if (!parsed.success) continue;
    feedback[block.blockKey] = {
      correct: isBlockComplete(block, { viewed: true, response: parsed.data }, false),
      ...(block.data.explanation ? { explanation: block.data.explanation } : {}),
    };
  }
  return feedback;
}
