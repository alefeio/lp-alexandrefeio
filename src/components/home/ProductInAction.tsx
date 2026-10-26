import { SitesPageVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";

const rows = [
  { label: "Entrega", value: "OK" },
  { label: "Tráfego", value: "OK" },
  { label: "Conversão", value: "Atenção" },
  { label: "Decisão", value: "ANALYZE" },
] as const;

export function ProductInAction() {
  return (
    <section className="bg-surface py-20 lg:py-24" aria-label="Produto em ação">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Esse é o tipo de coisa que você constrói.</h2>
        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <figure className="system-panel min-w-0" aria-label="Exemplo ilustrativo de um diagnóstico de campanha. Não é resultado de um cliente.">
            <figcaption className="sr-only">Demonstração ilustrativa. Os estados não são métricas nem um caso real.</figcaption>
            <div className="system-panel-bar">
              <span className="system-live" aria-hidden />
              <p className="text-sm font-medium">Diagnóstico da campanha</p>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Demonstração ilustrativa</p>
              <p className="text-sm font-medium">Status da leitura</p>
              <dl className="grid gap-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-2">
                    <dt className="text-sm text-muted">{row.label}</dt>
                    <dd className="text-sm font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Próxima ação</p>
                <p className="mt-2 text-sm leading-relaxed">Revisar destino e mensuração antes de alterar orçamento.</p>
              </div>
            </div>
          </figure>
          <figure className="min-w-0" aria-label="Exemplo ilustrativo de landing page no navegador e no celular.">
            <figcaption className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Demonstração ilustrativa</figcaption>
            <div className="mt-4 min-w-0">
              <SitesPageVisual />
            </div>
          </figure>
        </div>
      </Container>
    </section>
  );
}
