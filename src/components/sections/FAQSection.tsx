import { faqIntro, faqItems } from "@/data/faq";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function FAQSection() {
  return (
    <Section id="faq" titleId="faq-titulo">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHeading eyebrow={faqIntro.eyebrow} title={faqIntro.title} titleId="faq-titulo" />

        <div className="border-t border-border">
          {faqItems.map((item) => (
            <details key={item.id} className="group border-b border-border">
              <summary className="flex min-h-14 items-center justify-between gap-4 rounded-md py-4 text-left transition-colors duration-200 hover:text-cta">
                <h3 className="text-base font-semibold tracking-tight sm:text-lg">{item.question}</h3>
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-lg text-muted transition-[transform,border-color,color] duration-200 group-open:rotate-45 group-open:border-cta group-open:text-cta group-hover:border-cta/40"
                >
                  +
                </span>
              </summary>
              <p className="max-w-xl pb-5 pr-12 text-base leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
