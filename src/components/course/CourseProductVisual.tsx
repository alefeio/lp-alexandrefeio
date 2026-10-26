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

export function SitesPageVisual() {
  return (
    <figure className="min-w-0" aria-label="Ilustração de uma landing page no navegador e no celular. Não é a página de um cliente.">
      <figcaption className="sr-only">Demonstração visual. A headline, o botão e o formulário são genéricos e não prometem um resultado comercial.</figcaption>
      <div className="grid min-w-0 grid-cols-[minmax(0,1.35fr)_minmax(7.5rem,0.72fr)] items-end gap-2 sm:gap-3">
        <div className="system-panel min-w-0">
          <div className="system-panel-bar">
            <span className="h-2 w-2 rounded-full bg-border" aria-hidden />
            <span className="h-2 w-2 rounded-full bg-border" aria-hidden />
            <span className="h-2 w-2 rounded-full bg-border" aria-hidden />
            <p className="truncate text-xs text-muted">sua-pagina</p>
          </div>
          <div className="space-y-3 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-cta">Oferta</p>
            <p className="text-base font-semibold leading-snug">Uma oferta clara, no momento certo</p>
            <ul className="grid gap-1 text-xs text-muted">
              <li>O que muda</li>
              <li>Para quem é</li>
              <li>Próximo passo</li>
            </ul>
            <p className="rounded-md border border-border px-2 py-1 text-xs">Prova informada pelo negócio</p>
            <p className="inline-flex max-w-full rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-cta-foreground">Falar agora</p>
          </div>
        </div>
        <div className="system-panel min-w-0">
          <div className="border-b border-border px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted">Celular</div>
          <div className="space-y-2 p-3">
            <p className="text-xs font-semibold leading-snug">A mesma oferta, em uma coluna</p>
            <p className="text-[11px] leading-snug text-muted">Benefício, prova e um contato.</p>
            <p className="rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted">Nome e contato</p>
            <p className="rounded-md bg-ink px-2 py-1.5 text-center text-[11px] font-medium text-on-ink">Continuar</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
