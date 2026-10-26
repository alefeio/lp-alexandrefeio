import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";

export function ComplementaryCourse({
  sourceSlug,
  targetSlug,
  targetTitle,
  headline,
  body,
  cta,
}: {
  sourceSlug: string;
  targetSlug: string;
  targetTitle: string;
  headline: string;
  body: string;
  cta: string;
}) {
  return (
    <section className="overflow-x-clip border-t border-border py-16">
      <Container className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Outra formação</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{headline}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted">{body}</p>
        <p className="mt-4 text-sm font-medium">{targetTitle}</p>
        <p className="mt-6">
          <AcquisitionLink
            className={buttonClass("secondary")}
            href={`/cursos/${targetSlug}`}
            event="course_complementary_click"
            payload={{ source_course_slug: sourceSlug, target_course_slug: targetSlug, cta_name: "curso_complementar" }}
          >
            {cta}
          </AcquisitionLink>
        </p>
      </Container>
    </section>
  );
}
