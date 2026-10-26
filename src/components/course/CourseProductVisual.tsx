const TRAFFIC_FLOW = ["Oferta", "Google / Meta", "Campanha", "Dados", "Diagnóstico", "Próxima ação"];

export function TrafficCampaignVisual({
  steps = TRAFFIC_FLOW,
  title = "Campanha do negócio",
}: {
  steps?: string[];
  title?: string;
} = {}) {
  return (
    <figure className="system-panel min-w-0" aria-label="Ilustração do fluxo de uma campanha. Não mostra métricas nem resultado financeiro.">
      <figcaption className="sr-only">Demonstração da sequência de uma campanha. Não representa dados de um cliente.</figcaption>
      <div className="system-panel-bar">
        <span className="system-live" aria-hidden />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <ol className="grid gap-2 p-4 sm:p-5">
        {steps.map((step, index) => (
          <li key={step} className="min-w-0">
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cta text-xs font-medium text-cta">{index + 1}</span>
              <span className="min-w-0 text-sm font-medium">{step}</span>
            </div>
            {index < steps.length - 1 ? <span className="ml-5 block h-2 w-px bg-border" aria-hidden /> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function ProductFlow({ steps, label }: { steps: readonly string[]; label: string }) {
  return (
    <ol className="flex min-w-0 flex-wrap items-center gap-2" aria-label={label}>
      {steps.map((step, index) => (
        <li key={step} className="flex min-w-0 items-center gap-2">
          <span className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium">{step}</span>
          {index < steps.length - 1 ? <span className="text-muted" aria-hidden>→</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function SitesPageVisual() {
  return (
    <figure className="min-w-0" aria-label="Ilustração de uma landing page no navegador e no celular. Não é a página de um cliente.">
      <figcaption className="sr-only">Demonstração visual de uma página responsiva. A headline, o botão e o contato são genéricos e não prometem um resultado comercial.</figcaption>
      <div className="system-panel min-w-0">
        <div className="system-panel-bar">
          <span className="system-live" aria-hidden />
          <p className="truncate text-xs text-muted">sua-pagina</p>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1.7fr)_minmax(4.4rem,0.38fr)] items-stretch">
          <div className="min-w-0 space-y-3 p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Oferta</p>
            <p className="text-lg font-semibold leading-snug">Uma oferta clara</p>
            <p className="text-sm leading-snug text-muted">No momento em que a pessoa chega.</p>
            <ul className="flex flex-wrap gap-2 text-xs">
              <li className="rounded-full border border-border px-2 py-1">O que muda</li>
              <li className="rounded-full border border-border px-2 py-1">Para quem</li>
            </ul>
            <p className="text-xs text-muted">Informação real do negócio</p>
            <p className="inline-flex max-w-full rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-cta-foreground">Falar agora</p>
          </div>
          <div className="min-w-0 border-l border-border bg-background p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Celular</p>
            <p className="mt-2 text-xs font-semibold leading-snug">A mesma oferta</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">Uma coluna.</p>
            <p className="mt-2 rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted">Contato</p>
            <p className="mt-2 rounded-md bg-ink px-1.5 py-1.5 text-center text-[11px] font-medium text-on-ink">Falar</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
