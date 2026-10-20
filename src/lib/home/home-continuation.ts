import { firstGivenName } from "@/lib/home/student-home";
import { LESSON_01_SLUG } from "@/lib/learning/lesson-01";
import { LESSON_02_SLUG } from "@/lib/learning/lesson-02";
import { LESSON_03_SLUG } from "@/lib/learning/lesson-03";
import { LESSON_04_SLUG } from "@/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "@/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "@/lib/learning/lesson-06";
import { LESSON_07_SLUG } from "@/lib/learning/lesson-07";
import { LESSON_08_SLUG } from "@/lib/learning/lesson-08";
import { LESSON_09_SLUG } from "@/lib/learning/lesson-09";
import { LESSON_10_SLUG } from "@/lib/learning/lesson-10";
import { LESSON_11_SLUG } from "@/lib/learning/lesson-11";
import { LESSON_12_SLUG } from "@/lib/learning/lesson-12";

export type JourneyStageId = "entender" | "planejar" | "anunciar" | "medir" | "decidir";

export const JOURNEY_STAGES: ReadonlyArray<{
  id: JourneyStageId;
  label: string;
  slugs: readonly string[];
}> = [
  { id: "entender", label: "Entender", slugs: [LESSON_01_SLUG, LESSON_02_SLUG, LESSON_03_SLUG] },
  { id: "planejar", label: "Planejar", slugs: [LESSON_04_SLUG, LESSON_05_SLUG] },
  { id: "anunciar", label: "Anunciar", slugs: [LESSON_06_SLUG, LESSON_07_SLUG, LESSON_08_SLUG, LESSON_09_SLUG, LESSON_10_SLUG] },
  { id: "medir", label: "Medir", slugs: [LESSON_11_SLUG] },
  { id: "decidir", label: "Decidir", slugs: [LESSON_12_SLUG] },
];

export type HomeContinuationKind = "start" | "resume" | "completed";

export type HomeContinuationCard = {
  userId: string;
  kind: HomeContinuationKind;
  greeting: string;
  line: string;
  progress: string | null;
  ctaLabel: string;
  ctaHref: string;
};

export type ContinuationLesson = {
  slug: string;
  title: string;
  number: number;
  accessible: boolean;
  completed: boolean;
  inProgress: boolean;
  percent: number;
};

export function stageForSlug(slug: string): (typeof JOURNEY_STAGES)[number] | null {
  return JOURNEY_STAGES.find((stage) => stage.slugs.includes(slug)) ?? null;
}

export function currentJourneyStage(lessons: ContinuationLesson[]): {
  id: JourneyStageId | null;
  label: string | null;
  status: "start" | "current" | "completed";
} {
  const accessible = lessons.filter((lesson) => lesson.accessible);
  if (accessible.length === 0) return { id: null, label: null, status: "start" };
  if (accessible.every((lesson) => lesson.completed)) {
    return { id: "decidir", label: "Decidir", status: "completed" };
  }
  for (const stage of JOURNEY_STAGES) {
    const inStage = accessible.filter((lesson) => stage.slugs.includes(lesson.slug));
    if (inStage.length === 0) continue;
    if (inStage.every((lesson) => lesson.completed)) continue;
    return { id: stage.id, label: stage.label, status: "current" };
  }
  return { id: null, label: null, status: "start" };
}

export function buildHomeContinuation(input: {
  userId: string;
  name: string;
  lessons: ContinuationLesson[];
}): HomeContinuationCard {
  const firstName = firstGivenName(input.name) || "olá";
  const greeting = firstName === "olá" ? "Olá 👋" : `Olá, ${firstName} 👋`;
  const accessible = input.lessons.filter((lesson) => lesson.accessible);
  const resume = accessible.find((lesson) => lesson.inProgress);
  const stage = currentJourneyStage(input.lessons);
  const allDone = accessible.length > 0 && accessible.every((lesson) => lesson.completed);

  if (allDone || stage.status === "completed") {
    return {
      userId: input.userId,
      kind: "completed",
      greeting,
      line: "Curso concluído ✓",
      progress: "Seu próximo passo está no seu Plano Vivo.",
      ctaLabel: "Ir para meu dashboard",
      ctaHref: "/app",
    };
  }

  if (!resume && accessible.every((lesson) => !lesson.completed && !lesson.inProgress)) {
    return {
      userId: input.userId,
      kind: "start",
      greeting,
      line: "Sua jornada começa aqui.",
      progress: null,
      ctaLabel: "Começar minha jornada",
      ctaHref: "/app",
    };
  }

  if (resume) {
    return {
      userId: input.userId,
      kind: "resume",
      greeting,
      line: stage.label ? `Você está na etapa “${stage.label}”.` : "Você está avançando na sua jornada.",
      progress: `Aula ${resume.number} · ${resume.percent}% concluída`,
      ctaLabel: "Continuar minha jornada",
      ctaHref: "/app",
    };
  }

  const nextOpen = accessible.find((lesson) => !lesson.completed);
  return {
    userId: input.userId,
    kind: "resume",
    greeting,
    line: stage.label ? `Você está na etapa “${stage.label}”.` : "Continue a sua jornada.",
    progress: nextOpen ? `Aula ${nextOpen.number} · ${nextOpen.title}` : null,
    ctaLabel: "Continuar minha jornada",
    ctaHref: "/app",
  };
}

export function homeContinuationHasPrivateKeys(card: HomeContinuationCard): boolean {
  const blob = JSON.stringify(card);
  return ["email", "answers", "payload", "password", "resultSnapshot"].some((key) => blob.includes(`"${key}"`));
}
