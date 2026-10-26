import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";

export function HomeCourseSummaries({ courses }: { courses: CourseCatalogCard[] }) {
  return (
    <section className="border-t border-border py-16" aria-label="As duas formações">
      <Container>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">As formações</h2>
        {courses.length === 0 ? (
          <p className="mt-6 text-base text-muted">Nenhuma formação publicada no momento.</p>
        ) : (
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id}>
                <article className="flex h-full min-w-0 flex-col rounded-2xl border border-border bg-surface p-6">
                  <h3 className="text-xl font-semibold tracking-tight">{course.title}</h3>
                  <p className="mt-3 text-sm text-muted">
                    {course.lessonCount} aulas · {course.moduleCount} módulos
                    {course.freeLessonCount > 0 ? ` · ${course.freeLessonCount} gratuitas` : ""}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-muted">{course.summary}</p>
                  <p className="mt-6">
                    <AcquisitionLink className={buttonClass("secondary")} href={course.href} event="course_cta_click" payload={{ course_slug: course.slug, cta_name: "resumo_curso" }}>
                      {course.ctaLabel}
                    </AcquisitionLink>
                  </p>
                </article>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6">
          <Link className="text-sm font-medium underline underline-offset-4" href="/cursos">
            Ver o catálogo
          </Link>
        </p>
      </Container>
    </section>
  );
}
