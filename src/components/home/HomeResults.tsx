import { SitesPageVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import { publicHomeCopy } from "@/lib/home/public-home";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

const diagnosisRows = [
  { label: "Entrega", value: "OK" },
  { label: "Tráfego", value: "OK" },
  { label: "Conversão", value: "Atenção" },
  { label: "Decisão", value: "ANALYZE" },
] as const;

export function HomeResults({ courses }: { courses: CourseCatalogCard[] }) {
  const showTraffic = courses.some((course) => course.slug === TRAFFIC_COURSE_SLUG);
  const showSites = courses.some((course) => course.slug === SITES_COURSE_SLUG);
  if (!showTraffic && !showSites) return null;

  return (
    <section className="border-t border-border bg-surface py-20 lg:py-24" aria-label="O que fica pronto">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">{publicHomeCopy.resultsTitle}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{publicHomeCopy.resultsSupport}</p>
        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
          {showTraffic ? (
            <figure className="system-panel min-w-0" aria-label="Exemplo ilustrativo de um diagnóstico de campanha. Não é resultado de um cliente.">
              <figcaption className="sr-only">Demonstração ilustrativa do diagnóstico da campanha e da próxima ação.</figcaption>
              <div className="system-panel-bar">
                <span className="system-live" aria-hidden />
                <p className="text-sm font-medium">Diagnóstico da campanha</p>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Demonstração ilustrativa</p>
                <dl className="grid gap-2">
                  {diagnosisRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-2">
                      <dt className="text-sm text-muted">{row.label}</dt>
                      <dd className="text-sm font-medium">{row.value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Próxima ação</p>
                  <p className="mt-2 text-sm leading-relaxed">Revisar destino e mensuração antes de alterar orçamento.</p>
                </div>
              </div>
            </figure>
          ) : null}
          {showSites ? (
            <figure className="min-w-0" aria-label="Exemplo ilustrativo de landing page publicada.">
              <figcaption className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Landing page publicada</figcaption>
              <div className="mt-4 min-w-0">
                <SitesPageVisual />
              </div>
            </figure>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
