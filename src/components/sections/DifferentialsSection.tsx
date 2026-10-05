import { differentials, differentialsContent } from "@/data/home";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function DifferentialsSection() {
  return (
    <Section id="diferenca" titleId="diferenca-titulo">
      <Container>
        <SectionHeading
          eyebrow={differentialsContent.eyebrow}
          title={differentialsContent.title}
          description={differentialsContent.description}
          titleId="diferenca-titulo"
        />

        <ul className="mt-12 divide-y divide-border border-y border-border">
          {differentials.map((item) => (
            <li key={item.after} className="grid gap-6 py-8 md:grid-cols-2 md:gap-16">
              <p>
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-subtle">
                  {item.beforeLabel}
                </span>
                <span className="text-lg text-muted">{item.before}</span>
              </p>
              <p>
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-cta">
                  {item.afterLabel}
                </span>
                <span className="text-lg font-medium tracking-tight sm:text-xl">{item.after}</span>
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
