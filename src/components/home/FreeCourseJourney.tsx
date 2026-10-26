import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

const order = [TRAFFIC_COURSE_SLUG, SITES_COURSE_SLUG];

export function FreeCourseJourney({ courses }: { courses: CourseCatalogCard[] }) {
  const columns = order.flatMap((slug) => {
    const course = courses.find((item) => item.slug === slug);
    if (!course || course.freeLessons.length === 0) return [];
    return [course];
  });
  if (columns.length === 0) return null;

  return (
    <section id="aulas-gratuitas" className="scroll-mt-24 border-t border-border py-16">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Descubra seu gargalo antes de comprar.</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">São seis aulas gratuitas para aplicar no seu próprio negócio.</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {columns.map((course) => {
            const experience = courseExperience(course.slug);
            return (
              <div key={course.id} className="min-w-0">
                <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-cta">{course.title}</h3>
                <ol className="mt-4 grid gap-3">
                  {course.freeLessons.map((lesson) => {
                    const detail = experience?.lessons.find((item) => item.slug === lesson.slug);
                    return (
                      <li key={lesson.slug} className="min-w-0 rounded-xl border border-border bg-surface p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Aula {lesson.number}</p>
                        <h4 className="mt-1 text-base font-medium leading-snug">{lesson.title}</h4>
                        {detail ? (
                          <div className="mt-3 grid gap-3">
                            <p className="text-sm leading-relaxed">
                              <span className="font-medium">Aprende </span>
                              {detail.learns[0]}
                            </p>
                            <p className="text-sm leading-relaxed">
                              <span className="font-medium">Leva </span>
                              {detail.outcome}
                            </p>
                          </div>
                        ) : null}
                        <p className="mt-4">
                          <AcquisitionLink
                            className="text-sm font-medium underline underline-offset-4"
                            href={`/aulas/${lesson.slug}`}
                            event="course_free_start"
                            payload={{ course_slug: course.slug, lesson_slug: lesson.slug, cta_name: "comecar_gratuitamente" }}
                          >
                            Começar gratuitamente
                          </AcquisitionLink>
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
