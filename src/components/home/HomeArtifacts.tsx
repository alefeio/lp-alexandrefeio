import { Container } from "@/components/ui/Container";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

function ArtifactList({ label, items }: { label: string; items: { title: string; detail: string }[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium uppercase tracking-[0.14em] text-cta">{label}</h3>
      <ol className="mt-4 divide-y divide-border border-y border-border">
        {items.map((artifact, index) => (
          <li key={artifact.title} className="py-4">
            <p className="text-xs font-medium text-muted">{String(index + 1).padStart(2, "0")}</p>
            <h4 className="mt-1 font-medium">{artifact.title}</h4>
            <p className="mt-1 text-sm leading-relaxed text-muted">{artifact.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

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
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
          {traffic ? <ArtifactList label="Tráfego" items={traffic.featuredArtifacts} /> : null}
          {sites ? <ArtifactList label="Página" items={sites.featuredArtifacts} /> : null}
        </div>
      </Container>
    </section>
  );
}
