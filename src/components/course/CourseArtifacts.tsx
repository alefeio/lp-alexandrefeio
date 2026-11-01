import { Container } from "@/components/ui/Container";
import type { FeaturedArtifact } from "@/lib/learning/course-experience";

export function CourseArtifacts({
  featured,
  artifacts,
  note,
  collapseRest = false,
}: {
  featured: FeaturedArtifact[];
  artifacts: string[];
  note: string | null;
  collapseRest?: boolean;
}) {
  const featuredTitles = new Set(featured.map((artifact) => artifact.title));
  const rest = artifacts.filter((artifact) => !featuredTitles.has(artifact));
  return (
    <section className="overflow-x-clip border-t border-border py-16">
      <Container>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">O que você vai construir</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">Entregas do próprio negócio. Nada aqui é um número de cliente ou uma promessa de faturamento.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {featured.map((artifact) => (
            <li key={artifact.title} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-lg font-semibold tracking-tight">{artifact.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{artifact.detail}</p>
            </li>
          ))}
        </ul>
        {collapseRest ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium underline underline-offset-4">Ver todas as entregas da formação</summary>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
              {rest.map((artifact) => (
                <li key={artifact}>{artifact}</li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="mt-6 text-sm leading-relaxed text-muted">
            Ao longo da formação também ficam: {artifacts.join(" · ")}.
          </p>
        )}
        {note ? <p className="mt-3 text-sm leading-relaxed text-muted">{note}</p> : null}
      </Container>
    </section>
  );
}
