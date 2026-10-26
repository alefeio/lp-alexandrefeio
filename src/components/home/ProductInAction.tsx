import { SitesPageVisual } from "@/components/course/CourseProductVisual";
import { Container } from "@/components/ui/Container";

const rows = [
  { label: "Entrega", value: "OK" },
  { label: "Tráfego", value: "OK" },
  { label: "Conversão", value: "Atenção" },
  { label: "Próxima ação", value: "ANALYZE" },
] as const;

export function ProductInAction() {
  return (
    <section className="border-t border-border py-16" aria-label="Produto em ação">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Esse é o tipo de coisa que você constrói.</h2>
        <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
          <figure className="system-panel min-w-0" aria-label="Exemplo ilustrativo de um diagnóstico de campanha. Não é resultado de um cliente.">
            <figcaption className="sr-only">Demonstração ilustrativa. Os estados não são métricas nem um caso real.</figcaption>
            <div className="system-panel-bar">
              <span className="system-live" aria-hidden />
              <p className="text-sm font-medium">Diagnóstico da campanha</p>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Demonstração ilustrativa</p>
              <dl className="grid gap-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <dt className="text-sm text-muted">{row.label}</dt>
                    <dd className="text-sm font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-sm leading-relaxed">Revisar destino e mensuração antes de alterar orçamento.</p>
            </div>
          </figure>
          <figure className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5" aria-label="Exemplo ilustrativo de landing page no navegador e no celular.">
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
