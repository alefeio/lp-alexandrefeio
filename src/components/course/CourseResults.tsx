import { ProductFlow, SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import type { FeaturedArtifact } from "@/lib/learning/course-experience";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

const SITES_PROGRESSION = ["Brief", "Estrutura", "Copy", "Página no ar"] as const;

export function CourseResults({
  courseSlug,
  featured,
  note,
}: {
  courseSlug: string;
  featured: FeaturedArtifact[];
  note: string | null;
}) {
  const published = featured.find((artifact) => /publicad/i.test(artifact.title));
  const others = featured.filter((artifact) => artifact !== published);

  return (
    <section className="overflow-x-clip border-t border-border py-16" aria-label="O que fica pronto">
      <Container>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">O que fica pronto</h2>
        {courseSlug === SITES_COURSE_SLUG ? (
          <div className="mt-6">
            <ProductFlow steps={[...SITES_PROGRESSION]} label="Brief, estrutura, copy e página no ar" />
          </div>
        ) : null}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {(courseSlug === SITES_COURSE_SLUG ? others : featured).map((artifact) => (
            <li key={artifact.title} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-lg font-semibold tracking-tight">{artifact.title}</h3>
              {courseSlug === TRAFFIC_COURSE_SLUG && /Diagnóstico de Prontidão|próxima ação/i.test(artifact.title) ? (
                <div className="mt-4">
                  <TrafficCampaignVisual steps={["Diagnóstico", "Próxima ação"]} title={artifact.title} />
                </div>
              ) : null}
            </li>
          ))}
          {courseSlug === SITES_COURSE_SLUG && published ? (
            <li className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:col-span-2">
              <h3 className="text-lg font-semibold tracking-tight">{published.title}</h3>
              <div className="mt-4 max-w-2xl">
                <SitesPageVisual />
              </div>
            </li>
          ) : null}
        </ul>
        {note ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium underline underline-offset-4">Nota sobre as entregas</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p>
          </details>
        ) : null}
      </Container>
    </section>
  );
}
