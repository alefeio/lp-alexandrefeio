import { processIntro, processSteps } from "@/data/process";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function ProcessSection() {
  return (
    <Section id="como-funciona" titleId="como-funciona-titulo">
      <Container>
        <SectionHeading
          eyebrow={processIntro.eyebrow}
          title={processIntro.title}
          description={processIntro.description}
          titleId="como-funciona-titulo"
        />

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <li key={step.number} className="border-t border-border pt-5">
              <span className="font-mono text-sm text-cta">{step.number}</span>
              <h3 className="mt-4 text-lg font-medium tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
