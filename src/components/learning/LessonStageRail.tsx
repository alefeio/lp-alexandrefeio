import { stageVisitLabel, type LessonStage, type StageSourceBlock } from "@/lib/learning/lesson-stages";

export function LessonStageRail<T extends StageSourceBlock>({
  stages,
  activeId,
  openedIndexes,
  onSelect,
  courseTitle,
  moduleTitle,
}: {
  stages: readonly LessonStage<T>[];
  activeId: string;
  openedIndexes: readonly number[];
  onSelect: (stageId: string) => void;
  courseTitle?: string;
  moduleTitle?: string;
}) {
  const activeIndex = stages.findIndex((stage) => stage.id === activeId);

  return (
    <nav aria-label="Etapas da aula" className="classroom-rail">
      {courseTitle ? (
        <p className="classroom-rail__course">{courseTitle}</p>
      ) : (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Aula</p>
      )}
      {moduleTitle ? <p className="classroom-rail__module">{moduleTitle}</p> : null}
      <ol className="classroom-rail__list">
        {stages.map((stage, index) => {
          const current = stage.id === activeId;
          const label = stageVisitLabel(index, activeIndex, openedIndexes);
          const visited = openedIndexes.includes(index) && !current;
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={
                  current
                    ? "classroom-rail__item classroom-rail__item--current"
                    : visited
                      ? "classroom-rail__item classroom-rail__item--visited"
                      : "classroom-rail__item"
                }
                aria-current={current ? "step" : undefined}
                onClick={() => onSelect(stage.id)}
              >
                <span className="classroom-rail__index" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="classroom-rail__copy">
                  <span className="classroom-rail__title">{stage.title}</span>
                  <span className="classroom-rail__state">{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
