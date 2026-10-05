import type { CaseStudy } from "@/types/content";

export function CaseCard({ caseStudy }: { caseStudy: CaseStudy }) {
  return (
    <article className="flex h-full flex-col border border-border bg-surface p-6 sm:p-8" data-mock={caseStudy.isMock}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">{caseStudy.segment}</p>
        {caseStudy.isMock ? (
          <p className="rounded-full border border-cta/30 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-cta">
            Conteúdo demonstrativo
          </p>
        ) : null}
      </div>

      <h3 className="mt-5 text-2xl font-medium tracking-tight">{caseStudy.company}</h3>

      <dl className="mt-8 grid gap-5">
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Desafio</dt>
          <dd className="mt-1 text-sm leading-relaxed sm:text-base">{caseStudy.challenge}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Caminho</dt>
          <dd className="mt-1 text-sm leading-relaxed sm:text-base">{caseStudy.solution}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-[0.12em] text-subtle">Indicador ilustrativo</dt>
          <dd className="mt-1 text-sm leading-relaxed sm:text-base">{caseStudy.result}</dd>
        </div>
      </dl>
    </article>
  );
}
