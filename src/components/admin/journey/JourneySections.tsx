import Link from "next/link";
import { formatPriceCents } from "@/lib/learning/money";
import {
  JOURNEY_DIAGNOSTIC_NOTE,
  JOURNEY_EMPTY,
  JOURNEY_ERA_LABEL,
  JOURNEY_ERAS,
  JOURNEY_PERIOD_LABEL,
  JOURNEY_PERIODS,
  JOURNEY_REVENUE_NOTE,
  journeyDashboardHref,
  type JourneyCourse,
  type JourneyDashboardView,
} from "@/lib/admin/journey-report";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { EmptyNote, ShareBar, maxCount } from "@/components/admin/journey/JourneyBars";

const COURSES: Array<{ value: JourneyCourse; label: string }> = [
  { value: "all", label: "Todos" },
  { value: TRAFFIC_COURSE_SLUG, label: "Tráfego Pago" },
  { value: SITES_COURSE_SLUG, label: "Sites que Convertem" },
];

export function JourneyFilters({ view }: { view: JourneyDashboardView }) {
  return (
    <div className="mt-6 flex flex-col gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="Marco da UX-C">
        {JOURNEY_ERAS.map((era) => (
          <FilterLink key={era} href={journeyDashboardHref(view.period, view.course, era)} current={view.era === era}>
            {JOURNEY_ERA_LABEL[era]}
          </FilterLink>
        ))}
      </nav>
      <nav className="flex flex-wrap gap-2" aria-label="Período">
        {JOURNEY_PERIODS.map((period) => (
          <FilterLink key={period} href={journeyDashboardHref(period, view.course, view.era)} current={view.period === period}>
            {JOURNEY_PERIOD_LABEL[period]}
          </FilterLink>
        ))}
      </nav>
      <nav className="flex flex-wrap gap-2" aria-label="Curso">
        {COURSES.map((course) => (
          <FilterLink key={course.value} href={journeyDashboardHref(view.period, course.value, view.era)} current={view.course === course.value}>
            {course.label}
          </FilterLink>
        ))}
      </nav>
    </div>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={current ? "rounded-md border border-foreground px-3 py-1.5 text-sm font-medium" : "rounded-md border border-border px-3 py-1.5 text-sm text-muted"}
    >
      {children}
    </Link>
  );
}

export function JourneySummary({ view }: { view: JourneyDashboardView }) {
  const cards = [
    ["Jornadas identificadas", String(view.summary.journeys)],
    ["Sessões de jornada", String(view.summary.sessions)],
    ["Cliques de caminho", String(view.summary.pathChoices)],
    ["Acessos à aula gratuita", String(view.summary.freeStarts)],
    ["Checkouts iniciados", String(view.summary.checkoutStarts)],
    ["Usuários autenticados observados", String(view.summary.authenticated)],
  ];
  return (
    <section className="mt-8">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Jornada observada</p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <li key={label} className="rounded-lg border border-border p-4">
            <p className="text-sm">{label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">Um identificador representa um navegador/perfil com consentimento e pode não corresponder a uma pessoa única.</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">São sessões first-party da plataforma, não a definição de sessão do Google Analytics.</p>
      {view.readingNote ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{view.readingNote}</p> : null}
    </section>
  );
}

export function JourneyFunnel({ view }: { view: JourneyDashboardView }) {
  const max = maxCount(view.funnel.map((step) => step.count));
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Marcos da jornada</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Cada etapa mostra quantas jornadas alcançaram aquele marco no período; não é um funil fechado de cohort.</p>
      {max === 0 ? <EmptyNote>{view.outsideEra ? view.eraNote : JOURNEY_EMPTY}</EmptyNote> : (
        <div className="mt-4 flex flex-col gap-4">
          {view.funnel.map((step) => (
            <div key={step.key}>
              <ShareBar label={step.label} count={step.count} max={max} />
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{step.definition}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function JourneyCommercial({ view }: { view: JourneyDashboardView }) {
  const revenue = view.commercial.revenueCents;
  const items = view.commercial.itemValueCents;
  return (
    <section className="mt-10">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Resultado operacional</p>
      <h2 className="mt-2 text-lg font-semibold">Resultado real</h2>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <li className="rounded-lg border border-border p-4">
          <p className="text-sm">Compras pagas</p>
          <p className="mt-1 text-xs text-muted">Pedidos pagos</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{view.commercial.paidOrders}</p>
        </li>
        <li className="rounded-lg border border-border p-4">
          <p className="text-sm">Compradores distintos</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{view.commercial.paidBuyers}</p>
        </li>
        {revenue != null ? (
          <li className="rounded-lg border border-border p-4">
            <p className="text-sm">Receita recebida</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{formatPriceCents(revenue)}</p>
          </li>
        ) : null}
        {items != null ? (
          <li className="rounded-lg border border-border p-4">
            <p className="text-sm">Valor dos itens pagos relacionados ao curso</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{formatPriceCents(items)}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{JOURNEY_REVENUE_NOTE}</p>
          </li>
        ) : null}
      </ul>
      <div className="mt-4 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Cobertura da telemetria de compra</h3>
        <p className="mt-2 text-sm">Compradores com evento de jornada registrado</p>
        <p className="mt-2 text-lg font-semibold tabular-nums">
          {view.coverage.withJourney} de {view.coverage.buyers}
          {view.coverage.percent != null ? ` · ${view.coverage.percent}%` : ""}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Esse percentual mede cobertura de analytics consentido. Não é taxa de conversão. Usuários que negam analytics podem comprar sem gerar JourneyEvent.</p>
      </div>
    </section>
  );
}

export function JourneyLearning({ view }: { view: JourneyDashboardView }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Aprendizado e diagnóstico</h2>
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Jornada observada</p>
          <p className="mt-3 text-sm">Diagnósticos iniciados, só com consentimento <strong className="tabular-nums">{view.observedDiagnostics.started}</strong></p>
          <p className="mt-2 text-sm">Diagnósticos concluídos, só com consentimento <strong className="tabular-nums">{view.observedDiagnostics.completed}</strong></p>
          <p className="mt-2 text-sm leading-relaxed text-muted">Início e conclusão observados não são a mesma coisa, e nenhum dos dois substitui o registro operacional.</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">Resultado operacional</p>
          <p className="mt-3 text-sm">Alunos com aula iniciada de fato <strong className="tabular-nums">{view.operational.lessonsStarted}</strong></p>
          <p className="mt-2 text-sm">Alunos com aula concluída de fato <strong className="tabular-nums">{view.operational.lessonsCompleted}</strong></p>
          <p className="mt-2 text-sm leading-relaxed text-muted">Este é o início efetivo e a continuidade confirmada. Não use o clique de caminho, o acesso à aula gratuita nem o evento observado como se fossem este número.</p>
          {view.operational.diagnosticsCompleted == null ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">{JOURNEY_DIAGNOSTIC_NOTE}</p>
          ) : (
            <p className="mt-2 text-sm">Diagnósticos concluídos reais <strong className="tabular-nums">{view.operational.diagnosticsCompleted}</strong></p>
          )}
        </div>
      </div>
    </section>
  );
}
