import { SitesPageVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export function HomeArtifacts({ courses }: { courses: CourseCatalogCard[] }) {
  const traffic = courses.some((course) => course.slug === TRAFFIC_COURSE_SLUG) ? courseExperience(TRAFFIC_COURSE_SLUG) : null;
  const sites = courses.some((course) => course.slug === SITES_COURSE_SLUG) ? courseExperience(SITES_COURSE_SLUG) : null;
  if (!traffic && !sites) return null;

  return (
    <section className="border-t border-border py-16" aria-label="O que você constrói">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Você não termina só com conhecimento.</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Cada formação deixa decisões, planos e entregas construídas com o seu próprio negócio.
        </p>
        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
          {traffic ? (
            <div className="min-w-0">
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-cta">Tráfego</h3>
              <ul className="mt-4 grid gap-3">
                {traffic.featuredArtifacts.map((artifact) => (
                  <li key={artifact.title} className="system-panel min-w-0">
                    <div className="system-panel-bar">
                      <span className="system-live" aria-hidden />
                      <p className="text-sm font-medium">{artifact.title}</p>
                    </div>
                    <p className="p-4 text-sm leading-relaxed text-muted">{artifact.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {sites ? (
            <div className="min-w-0">
              <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-cta">Página</h3>
              <ol className="mt-4 grid gap-3">
                {sites.featuredArtifacts.map((artifact, index) => (
                  <li key={artifact.title} className="min-w-0">
                    <article className="rounded-2xl border border-border bg-surface p-4">
                      <p className="text-xs font-medium text-muted">{String(index + 1).padStart(2, "0")}</p>
                      <h4 className="mt-1 font-medium">{artifact.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{artifact.detail}</p>
                    </article>
                    {index < sites.featuredArtifacts.length - 1 ? <span className="mx-auto mt-3 block h-3 w-px bg-border" aria-hidden /> : null}
                  </li>
                ))}
              </ol>
              <div className="mt-4 min-w-0 rounded-2xl border border-border bg-background p-3 sm:p-4">
                <SitesPageVisual />
              </div>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
