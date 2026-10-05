import { valueContent, valuePillars } from "@/data/home";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ValueProposition() {
  return (
    <Section id="proposta" titleId="proposta-titulo">
      <Container>
        <SectionHeading
          eyebrow={valueContent.eyebrow}
          title={valueContent.title}
          description={valueContent.description}
          titleId="proposta-titulo"
        />

        <div className="relative mt-14">
          <div className="absolute top-4 right-[12%] left-[12%] hidden h-px bg-border md:block" aria-hidden="true" />
          <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
            {valuePillars.map((pillar, index) => (
              <li key={pillar.number} className="relative">
                {index < valuePillars.length - 1 ? (
                  <span className="absolute top-4 left-4 h-[calc(100%+1.5rem)] w-px bg-border md:hidden" aria-hidden="true" />
                ) : null}
                <span className="relative grid size-8 place-items-center rounded-full border border-cta bg-background font-mono text-[11px] text-cta">
                  {pillar.number}
                </span>
                <h3 className="mt-4 text-xl font-medium tracking-tight">{pillar.title}</h3>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted sm:text-base">{pillar.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
