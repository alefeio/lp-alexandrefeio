import { valueContent, valuePillars } from "@/data/home";
import { cn } from "@/lib/cn";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ValueProposition() {
  return (
    <Section id="proposta" titleId="proposta-titulo">
      <Container>
        <SectionHeading title={valueContent.title} titleId="proposta-titulo" />

        <div className="relative mt-10 md:mt-12">
          <div
            className="pointer-events-none absolute top-3 bottom-3 left-[7px] w-px bg-border md:top-[7px] md:right-[8%] md:bottom-auto md:left-[8%] md:h-px md:w-auto"
            aria-hidden="true"
          />
          <ol className="grid gap-8 md:grid-cols-3 md:gap-8">
            {valuePillars.map((pillar, index) => (
              <li key={pillar.number} className="relative pl-8 md:pl-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1 left-0 z-10 size-4 rounded-full border-2 bg-background md:static md:mb-5 md:block",
                    index === 1 ? "border-accent" : "border-cta",
                  )}
                />
                <p className="font-mono text-xs text-subtle">{pillar.number}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{pillar.title}</h3>
                <p className="mt-2 max-w-sm text-base leading-relaxed text-muted">{pillar.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </Section>
  );
}
