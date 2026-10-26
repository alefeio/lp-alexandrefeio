import { JourneyCourseTransitions, JourneyFreeLessons, JourneyScenarioBreakdown, JourneySources } from "@/components/admin/journey/JourneyBreakdowns";
import { JourneyCommercial, JourneyFilters, JourneyFunnel, JourneyLearning, JourneySummary } from "@/components/admin/journey/JourneySections";
import type { JourneyDashboardView } from "@/lib/admin/journey-report";

export function JourneyDashboard({ view }: { view: JourneyDashboardView }) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Jornada</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Como visitantes com consentimento avançam entre descoberta, cursos, aulas e intenção de compra. Resultados financeiros vêm das tabelas operacionais.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed">Dados de jornada considerados desde {view.baselineLabel}.</p>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">Eventos técnicos anteriores permanecem armazenados, mas não entram neste painel.</p>
      <JourneyFilters view={view} />
      <JourneySummary view={view} />
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
