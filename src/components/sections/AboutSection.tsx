import { aboutContent } from "@/data/home";
import { siteConfig } from "@/data/site-config";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export function AboutSection() {
  return (
    <Section id="sobre" titleId="sobre-titulo">
      <Container className="grid items-center gap-10 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-16">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[280px] border border-border bg-surface">
          <div className="absolute inset-5 border border-dashed border-border" aria-hidden="true" />
          <p className="absolute inset-x-8 bottom-8 text-sm leading-relaxed text-muted">{aboutContent.photoLabel}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{aboutContent.eyebrow}</p>
          <h2 id="sobre-titulo" className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            {aboutContent.title}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{aboutContent.description}</p>
          <p className="mt-6 text-sm text-foreground">
            {siteConfig.name}
            <span className="text-muted"> · {siteConfig.location.short}</span>
          </p>
        </div>
      </Container>
    </Section>
  );
}
