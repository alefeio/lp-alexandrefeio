import { faqIntro, faqItems } from "@/data/faq";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function FAQSection() {
  return (
    <Section id="faq" titleId="faq-titulo">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHeading
          eyebrow={faqIntro.eyebrow}
          title={faqIntro.title}
          titleId="faq-titulo"
        />

        <div className="border-t border-border">
          {faqItems.map((item) => (
            <details key={item.id} className="group border-b border-border">
              <summary className="flex cursor-pointer items-center justify-between gap-4 py-5 text-left">
                <h3 className="text-base font-medium tracking-tight sm:text-lg">{item.question}</h3>
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center text-lg text-muted motion-safe:transition-transform motion-safe:group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-xl pb-5 pr-10 text-sm leading-relaxed text-muted sm:text-base">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
