import { problemContent, problemFlow } from "@/data/home";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export function ProblemSection() {
  return (
    <Section id="problema" titleId="problema-titulo">
      <Container>
        <div className="max-w-2xl">
          <h2 id="problema-titulo" className="text-3xl font-medium tracking-tight sm:text-4xl">
            {problemContent.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{problemContent.description}</p>
        </div>

        <ul className="mt-10 grid sm:grid-cols-2 sm:gap-x-12">
          {problemContent.items.map((item) => (
            <li key={item} className="border-t border-border py-4 text-base leading-relaxed">
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-14 max-w-3xl">
          <p className="text-2xl font-medium tracking-tight sm:text-3xl">{problemContent.statement}</p>
        </div>

        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Fluxo de site, tráfego e conversão">
          {problemFlow.map((step) => (
            <li key={step.number} className="border-t border-cta/40 pt-4">
              <span className="font-mono text-xs text-cta">{step.number}</span>
              <p className="mt-3 font-medium">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
