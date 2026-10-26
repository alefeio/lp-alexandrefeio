import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { ViewEvent } from "@/components/analytics/ViewEvent";
import { ProductFlow, SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";
import { catalogPageCopy } from "@/lib/learning/catalog-copy";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { courseChoiceScenarios } from "@/lib/learning/course-paths";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { collectionPageJsonLd } from "@/lib/seo/learning-jsonld";

const trafficSteps = ["Mapa", "Campanha", "Dados", "Decisão"];
const linkClass = "text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta";

function FormationPanel({ course }: { course: CourseCatalogCard }) {
  const experience = courseExperience(course.slug);
  const benefits = experience?.benefits.slice(0, 4) ?? [];
  const started = course.ctaLabel === "Continuar curso";

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 motion-safe:transition-transform motion-safe:duration-200 sm:p-6 motion-safe:hover:-translate-y-0.5">
      {course.progress ? (
        <p className="text-sm font-medium text-cta">
          {course.progress.label} · {course.progress.detail}
        </p>
      ) : (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Formação</p>
      )}
      <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{course.title}</h2>
      {experience ? <p className="mt-3 text-base leading-relaxed">{experience.transformation}</p> : <p className="mt-3 text-base leading-relaxed">{course.summary}</p>}
      {experience ? <p className="mt-2 text-sm leading-relaxed text-muted">{experience.shortOutcome}</p> : null}
      <p className="mt-4 text-sm text-muted">
        {course.lessonCount} aulas · {course.moduleCount} módulos
        {course.freeLessonCount > 0 ? ` · ${course.freeLessonCount} gratuitas` : ""}
      </p>
      <div className="mt-5 min-w-0">
        {course.slug === TRAFFIC_COURSE_SLUG ? <TrafficCampaignVisual steps={trafficSteps} title="Da campanha à decisão" /> : null}
        {course.slug === SITES_COURSE_SLUG ? <SitesPageVisual /> : null}
      </div>
      {experience ? (
        <div className="mt-4">
          <ProductFlow steps={course.slug === TRAFFIC_COURSE_SLUG ? trafficSteps : experience.outcomeSteps} label="Etapas da formação" />
        </div>
      ) : null}
      {benefits.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {benefits.map((benefit) => (
            <li key={benefit} className="text-sm leading-relaxed">{benefit}</li>
          ))}
        </ul>
      ) : null}
      {!started && course.microcopy ? <p className="mt-4 text-sm font-medium text-cta">{course.microcopy}</p> : null}
      <p className="mt-6">
        <AcquisitionLink
          className={buttonClass(started ? "primary" : "secondary")}
          href={course.href}
          event="course_catalog_click"
          payload={{ course_slug: course.slug, cta_name: started ? "continuar_curso" : "conhecer_o_curso" }}
        >
          {course.ctaLabel}
        </AcquisitionLink>
      </p>
    </article>
  );
}

function CatalogPaths({ courses }: { courses: CourseCatalogCard[] }) {
  const bySlug = new Map(courses.map((course) => [course.slug, course]));
  const hints = courseChoiceScenarios.flatMap((scenario) => {
    if (!scenario.catalog) return [];
    const links = scenario.links.flatMap((link) => {
      const course = bySlug.get(link.slug);
      return course ? [{ ...link, href: course.href }] : [];
    });
    return links.length > 0 ? [{ ...scenario, links }] : [];
  });
  if (hints.length === 0) return null;

  return (
    <section className="mt-14 border-t border-border pt-10" aria-label="Não sabe por onde começar">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Não sabe por onde começar?</h2>
      <p className="mt-3 text-sm font-medium uppercase tracking-[0.14em] text-muted">Se o problema é</p>
      <ul className="mt-4 grid gap-3">
        {hints.map((hint) => (
          <li key={hint.id} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="text-base font-medium">{hint.catalog}</p>
            <div className="flex flex-col gap-2 sm:items-end">
              {hint.catalogNote ? <p className="text-sm text-muted">{hint.catalogNote}</p> : null}
              <div className="flex flex-wrap gap-3">
                {hint.links.map((link) => (
                  <AcquisitionLink key={link.slug} className={linkClass} href={link.href} event="course_catalog_path_click" payload={{ course_slug: link.slug, scenario: hint.id }}>
                    {link.shortLabel}
                  </AcquisitionLink>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CourseCatalog({ courses }: { courses: CourseCatalogCard[] }) {
  const traffic = courses.find((course) => course.slug === TRAFFIC_COURSE_SLUG);
  const sites = courses.find((course) => course.slug === SITES_COURSE_SLUG);
  const rest = courses.filter((course) => course.slug !== TRAFFIC_COURSE_SLUG && course.slug !== SITES_COURSE_SLUG);

  return (
    <>
      <ViewEvent event="course_catalog_view" slug="cursos" />
      <JsonLd
        data={collectionPageJsonLd({
          name: catalogPageCopy.eyebrow,
          description: catalogPageCopy.description,
          path: "/cursos",
          courses: courses.map((course) => ({ name: course.title, path: course.href })),
        })}
      />
      <Container className="max-w-5xl py-14 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{catalogPageCopy.eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-[1.85rem] font-semibold leading-[1.12] tracking-tight sm:text-4xl">{catalogPageCopy.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{catalogPageCopy.support}</p>
        <div className="mt-6">
          <ProductFlow steps={catalogPageCopy.flow} label="Tráfego, página, ação, dados e decisão" />
        </div>

        {courses.length === 0 ? (
          <p className="mt-10 text-base text-muted">Nenhuma formação publicada no momento.</p>
        ) : (
          <div className="mt-10 grid gap-4">
            {traffic && sites ? (
              <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_8.5rem_minmax(0,1fr)]">
                <FormationPanel course={traffic} />
                <p className="flex items-center justify-center text-center text-sm font-medium leading-relaxed">O anúncio leva até a página.</p>
                <FormationPanel course={sites} />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {traffic ? <FormationPanel course={traffic} /> : null}
                {sites ? <FormationPanel course={sites} /> : null}
              </div>
            )}
            {rest.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {rest.map((course) => (
                  <FormationPanel key={course.id} course={course} />
                ))}
              </div>
            ) : null}
          </div>
        )}
        <CatalogPaths courses={courses} />
      </Container>
    </>
  );
}
