import { aboutContent } from "@/data/home";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export function AboutSection() {
  return (
    <Section id="sobre" titleId="sobre-titulo">
      <Container className="grid items-center gap-10 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-16">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[17.5rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_50px_-36px_rgba(15,23,42,0.55)]">
          <span aria-hidden="true" className="absolute top-3 left-3 h-8 w-8 border-t border-l border-cta" />
          <span aria-hidden="true" className="absolute right-3 bottom-3 h-8 w-8 border-r border-b border-cta/40" />
          <p className="absolute inset-x-6 bottom-8 text-sm leading-relaxed text-muted">{aboutContent.photoLabel}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{aboutContent.eyebrow}</p>
          <h2 id="sobre-titulo" className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            {aboutContent.title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{aboutContent.description}</p>
          <p className="mt-6 text-sm font-medium text-foreground sm:text-base">
            {siteConfig.name}
            <span className="font-normal text-muted"> · {siteConfig.location.short}</span>
          </p>
        </div>
      </Container>
    </Section>
  );
}
