import { heroContent } from "@/data/home";
import { siteConfig } from "@/data/site-config";
import { AcquisitionFlow } from "@/components/sections/AcquisitionFlow";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";
import { TrackedLink } from "@/components/ui/TrackedLink";
import { buttonClass } from "@/lib/button-styles";

export function Hero() {
  return (
    <section id="topo" aria-labelledby="hero-titulo" className="final-stage hero-stage scroll-mt-36 py-14 text-on-ink sm:py-16 lg:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] lg:gap-14">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">{heroContent.eyebrow}</p>
          <h1
            id="hero-titulo"
            className="mt-4 max-w-xl text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-on-ink sm:text-5xl lg:text-[3.25rem]"
          >
            {heroContent.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-on-ink-muted sm:text-lg">{heroContent.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ContactLink location="hero" ctaName="hero_primary" className="w-full sm:w-auto">
              {siteConfig.ctas.primary}
            </ContactLink>
            <TrackedLink
              href="#servicos"
              event="cta_click"
              params={{ cta_name: "hero_secondary", cta_location: "hero", destination_type: "anchor" }}
              className={buttonClass("secondary", "w-full sm:w-auto")}
            >
              {siteConfig.ctas.secondary}
            </TrackedLink>
          </div>

          <p className="mt-4 text-sm text-on-ink-muted sm:text-base">{siteConfig.location.serviceArea}</p>
        </div>

        <AcquisitionFlow />
      </Container>
    </section>
  );
}
