import { cases, casesIntro } from "@/data/cases";
import { CaseCard } from "@/components/sections/CaseCard";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function CasesSection() {
  const published = cases.filter((caseStudy) => !caseStudy.isMock);

  if (published.length === 0) return null;

  return (
    <Section id="resultados" titleId="resultados-titulo">
      <Container>
        <SectionHeading
          eyebrow={casesIntro.eyebrow}
          title="O que a estrutura muda na prática."
          titleId="resultados-titulo"
        />
        <ul className="mt-14 grid gap-4 lg:grid-cols-2">
          {published.map((caseStudy) => (
            <li key={caseStudy.id}>
              <CaseCard caseStudy={caseStudy} />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
