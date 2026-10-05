import { problemContent } from "@/data/home";
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

        <ul className="mt-10 grid md:grid-cols-3 md:gap-x-12">
          {problemContent.items.map((item) => (
            <li key={item} className="border-t border-border py-4 text-base leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
