import { cases, casesIntro } from "@/data/cases";
import { CaseCard } from "@/components/sections/CaseCard";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function CasesSection() {
  const published = cases.filter((caseStudy) => !caseStudy.isMock);

  return (
    <Section id="resultados" titleId="resultados-titulo">
      <Container>
        {published.length === 0 ? (
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{casesIntro.eyebrow}</p>
            <h2 id="resultados-titulo" className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
              {casesIntro.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted">{casesIntro.description}</p>
            {process.env.NODE_ENV === "development" ? (
              <p className="mt-4 text-xs leading-relaxed text-subtle">{casesIntro.devNote}</p>
            ) : null}
          </div>
        ) : (
          <>
            <SectionHeading
              eyebrow={casesIntro.eyebrow}
              title="O que a estrutura muda na prática."
              description="Projetos publicados com autorização."
              titleId="resultados-titulo"
            />
            <ul className="mt-14 grid gap-4 lg:grid-cols-2">
              {published.map((caseStudy) => (
                <li key={caseStudy.id}>
                  <CaseCard caseStudy={caseStudy} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Container>
    </Section>
  );
}
