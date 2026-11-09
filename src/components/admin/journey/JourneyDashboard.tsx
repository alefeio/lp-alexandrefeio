import { JourneyCourseTransitions, JourneyFreeLessons, JourneyScenarioBreakdown, JourneySources } from "@/components/admin/journey/JourneyBreakdowns";
import { JourneyCommercial, JourneyEntry, JourneyFilters, JourneyFunnel, JourneyLearning, JourneySummary } from "@/components/admin/journey/JourneySections";
import type { JourneyDashboardView } from "@/lib/admin/journey-report";

export function JourneyDashboard({ view }: { view: JourneyDashboardView }) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Jornada</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Visitantes com consentimento de analytics, ao lado de pedidos, pagamentos e progresso reais.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed">{view.queryLabel}</p>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">O histórico do painel continua desde {view.baselineLabel}. Eventos anteriores permanecem armazenados e fora da consulta. Entrada e primeira interação começam no marco J2-A ({view.entry.instrumentationLabel}).</p>
      <JourneyFilters view={view} />
      <JourneySummary view={view} />
      <JourneyEntry view={view} />
      <JourneyFunnel view={view} />
      <JourneyCommercial view={view} />
      <JourneyScenarioBreakdown view={view} />
      <JourneySources view={view} />
      <JourneyFreeLessons view={view} />
      <JourneyCourseTransitions view={view} />
      <JourneyLearning view={view} />
    </>
  );
}
