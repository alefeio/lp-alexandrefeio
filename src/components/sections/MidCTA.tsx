import { midCtaContent } from "@/data/home";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";

export function MidCTA() {
  return (
    <section id="conversa" aria-labelledby="conversa-titulo" className="scroll-mt-36 border-t border-border">
      <Container className="grid items-center gap-8 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <div className="max-w-2xl">
          <h2 id="conversa-titulo" className="text-3xl font-medium tracking-tight sm:text-4xl">
            {midCtaContent.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{midCtaContent.description}</p>
        </div>
        <ContactLink location="mid_cta" channel="whatsapp" className="w-full sm:w-auto">
          {siteConfig.ctas.talk}
        </ContactLink>
      </Container>
    </section>
  );
}
