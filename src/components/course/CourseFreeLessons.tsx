import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import type { LessonExperience } from "@/lib/learning/course-experience";
import type { SalesLesson } from "@/components/course/sales-types";

export function CourseFreeLessons({
  courseSlug,
  title,
  lessons,
  experiences,
  ownedLessonIds,
}: {
  courseSlug: string;
  title: string;
  lessons: SalesLesson[];
  experiences: Record<string, LessonExperience>;
  ownedLessonIds: string[];
}) {
  const owned = new Set(ownedLessonIds);
  return (
    <section id="aulas-gratuitas" className="scroll-mt-24 overflow-x-clip border-t border-border py-16">
      <Container>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">Experimente a metodologia com seu próprio negócio.</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {lessons.map((lesson) => {
            const experience = experiences[lesson.slug];
            return (
              <li key={lesson.id} className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-lg font-medium">{lesson.title}</h3>
                {experience ? (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-cta">Aprende</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{experience.learns[0]}</p>
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-cta">Leva</p>
                    <p className="mt-1 text-sm font-medium">{experience.outcome}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{lesson.summary}</p>
                )}
                {lesson.estimatedMinutes ? <p className="mt-3 text-sm text-muted">≈ {lesson.estimatedMinutes} min</p> : null}
                {lesson.hasBody ? (
                  <AcquisitionLink
                    className={`${buttonClass("primary")} mt-4 w-full sm:w-auto`}
                    href={`/aulas/${lesson.slug}`}
                    event="course_free_start"
                    payload={{ course_slug: courseSlug, lesson_slug: lesson.slug, cta_name: "comecar_aula" }}
                  >
                    {owned.has(lesson.id) ? "Continuar aula" : "Começar aula gratuita"}
                  </AcquisitionLink>
                ) : (
                  <p className="mt-4 text-sm text-muted">Em preparação.</p>
                )}
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
