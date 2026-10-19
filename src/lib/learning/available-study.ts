export type StudyAccess = {
  lessonId: string;
  slug: string;
  title: string;
  status: string;
};

/** Acesso ativo que ainda não tem progresso. Aula iniciada ou revogada fica de fora. */
export function lessonsAvailableToStudy(access: StudyAccess[], startedLessonIds: Iterable<string>) {
  const started = new Set(startedLessonIds);
  return access
    .filter((item) => item.status === "ACTIVE" && item.lessonId && !started.has(item.lessonId))
    .map((item) => ({ lessonId: item.lessonId, slug: item.slug, title: item.title }));
}
