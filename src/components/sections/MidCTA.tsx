import { midCtaContent } from "@/data/home";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";

export function MidCTA() {
  return (
    <section id="conversa" aria-labelledby="conversa-titulo" className="scroll-mt-36 border-y border-border bg-surface">
      <Container className="flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-7">
        <div className="max-w-2xl">
          <h2 id="conversa-titulo" className="text-xl font-semibold tracking-tight sm:text-2xl">
            {midCtaContent.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted sm:text-base">{midCtaContent.description}</p>
        </div>
        <ContactLink location="mid_cta" channel="whatsapp" className="w-full shrink-0 sm:w-auto">
          {siteConfig.ctas.talk}
        </ContactLink>
      </Container>
    </section>
  );
}
