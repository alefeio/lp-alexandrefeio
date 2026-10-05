import { heroFlow } from "@/data/home";

export function AcquisitionFlow() {
  return (
    <aside className="system-panel" aria-label="Fluxo de aquisição, do tráfego à oportunidade.">
      <div className="system-panel-bar" aria-hidden="true">
        <span className="system-live" />
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[11px] tracking-wide text-subtle">01–04</span>
      </div>

      <div className="system-flow">
        <span className="system-rail" aria-hidden="true">
          <span className="system-rail-pulse" />
        </span>
        <ol>
        {heroFlow.map((step, index) => (
          <li key={step.number} className="system-node" data-tone={index === 2 ? "warm" : undefined}>
            <span className="system-node-mark" aria-hidden="true">
              <span className="system-node-dot" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">{step.role}</p>
              <p className="mt-1 text-base font-semibold tracking-tight">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.description}</p>
            </div>
          </li>
        ))}
        </ol>
      </div>
    </aside>
  );
}
