import Link from "next/link";
import {
  AI_ECONOMICS_COST_NOTE,
  AI_ECONOMICS_CURRENCY_NOTE,
  AI_ECONOMICS_EMPTY,
  AI_ECONOMICS_PERIODS,
  AI_ECONOMICS_PERIOD_LABEL,
  aiEconomicsHref,
  type AiEconomicsView,
} from "@/lib/admin/ai-economics";

export function AiEconomicsDashboard({ view }: { view: AiEconomicsView }) {
  const peak = Math.max(1, ...view.days.map((day) => day.providerCalls));

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">IA — custos e eficiência</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">
          Consumo registrado pelas funcionalidades de IA da plataforma. Custos são estimativas calculadas a partir do usage retornado pelo provedor e não substituem a fatura do fornecedor.
        </p>
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Período">
          {AI_ECONOMICS_PERIODS.map((period) => (
            <Link
              key={period}
              href={aiEconomicsHref(period)}
              className={period === view.period ? "rounded-md border border-foreground px-3 py-1.5 text-sm font-medium" : "rounded-md border border-border px-3 py-1.5 text-sm text-muted"}
              aria-current={period === view.period ? "page" : undefined}
            >
              {AI_ECONOMICS_PERIOD_LABEL[period]}
            </Link>
          ))}
        </nav>
      </header>

      {view.empty ? <p className="text-sm text-muted">{AI_ECONOMICS_EMPTY}</p> : null}

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Resumo</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Ações de IA" value={String(view.summary.logicalActions)} />
          <Card label="Provider calls" value={String(view.summary.providerCalls)} />
          <Card label="Custo estimado precificado" value={view.summary.pricedCostLabel} note={AI_ECONOMICS_COST_NOTE} />
          <Card
            label="Cobertura de precificação"
            value={view.summary.coverage == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(view.summary.coverage)}
            note={view.summary.coverage == null ? undefined : `${view.summary.coverageLabel}. ${view.summary.pricedCalls} precificadas · ${view.summary.unpricedCalls} sem preço calculado.`}
          />
          <Card label="Chamadas com falha" value={String(view.summary.failedCalls)} />
          <Card label="Chamadas de repair" value={String(view.summary.repairCalls)} />
          <Card label="Chamadas adicionais registradas" value={String(view.summary.additionalCalls)} />
          <Card label="Web Search calls conhecidas" value={view.summary.webSearchCallsLabel} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Composição do custo conhecido</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="Custo estimado do modelo" value={view.composition.modelCostLabel} />
          <Card label="Custo estimado de ferramentas" value={view.composition.toolCostLabel} />
          <Card label="Custo total estimado precificado" value={view.composition.pricedCostLabel} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Input tokens conhecidos" value={view.composition.inputTokensLabel} />
          <Card label="Cached input tokens conhecidos" value={view.composition.cachedInputTokensLabel} />
          <Card label="Cache write tokens conhecidos" value={view.composition.cacheWriteTokensLabel} />
          <Card label="Output tokens conhecidos" value={view.composition.outputTokensLabel} />
          <Card label="Total tokens conhecidos" value={view.composition.totalTokensLabel} />
          <Card label="Web Search calls conhecidas" value={view.composition.webSearchCallsLabel} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Unit economics da infraestrutura de IA</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="Ações totalmente precificadas" value={String(view.unit.fullyPricedActions)} />
          <Card label="Custo médio por ação totalmente precificada" value={view.unit.averageLabel} />
          <Card label="Ações com precificação incompleta" value={String(view.unit.incompleteActions)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Por funcionalidade</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                {["Funcionalidade", "Ações", "Provider calls", "Custo estimado conhecido", "Calls unpriced", "Cobertura", "Repairs", "Web Search calls"].map((heading) => (
                  <th key={heading} className="border-b border-border px-3 py-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.features.length === 0 ? <EmptyRow columns={8} /> : view.features.map((feature) => (
                <tr key={feature.featureKey}>
                  <td className="border-b border-border px-3 py-2">{feature.label}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{feature.actions}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{feature.providerCalls}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{feature.pricedCostLabel}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{feature.unpricedCalls}</td>
                  <td className="border-b border-border px-3 py-2">{feature.coverageLabel}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{feature.repairs}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{feature.webSearchCallsLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Por usuário</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Identificador interno do ledger, com e-mail administrativo quando disponível. Não inclui prompt, resposta nem fatos privados do aluno.
        </p>
        <div className="space-y-4">
          {view.users.length === 0 ? (
            <p className="text-sm text-muted">{AI_ECONOMICS_EMPTY}</p>
          ) : (
            view.users.map((user) => (
              <article key={user.userId} className="rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-all">{user.adminLabel}</p>
                    <p className="mt-1 text-xs text-muted">userId · {user.userId}</p>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    <MiniStat label="Ações" value={String(user.actions)} />
                    <MiniStat label="Provider calls" value={String(user.providerCalls)} />
                    <MiniStat label="Custo conhecido" value={user.pricedCostLabel} />
                    <MiniStat label="Média (ações completas)" value={user.averageLabel} />
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat label="Calls unpriced" value={String(user.unpricedCalls)} />
                  <MiniStat label="Cobertura" value={user.coverageLabel} />
                  <MiniStat label="Chamadas adicionais" value={String(user.additionalCalls)} />
                  <MiniStat label="Ações incompletas" value={String(user.incompleteActions)} />
                </dl>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[44rem] text-left text-sm">
                    <thead className="text-muted">
                      <tr>
                        {["Funcionalidade", "Ações", "Provider calls", "Custo conhecido", "Unpriced", "Cobertura", "Adicionais", "Média completa"].map((heading) => (
                          <th key={heading} className="border-b border-border px-3 py-2 font-medium">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {user.features.map((feature) => (
                        <tr key={`${user.userId}-${feature.featureKey}`}>
                          <td className="border-b border-border px-3 py-2">{feature.label}</td>
                          <td className="border-b border-border px-3 py-2 tabular-nums">{feature.actions}</td>
                          <td className="border-b border-border px-3 py-2 tabular-nums">{feature.providerCalls}</td>
                          <td className="border-b border-border px-3 py-2 tabular-nums">{feature.pricedCostLabel}</td>
                          <td className="border-b border-border px-3 py-2 tabular-nums">{feature.unpricedCalls}</td>
                          <td className="border-b border-border px-3 py-2">{feature.coverageLabel}</td>
                          <td className="border-b border-border px-3 py-2 tabular-nums">{feature.additionalCalls}</td>
                          <td className="border-b border-border px-3 py-2 tabular-nums">{feature.averageLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Modelos e precificação</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-muted">
              <tr>
                {["Provedor", "Modelo", "Tier", "Versão do prompt", "Versão de preço", "Provider calls", "Precificadas", "Unpriced", "Custo conhecido"].map((heading) => (
                  <th key={heading} className="border-b border-border px-3 py-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.models.length === 0 ? <EmptyRow columns={9} /> : view.models.map((model) => (
                <tr key={`${model.providerId}-${model.modelId}-${model.serviceTierLabel}-${model.promptVersionLabel}-${model.pricingVersionLabel}`}>
                  <td className="border-b border-border px-3 py-2">{model.providerId}</td>
                  <td className="border-b border-border px-3 py-2">{model.modelId}</td>
                  <td className="border-b border-border px-3 py-2">{model.serviceTierLabel}</td>
                  <td className="border-b border-border px-3 py-2">{model.promptVersionLabel}</td>
                  <td className="border-b border-border px-3 py-2">{model.pricingVersionLabel}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{model.providerCalls}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{model.pricedCalls}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{model.unpricedCalls}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{model.pricedCostLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Operação</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card label="Responded" value={String(view.operation.responded)} />
          <Card label="Failed" value={String(view.operation.failed)} />
          <Card label="Generate" value={String(view.operation.generate)} />
          <Card label="Repair" value={String(view.operation.repair)} />
          <Card label="Chamadas adicionais registradas" value={String(view.operation.additionalCalls)} />
          <Card label="Latência conhecida (mediana)" value={view.operation.latencyLabel} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Evolução diária · America/Belem</h2>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                {["Dia", "Ações", "Provider calls", "Custo precificado conhecido", "Calls unpriced"].map((heading) => (
                  <th key={heading} className="sticky top-0 bg-background border-b border-border px-3 py-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.days.length === 0 ? <EmptyRow columns={5} /> : view.days.map((day) => (
                <tr key={day.day}>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{day.dayLabel}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{day.actions}</td>
                  <td className="border-b border-border px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-10 tabular-nums">{day.providerCalls}</span>
                      <span className="h-2 flex-1 rounded bg-border">
                        <span className="block h-2 rounded bg-foreground" style={{ width: `${(day.providerCalls / peak) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{day.pricedCostLabel}</td>
                  <td className="border-b border-border px-3 py-2 tabular-nums">{day.unpricedCalls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Contexto comercial</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card label="Receita operacional recebida no período" value={view.revenue.label} />
          <Card label="Pagamentos com receita reconhecida" value={String(view.revenue.recognizedPayments)} />
          <Card label="Pedidos pagos criados no período" value={String(view.revenue.paidOrders)} />
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">{AI_ECONOMICS_CURRENCY_NOTE}</p>
      </section>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-lg border border-border p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {note ? <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p> : null}
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-medium tabular-nums break-words">{value}</p>
    </div>
  );
}

function EmptyRow({ columns }: { columns: number }) {
  return (
    <tr>
      <td className="px-3 py-4 text-muted" colSpan={columns}>{AI_ECONOMICS_EMPTY}</td>
    </tr>
  );
}
