import { finalCtaContent } from "@/data/home";
import type { Service } from "@/types/content";
import { LeadForm } from "@/components/sections/LeadForm";
import { Container } from "@/components/ui/Container";

export function FinalCTA({
  selectedService,
  title = finalCtaContent.title,
  description = finalCtaContent.description,
  microcopy = finalCtaContent.microcopy,
  submitLabel,
}: {
  selectedService?: Service;
  title?: string;
  description?: string;
  microcopy?: string;
  submitLabel?: string;
}) {
  return (
    <section id="contato" aria-labelledby="contato-titulo" className="final-stage scroll-mt-36 text-on-ink">
      <Container className="grid gap-8 py-16 sm:py-20 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:items-center lg:gap-12">
        <div>
          <h2 id="contato-titulo" className="text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-on-ink sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-on-ink-muted sm:text-lg">{description}</p>
          <p className="mt-6 text-sm text-on-ink-muted sm:text-base">{microcopy}</p>
          <div aria-hidden="true" className="mt-8 hidden h-px w-24 bg-gradient-to-r from-cta to-transparent lg:block" />
        </div>
        <LeadForm key={selectedService?.id ?? "contato"} selectedService={selectedService} submitLabel={submitLabel} />
      </Container>
    </section>
  );
}
