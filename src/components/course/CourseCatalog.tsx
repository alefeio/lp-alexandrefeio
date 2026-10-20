import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { ViewEvent } from "@/components/analytics/ViewEvent";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { collectionPageJsonLd } from "@/lib/seo/learning-jsonld";

export function CourseCatalog({ courses }: { courses: CourseCatalogCard[] }) {
  return (
    <>
      <ViewEvent event="course_catalog_view" slug="cursos" />
      <JsonLd
        data={collectionPageJsonLd({
          name: "Cursos",
          description: "Aprenda aplicando em projetos reais, com ferramentas práticas para avançar do conhecimento à execução.",
          path: "/cursos",
          courses: courses.map((course) => ({ name: course.title, path: course.href })),
        })}
      />
      <Container className="max-w-5xl py-16 sm:py-24">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Cursos</p>
        <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">Cursos</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Aprenda aplicando em projetos reais, com ferramentas práticas para avançar do conhecimento à execução.
        </p>

        {courses.length === 0 ? (
          <p className="mt-10 text-base text-muted">Nenhum curso disponível no momento.</p>
        ) : (
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-col rounded-xl border border-border bg-surface p-6 shadow-[0_18px_40px_-34px_rgba(11,18,32,0.45)]">
                <div className="flex flex-wrap items-center gap-2">
                  {course.progress ? (
                    <span className="rounded-md bg-cta/10 px-2 py-1 text-xs font-medium text-cta">{course.progress.label}</span>
                  ) : null}
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{course.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">{course.summary}</p>
                <p className="mt-4 text-sm text-muted">
                  {course.lessonCount} aulas · {course.moduleCount} módulos · Ferramentas práticas
                </p>
                {course.progress ? <p className="mt-2 text-sm text-muted">{course.progress.detail}</p> : null}
                <p className="mt-6">
                  <AcquisitionLink
                    className={buttonClass("primary")}
                    href={course.href}
                    event="course_catalog_click"
                    payload={{ course_slug: course.slug, cta_name: course.ctaLabel === "Continuar curso" ? "continuar_curso" : "ver_curso" }}
                  >
                    {course.ctaLabel}
                  </AcquisitionLink>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
