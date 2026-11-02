export type StageSourceBlock = {
  blockKey: string;
  retiredAt?: Date | string | null;
  data: {
    type: string;
    text?: string;
    title?: string;
    question?: string;
    prompt?: string;
  };
};

export type LessonStage<T extends StageSourceBlock = StageSourceBlock> = {
  id: string;
  title: string;
  blocks: T[];
  firstBlockId: string;
  lastBlockId: string;
  titleBlockId: string | null;
};

const ACTION_TYPES = new Set(["CHECKPOINT", "ACTIVITY", "CHECKLIST", "TOOL", "RESULT"]);

export function buildLessonStages<T extends StageSourceBlock>(blocks: readonly T[]): LessonStage<T>[] {
  const active = blocks.filter((block) => !block.retiredAt);
  const groups: T[][] = [];
  let current: T[] = [];

  function close() {
    if (current.length === 0) return;
    groups.push(current);
    current = [];
  }

  for (const block of active) {
    const startsStage =
      (block.data.type === "HEADING" || block.data.type === "CONCLUSION") && hasContext(current);
    if (startsStage) close();
    current.push(block);
  }
  close();

  return groups.map((group, index) => {
    const titleBlock = group.find((block) => block.data.type === "HEADING" && block.data.text?.trim());
    return {
      id: `stage:${group[0].blockKey}`,
      title: stageTitle(group, index),
      blocks: group,
      firstBlockId: group[0].blockKey,
      lastBlockId: group[group.length - 1].blockKey,
      titleBlockId: titleBlock?.blockKey ?? null,
    };
  });
}

export function stageContaining<T extends StageSourceBlock>(stages: readonly LessonStage<T>[], blockKey: string | null): LessonStage<T> | null {
  if (!blockKey) return stages[0] ?? null;
  return stages.find((stage) => stage.blocks.some((block) => block.blockKey === blockKey)) ?? null;
}

export function resumeStageId<T extends StageSourceBlock>(stages: readonly LessonStage<T>[], resumeBlockId: string | null): string | null {
  return stageContaining(stages, resumeBlockId)?.id ?? null;
}

export function stageIndexById(stages: readonly { id: string }[], id: string | null): number {
  if (!id) return -1;
  return stages.findIndex((stage) => stage.id === id);
}

/** O alcance visual só cresce. Voltar de etapa não reduz o índice já alcançado. */
export function visualReach(previousReach: number, activeIndex: number): number {
  return Math.max(previousReach, activeIndex);
}

export function stageVisitLabel(index: number, activeIndex: number, openedIndexes: readonly number[]): "Atual" | "Visitada" | "A seguir" {
  if (index === activeIndex) return "Atual";
  if (openedIndexes.includes(index)) return "Visitada";
  return "A seguir";
}

export function firstPendingStageId<T extends StageSourceBlock>(stages: readonly LessonStage<T>[], pendingBlockIds: readonly string[]): string | null {
  for (const blockId of pendingBlockIds) {
    const stage = stageContaining(stages, blockId);
    if (stage) return stage.id;
  }
  return null;
}

function hasContext(blocks: readonly StageSourceBlock[]): boolean {
  return blocks.some((block) => block.data.type !== "HEADING");
}

function stageTitle(blocks: readonly StageSourceBlock[], index: number): string {
  const heading = blocks.find((block) => block.data.type === "HEADING" && block.data.text?.trim());
  if (heading?.data.text) return heading.data.text.trim();
  const action = blocks.find((block) => ACTION_TYPES.has(block.data.type));
  const label = action?.data.question?.trim() || action?.data.prompt?.trim() || action?.data.title?.trim() || action?.data.text?.trim();
  if (label) return label;
  return `Etapa ${index + 1}`;
}
