import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import { buttonClass } from "@/lib/button-styles";

export function LearnOrDelegate() {
  return (
    <section id="servico" className="scroll-mt-24 border-t border-border py-16">
      <Container>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Você escolhe como avançar.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Aprender</h3>
            <p className="mt-3 text-base leading-relaxed">Cursos e ferramentas aplicadas ao negócio.</p>
            <p className="mt-6">
              <a className={buttonClass("primary")} href="#formacoes">
                Ver as formações
              </a>
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Delegar</h3>
            <p className="mt-3 text-base leading-relaxed">Gestão de tráfego e estrutura de conversão.</p>
            <p className="mt-6">
              <AcquisitionLink className={buttonClass("secondary")} href="/trafego-pago" event="service_from_course_click" payload={{ cta_name: "conhecer_gestao" }}>
                Conhecer a gestão
              </AcquisitionLink>
            </p>
          </article>
        </div>
      </Container>
    </section>
  );
}
