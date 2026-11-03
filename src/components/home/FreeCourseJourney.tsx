import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

const order = [TRAFFIC_COURSE_SLUG, SITES_COURSE_SLUG] as const;

const labels: Record<(typeof order)[number], { title: string; cta: string; highlights: string[] }> = {
  [TRAFFIC_COURSE_SLUG]: {
    title: "TRÁFEGO PAGO",
    cta: "Começar Tráfego Pago",
    highlights: ["Mapa de tráfego", "Escolha de canal", "Diagnóstico de prontidão"],
  },
  [SITES_COURSE_SLUG]: {
    title: "SITES QUE CONVERTEM",
    cta: "Começar Sites que Convertem",
    highlights: ["Mapa de conversão", "Estrutura digital ideal", "Diagnóstico da página"],
  },
};

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
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{publicHomeCopy.freeTitle}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{publicHomeCopy.freeSupport}</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {columns.map((course) => {
            const meta = labels[course.slug as (typeof order)[number]];
            const first = course.freeLessons[0];
            if (!meta || !first) return null;
            const experience = courseExperience(course.slug);
            const outcomes = meta.highlights.length
              ? meta.highlights
              : (experience?.lessons.slice(0, 3).map((lesson) => lesson.outcome) ?? []);
            return (
              <article key={course.id} className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-cta">{meta.title}</h3>
                <p className="mt-3 text-base font-medium">{course.freeLessonCount} aulas gratuitas</p>
                <ul className="mt-4 grid gap-2">
                  {outcomes.map((item) => (
                    <li key={item} className="text-sm leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-6">
                  <AcquisitionLink
                    className={buttonClass("primary", "w-full sm:w-auto")}
                    href={`/aulas/${first.slug}`}
                    event="course_free_start"
                    payload={{ course_slug: course.slug, lesson_slug: first.slug, cta_name: "comecar_gratuitamente" }}
                  >
                    {meta.cta}
                  </AcquisitionLink>
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
