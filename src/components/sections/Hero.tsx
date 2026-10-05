import { heroContent, heroFlow, heroMetrics, heroMetricsNote } from "@/data/home";
import { siteConfig } from "@/data/site-config";
import { ContactLink } from "@/components/ui/ContactLink";
import { Container } from "@/components/ui/Container";
import { TrackedLink } from "@/components/ui/TrackedLink";
import { buttonClass } from "@/lib/button-styles";

export function Hero() {
  return (
    <section id="topo" aria-labelledby="hero-titulo" className="scroll-mt-36 py-14 sm:py-20 lg:py-24">
      <Container className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{heroContent.eyebrow}</p>
          <h1
            id="hero-titulo"
            className="mt-4 max-w-xl text-[2rem] font-medium leading-[1.12] tracking-tight sm:text-5xl sm:leading-[1.08] lg:text-[3.25rem]"
          >
            {heroContent.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{heroContent.description}</p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ContactLink location="hero" className="w-full sm:w-auto">
              {siteConfig.ctas.primary}
            </ContactLink>
            <TrackedLink
              href="#servicos"
              event="cta_click"
              params={{ location: "hero", action: "services" }}
              className={buttonClass("secondary", "w-full sm:w-auto")}
            >
              {siteConfig.ctas.secondary}
            </TrackedLink>
          </div>

          <p className="mt-4 text-sm text-muted">{siteConfig.location.serviceArea}</p>
        </div>

        <aside
          aria-label="Fluxo ilustrativo de aquisição. Os números são fictícios e não representam resultados reais."
          className="overflow-hidden rounded-lg border border-border bg-surface"
        >
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Fluxo ilustrativo</p>
          </div>

          <ol className="px-4 py-5 sm:px-5">
            {heroFlow.map((step, index) => (
              <li key={step.number} className="relative flex gap-4">
                {index < heroFlow.length - 1 ? (
                  <span className="absolute top-7 left-[13px] h-[calc(100%-0.25rem)] w-px bg-border" aria-hidden="true" />
                ) : null}
                <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface font-mono text-[10px] text-cta">
                  {step.number}
                </span>
                <div className={index < heroFlow.length - 1 ? "min-w-0 pb-5" : "min-w-0"}>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs leading-relaxed text-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <dl className="grid grid-cols-2 gap-px border-t border-border bg-border">
            {heroMetrics.map((metric) => (
              <div key={metric.label} className="bg-surface px-4 py-4 sm:px-5">
                <dt className="text-xs text-muted">{metric.label}</dt>
                <dd className="mt-1 font-mono text-xl font-medium tracking-tight tabular-nums sm:text-2xl">{metric.value}</dd>
              </div>
            ))}
          </dl>

          <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-subtle sm:px-5">{heroMetricsNote}</p>
        </aside>
      </Container>
    </section>
  );
}
