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
          titleId="diferenca-titulo"
        />

        <ul className="mt-10 border-t border-border">
          {differentials.map((item) => (
            <li
              key={item.after}
              className="grid gap-4 border-b border-border py-7 md:grid-cols-[minmax(0,0.85fr)_2.5rem_minmax(0,1.15fr)] md:items-center md:gap-6 md:py-8"
            >
              <p>
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-subtle">
                  {item.beforeLabel}
                </span>
                <span className="text-lg text-muted">{item.before}</span>
              </p>
              <span aria-hidden="true" className="hidden h-px w-full bg-border md:block" />
              <p className="border-l-2 border-cta pl-4 md:pl-5">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-cta">
                  {item.afterLabel}
                </span>
                <span className="text-xl font-semibold tracking-tight sm:text-[1.35rem]">{item.after}</span>
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
