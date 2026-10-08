import { AcquisitionFlow } from "@/components/sections/AcquisitionFlow";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { TrackedLink } from "@/components/ui/TrackedLink";
import {
  trafegoHeroFlow,
  trafegoPagoService,
  trafegoScenarios,
  trafegoSolution,
  trafegoSteps,
} from "@/data/trafego-pago";
import { buttonClass } from "@/lib/button-styles";

export function TrafegoPagoLanding() {
  return (
    <>
      <section id="topo" aria-labelledby="trafego-titulo" className="hero-stage final-stage scroll-mt-36 py-14 text-on-ink sm:py-16 lg:py-20">
        <Container className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] lg:gap-14">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-on-ink">Google Ads + Estratégia + Conversão</p>
            <h1
              id="trafego-titulo"
              className="mt-4 max-w-xl text-[2.05rem] font-semibold leading-[1.08] tracking-tight text-on-ink sm:text-5xl lg:text-[3.15rem]"
            >
              Gestão de Tráfego Pago para gerar oportunidades reais.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-on-ink-muted sm:text-lg">
              Anúncios, página de destino e mensuração no mesmo plano. O clique só conta quando vira contato.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <TrackedLink
                href="#contato"
                event="service_interest"
                params={{ service_name: "trafego_pago" }}
                className={buttonClass("primary", "w-full sm:w-auto")}
              >
                Quero falar sobre meu projeto
              </TrackedLink>
              <TrackedLink
                href="#como-funciona"
                event="cta_click"
                params={{ cta_name: "trafego_como_funciona", cta_location: "trafego_hero", destination_type: "anchor" }}
                className={buttonClass("secondary", "w-full sm:w-auto")}
              >
                Entender como funciona
              </TrackedLink>
            </div>
          </div>
          <AcquisitionFlow steps={trafegoHeroFlow} label="Do anúncio à oportunidade." />
        </Container>
      </section>

      <Section id="problema" titleId="trafego-problema-titulo">
        <Container>
          <div className="max-w-2xl">
            <h2 id="trafego-problema-titulo" className="text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
              Gerar tráfego é só uma parte.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              A campanha perde força quando a página é lenta, a oferta não fica clara ou o contato que chegou não é medido.
            </p>
          </div>
          <ol className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
            {["Anúncio", "Página", "Contato", "Oportunidade"].map((step, index) => (
              <li key={step} className="flex items-center gap-4 text-lg font-semibold tracking-tight sm:text-xl">
                {index > 0 ? (
                  <span aria-hidden="true" className="hidden text-cta sm:inline">
                    →
                  </span>
                ) : null}
                <span className="font-mono text-sm text-cta sm:hidden">0{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section id="solucao" titleId="trafego-solucao-titulo">
        <Container>
          <div className="max-w-2xl">
            <h2 id="trafego-solucao-titulo" className="text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
              Gestão de tráfego, com a estrutura que recebe o clique.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              O trabalho principal é conduzir as campanhas. Site e landing page entram quando estão no caminho do resultado.
            </p>
          </div>
          <ul className="mt-10 border-t border-border">
            {trafegoSolution.map((item) => (
              <li key={item.title} className="grid gap-1 border-b border-border py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline sm:gap-8">
                <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="text-base leading-relaxed text-muted">{item.description}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="cenarios" titleId="trafego-cenarios-titulo">
        <Container>
          <h2 id="trafego-cenarios-titulo" className="max-w-2xl text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            Dois pontos de partida.
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-16">
            {trafegoScenarios.map((scenario) => (
              <article key={scenario.title} className="border-t border-cta pt-5">
                <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{scenario.title}</h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-muted">{scenario.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      <Section id="como-funciona" titleId="trafego-processo-titulo">
        <Container>
          <h2 id="trafego-processo-titulo" className="max-w-2xl text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            Como funciona.
          </h2>
          <ol className="process-track mt-12" data-active="true">
            {trafegoSteps.map((step) => (
              <li key={step.number} className="relative pl-10 lg:pl-0 lg:pt-10">
                <span className="absolute top-0 left-0 z-10 grid size-6 place-items-center rounded-full border border-cta bg-background font-mono text-[10px] text-cta lg:left-0">
                  {step.number}
                </span>
                <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{step.description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section id="por-que" titleId="trafego-porque-titulo">
        <Container className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Alexandre Feio</p>
          <h2 id="trafego-porque-titulo" className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">
            Desenvolvimento, marketing e produto no mesmo olhar.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">
            Anúncio e página são tratados juntos. Se a estrutura técnica atrapalha a campanha, o ajuste não precisa passar para outra pessoa.
          </p>
          <TrackedLink
            href="#contato"
            event="service_interest"
            params={{ service_name: "trafego_pago" }}
            className={buttonClass("primary", "mt-8 w-full sm:w-auto")}
          >
            Quero falar sobre meu projeto
          </TrackedLink>
        </Container>
      </Section>

      <FinalCTA
        selectedService={trafegoPagoService}
        title="Vamos entender onde está o próximo gargalo da sua aquisição?"
        description="Uma conversa sobre campanha, página e o que já dá para medir."
        microcopy="Sem compromisso."
        submitLabel="Falar com Alexandre"
      />
    </>
  );
}
