export const COPY_ASSIST_LESSON_SLUG = "mensagem-que-deixa-a-oferta-clara";
export const COPY_ASSIST_EDITOR_ROLE = "ADMIN";

export function copyAssistAccessDecision(input: {
  role: string | null | undefined;
  courseStatus: "DRAFT" | "PUBLISHED" | null;
  lessonStatus: "DRAFT" | "PUBLISHED" | null;
  lessonInCourse: boolean;
  entitled: boolean;
}): boolean {
  if (!input.lessonInCourse || !input.courseStatus) return false;
  if (input.role === COPY_ASSIST_EDITOR_ROLE) return true;
  if (input.courseStatus !== "PUBLISHED") return false;
  if (input.lessonStatus !== "PUBLISHED") return false;
  return input.entitled;
}
