import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";

const trafficSteps = ["Mapa", "Campanha", "Dados", "Decisão"];

function CoursePanel({
  course,
  headline,
  cta,
  ctaName,
  visual,
}: {
  course: CourseCatalogCard;
  headline: string;
  cta: string;
  ctaName: string;
  visual: "traffic" | "sites";
}) {
  const experience = courseExperience(course.slug);
  const steps = experience?.outcomeSteps ?? [];
  const benefits = experience?.benefits.slice(0, 4) ?? [];

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Formação</p>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{course.title}</h3>
      <p className="mt-2 text-base font-medium leading-snug">{headline}</p>
      {experience ? <p className="mt-3 text-sm leading-relaxed text-muted">{experience.shortOutcome}</p> : null}
      <p className="mt-3 text-sm text-muted">
        {course.lessonCount} aulas · {course.moduleCount} módulos
        {course.freeLessonCount > 0 ? ` · ${course.freeLessonCount} gratuitas` : ""}
      </p>
      <div className="mt-5 min-w-0">
        {visual === "traffic" ? <TrafficCampaignVisual steps={trafficSteps} title="Da campanha à decisão" /> : <SitesPageVisual />}
      </div>
      {steps.length > 0 ? (
        <ol className="mt-4 flex flex-wrap items-center gap-2" aria-label="Etapas da formação">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">{step}</span>
              {index < steps.length - 1 ? <span aria-hidden className="text-muted">→</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {benefits.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {benefits.map((benefit) => (
            <li key={benefit} className="text-sm leading-relaxed">{benefit}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-6">
        <AcquisitionLink className={buttonClass("primary", "w-full sm:w-auto")} href={course.href} event="course_cta_click" payload={{ course_slug: course.slug, cta_name: ctaName }}>
          {cta}
        </AcquisitionLink>
      </p>
    </article>
  );
}

export function ConnectedCourses({ courses }: { courses: CourseCatalogCard[] }) {
  const traffic = courses.find((course) => course.slug === TRAFFIC_COURSE_SLUG);
  const sites = courses.find((course) => course.slug === SITES_COURSE_SLUG);
  if (!traffic && !sites) return null;

  return (
    <section id="formacoes" className="scroll-mt-24 border-t border-border py-20 lg:py-24">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Duas formações. Um único sistema.</h2>
        <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)]">
          {traffic ? (
            <CoursePanel course={traffic} headline="Atraia e aprenda com os dados." cta="Conhecer Tráfego Pago" ctaName="conhecer_trafego" visual="traffic" />
          ) : null}
          <div className="flex min-w-0 flex-col items-center justify-center gap-3 px-2 py-4 text-center">
            <p className="text-sm font-medium leading-relaxed">O anúncio leva até a página. A página prepara a ação.</p>
            <ol className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium" aria-label="Tráfego, página e ação">
              {["Tráfego", "Página", "Ação"].map((step, index, list) => (
                <li key={step} className="flex items-center gap-2">
                  <span>{step}</span>
                  {index < list.length - 1 ? <span aria-hidden>→</span> : null}
                </li>
              ))}
            </ol>
          </div>
          {sites ? (
            <CoursePanel course={sites} headline="Construa o destino." cta="Conhecer Sites que Convertem" ctaName="conhecer_sites" visual="sites" />
          ) : null}
        </div>
        <p className="mt-8">
          <Link className={navigationLinkClass()} href="/cursos">
            Ver todas as formações
          </Link>
        </p>
      </Container>
    </section>
  );
}
