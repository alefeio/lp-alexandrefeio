export type StudyCard = {
  slug: string;
  title: string;
  percent: number;
};

export type StudentAreaState = {
  continue:
    | { kind: "empty" }
    | { kind: "resume"; lesson: StudyCard }
    | { kind: "completed"; headline: string; next: { slug: string; title: string } | null };
  learning: Array<StudyCard & { status: "in_progress" | "completed" }>;
};

/** A home autenticada separa o que ainda está aberto do que já foi concluído. */
export function studentAreaState(input: {
  inProgress: StudyCard[];
  completed: StudyCard[];
  nextLesson: { slug: string; title: string } | null;
}): StudentAreaState {
  const learning = [
    ...input.inProgress.map((lesson) => ({ ...lesson, status: "in_progress" as const })),
    ...input.completed.map((lesson) => ({ ...lesson, status: "completed" as const })),
  ];

  const current = input.inProgress[0];
  if (current) return { continue: { kind: "resume", lesson: current }, learning };

  if (input.completed.length > 0) {
    return {
      continue: {
        kind: "completed",
        headline: input.completed.length === 1 ? "Você concluiu sua primeira aula." : "Você já concluiu aulas.",
        next: input.nextLesson,
      },
      learning,
    };
  }

  return { continue: { kind: "empty" }, learning };
}
