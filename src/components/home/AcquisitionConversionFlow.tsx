const STEPS = ["Tráfego", "Página", "Contato", "Dados", "Próxima decisão"] as const;

export function AcquisitionConversionFlow() {
  return (
    <figure id="como-funciona" className="scroll-mt-24 min-w-0" aria-label="Fluxo: tráfego, página, contato, dados e próxima decisão.">
      <figcaption className="sr-only">
        O anúncio leva até a página. A página prepara o contato. Os dados orientam a próxima decisão. Demonstração ilustrativa, sem métricas de desempenho.
      </figcaption>
      <ol className="grid min-w-0 gap-2">
        {STEPS.map((step, index) => (
          <li key={step} className="min-w-0">
            <div className="rounded-lg border border-white/15 bg-white px-3 py-2.5 text-sm font-medium text-ink">{step}</div>
            {index < STEPS.length - 1 ? <span className="mx-auto mt-2 block h-3 w-px bg-white/30" aria-hidden /> : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
