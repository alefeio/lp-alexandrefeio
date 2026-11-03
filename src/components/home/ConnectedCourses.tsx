import Link from "next/link";
import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { publicHomeCopy } from "@/lib/home/public-home";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";

const trafficSteps = ["Mapa", "Campanha", "Dados", "Próxima ação"];

function CoursePanel({
  course,
  title,
  promise,
  cta,
  ctaName,
  pathScenario,
  visual,
}: {
  course: CourseCatalogCard;
  title: string;
  promise: string;
  cta: string;
  ctaName: string;
  pathScenario: string;
  visual: "traffic" | "sites";
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-base leading-snug">{promise}</p>
      <div className="mt-5 min-w-0">
        {visual === "traffic" ? <TrafficCampaignVisual steps={trafficSteps} title="Da campanha à decisão" /> : <SitesPageVisual />}
      </div>
      <p className="mt-4 text-sm text-muted">
        {course.freeLessonCount} aulas grátis · {course.lessonCount} aulas · {course.moduleCount} módulos
      </p>
      <p className="mt-6">
        <AcquisitionLink
          className={buttonClass("primary", "w-full sm:w-auto")}
          href={course.href}
          event="course_cta_click"
          payload={{ course_slug: course.slug, cta_name: ctaName }}
        >
          {cta}
        </AcquisitionLink>
      </p>
      <p className="mt-3">
        <AcquisitionLink
          className="text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
          href={course.href}
          event="home_course_path_click"
          payload={{ course_slug: course.slug, scenario: pathScenario }}
        >
          Começar por este resultado
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
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{publicHomeCopy.formationsTitle}</h2>
        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          {traffic ? (
            <CoursePanel
              course={traffic}
              title="Tráfego Pago na Prática"
              promise={publicHomeCopy.trafficPromise}
              cta="Conhecer Tráfego Pago"
              ctaName="conhecer_trafego"
              pathScenario="atrair"
              visual="traffic"
            />
          ) : null}
          {sites ? (
            <CoursePanel
              course={sites}
              title="Sites que Convertem"
              promise={publicHomeCopy.sitesPromise}
              cta="Conhecer Sites que Convertem"
              ctaName="conhecer_sites"
              pathScenario="pagina"
              visual="sites"
            />
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
