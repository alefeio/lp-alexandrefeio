import { ProductFlow, SitesPageVisual, TrafficCampaignVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";
import type { FeaturedArtifact } from "@/lib/learning/course-experience";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

const SITES_PROGRESSION = ["Brief", "Estrutura", "Copy", "Página no ar"] as const;

function hasTrafficVisual(title: string) {
  return /Diagnóstico de Prontidão|próxima ação/i.test(title);
}

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
  const isSites = courseSlug === SITES_COURSE_SLUG;

  return (
    <section className="overflow-x-clip border-t border-border py-16" aria-label="O que fica pronto">
      <Container>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">O que fica pronto</h2>
        {isSites ? (
          <div className="mt-6">
            <ProductFlow steps={[...SITES_PROGRESSION]} label="Brief, estrutura, copy e página no ar" />
          </div>
        ) : null}
        <ul className={isSites ? "mt-8 grid gap-4 md:grid-cols-3" : "mt-8 grid gap-4 sm:grid-cols-2"}>
          {(isSites ? others : featured).map((artifact) => {
            const showTrafficVisual = courseSlug === TRAFFIC_COURSE_SLUG && hasTrafficVisual(artifact.title);
            return (
              <li key={artifact.title} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-lg font-semibold tracking-tight">{artifact.title}</h3>
                {showTrafficVisual ? (
                  <div className="mt-4">
                    <TrafficCampaignVisual steps={["Diagnóstico", "Próxima ação"]} title={artifact.title} />
                  </div>
                ) : courseSlug === TRAFFIC_COURSE_SLUG ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted">{artifact.detail}</p>
                ) : null}
              </li>
            );
          })}
          {isSites && published ? (
            <li className="min-w-0 rounded-2xl border border-border bg-surface p-5 md:col-span-3">
              <h3 className="text-lg font-semibold tracking-tight">{published.title}</h3>
              <div className="mt-4 w-full min-w-0">
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
