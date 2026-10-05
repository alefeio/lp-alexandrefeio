import { finalCtaContent } from "@/data/home";
import type { Service } from "@/types/content";
import { LeadForm } from "@/components/sections/LeadForm";
import { Container } from "@/components/ui/Container";

export function FinalCTA({ selectedService }: { selectedService?: Service }) {
  return (
    <section id="contato" aria-labelledby="contato-titulo" className="scroll-mt-36 bg-ink text-on-ink">
      <Container className="grid gap-10 py-20 sm:py-28 lg:grid-cols-2 lg:items-start lg:gap-16">
        <div>
          <h2 id="contato-titulo" className="text-3xl font-medium tracking-tight text-on-ink sm:text-4xl">
            {finalCtaContent.title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-on-ink-muted sm:text-lg">
            {finalCtaContent.description}
          </p>
          <p className="mt-6 text-sm text-on-ink-muted">{finalCtaContent.microcopy}</p>
        </div>
        <LeadForm key={selectedService?.id ?? "contato"} selectedService={selectedService} />
      </Container>
    </section>
  );
}
