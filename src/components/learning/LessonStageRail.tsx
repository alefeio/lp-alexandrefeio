import { stageVisitLabel, type LessonStage, type StageSourceBlock } from "@/lib/learning/lesson-stages";

export function LessonStageRail<T extends StageSourceBlock>({
  stages,
  activeId,
  openedIndexes,
  onSelect,
}: {
  stages: readonly LessonStage<T>[];
  activeId: string;
  openedIndexes: readonly number[];
  onSelect: (stageId: string) => void;
}) {
  const activeIndex = stages.findIndex((stage) => stage.id === activeId);

  return (
    <nav aria-label="Etapas da aula">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Aula</p>
      <ol className="mt-3 space-y-1">
        {stages.map((stage, index) => {
          const current = stage.id === activeId;
          const label = stageVisitLabel(index, activeIndex, openedIndexes);
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={current ? "min-h-12 w-full rounded-md px-2 py-2 text-left text-sm font-medium text-foreground" : "min-h-12 w-full rounded-md px-2 py-2 text-left text-sm text-muted"}
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(stage.id)}
              >
                <span className="block break-words">
                  {index + 1}. {stage.title}
                </span>
                <span className="mt-0.5 block text-xs">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
