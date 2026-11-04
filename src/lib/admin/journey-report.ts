import { receivedRevenueCents, type PaymentRevenueStatus } from "@/lib/admin/operations";
import { courseChoiceScenarios } from "@/lib/learning/course-paths";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

/**
 * Início oficial da análise. Eventos anteriores, inclusive o smoke de produção,
 * permanecem no banco e não entram no painel. Não alterar depois do commit.
 */
export const PRODUCT_JOURNEY_REPORTING_START_AT = new Date("2026-10-26T17:42:00.000Z");

/**
 * Implantação da UX-C em Production: merge do PR #14 em main.
 * Commit 9f6a2e8ee4782734654dd9a94c63f75065771de1, 2026-11-03T16:32:04.000Z.
 * Não alterar depois do commit. Não é um carimbo de deploy observado fora do Git.
 */
export const UX_C_PRODUCTION_AT = new Date("2026-11-03T16:32:04.000Z");

export const JOURNEY_SAMPLE_MIN = 20;
export const JOURNEY_EMPTY = "Ainda não há dados suficientes neste período.";
export const JOURNEY_SAMPLE_NOTE = "De 1 a 19 jornadas: verifique a coleta e problemas evidentes. A amostra ainda não sustenta tendência.";
export const JOURNEY_CTA_NOTE = "O clique de CTA do curso fica só no GA4. Neste painel ele está ausente e é diferente de aula iniciada.";
export const JOURNEY_ERA_OUTSIDE = "O período escolhido não cruza este marco. Os zeros abaixo vêm desse recorte, não de uma falha automática da coleta.";
export const JOURNEY_REVENUE_NOTE = "Receita financeira é exibida apenas na visão geral.";
export const JOURNEY_DIAGNOSTIC_NOTE = "Diagnósticos operacionais não estão ligados a uma formação e aparecem só na visão geral.";

export const JOURNEY_PERIODS = ["7", "30", "90", "all"] as const;
export const JOURNEY_ERAS = ["ux-c", "historico", "completo"] as const;
export type JourneyPeriod = (typeof JOURNEY_PERIODS)[number];
export type JourneyEra = (typeof JOURNEY_ERAS)[number];
export type JourneyCourse = "all" | typeof TRAFFIC_COURSE_SLUG | typeof SITES_COURSE_SLUG;

export const JOURNEY_ERA_LABEL: Record<JourneyEra, string> = {
  "ux-c": "Após a UX-C",
  historico: "Antes da UX-C",
  completo: "Períodos juntos",
};

export const JOURNEY_PERIOD_LABEL: Record<JourneyPeriod, string> = {
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias",
  all: "Todo o período",
};

const COURSE_SHORT_LABEL: Record<string, string> = {
  [TRAFFIC_COURSE_SLUG]: "Tráfego Pago",
  [SITES_COURSE_SLUG]: "Sites que Convertem",
};

export const JOURNEY_FUNNEL = [
  { key: "path", label: "Clique em um caminho", definition: "Clique na home ou no catálogo para escolher um percurso. Não é aluno e não é início de aula.", events: ["home_course_path_click", "course_catalog_path_click"] },
  { key: "course_view", label: "Visualização do curso", definition: "Página de um curso vista por quem consentiu analytics. A visualização genérica de outras páginas fica só no GA4.", events: ["course_view"] },
  { key: "free_start", label: "Acesso à aula gratuita", definition: "Clique para abrir a aula gratuita. Não significa que o estudo começou.", events: ["course_free_start"] },
  { key: "lesson_started", label: "Início de aprendizagem observado", definition: "Evento de quem consentiu ao abrir a aula. O início efetivo do aluno está na contagem operacional.", events: ["lesson_started"] },
  { key: "lesson_completed", label: "Conclusão de aula observada", definition: "Evento consentido de conclusão. A continuidade confirmada do aluno está na conclusão operacional.", events: ["lesson_completed"] },
  { key: "diagnostic_completed", label: "Diagnóstico concluído observado", definition: "Evento consentido de conclusão. O início observado aparece à parte. A conclusão real só entra na visão geral.", events: ["diagnostic_completed"] },
  { key: "checkout_started", label: "Checkout iniciado", definition: "Intenção de pagamento observada. Compra e acesso pago vêm do pedido pago, não deste clique.", events: ["checkout_started"] },
] as const;

export type JourneyFunnelKey = (typeof JOURNEY_FUNNEL)[number]["key"];

const PATH_EVENTS = ["home_course_path_click", "course_catalog_path_click"] as const;

export type JourneyObservedEvent = {
  anonymousId: string;
  sessionId?: string | null;
  userId?: string | null;
  eventName: string;
  occurredAt: Date;
  courseSlug?: string | null;
  lessonSlug?: string | null;
  sourceCourseSlug?: string | null;
  targetCourseSlug?: string | null;
  scenario?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  leadSource?: string | null;
  leadMedium?: string | null;
};

export type JourneyOrderFact = {
  userId: string;
  createdAt: Date;
  items: Array<{ courseSlugs: string[]; finalPriceCents: number }>;
};

export type JourneyPaymentFact = {
  status: PaymentRevenueStatus;
  amountCents: number;
  refundedAmountCents: number;
  approvedAt: Date | null;
  createdAt: Date;
};

export type JourneyProgressFact = {
  userId: string;
  courseSlug: string;
  startedAt: Date;
  completedAt: Date | null;
};

export type JourneyDiagnosticFact = {
  userId: string;
  completedAt: Date;
};

export type JourneyQuery = { periodo?: string; curso?: string; marco?: string };

export function parseJourneyPeriod(raw: string | undefined): JourneyPeriod {
  return raw === "7" || raw === "30" || raw === "90" || raw === "all" ? raw : "30";
}

export function parseJourneyEra(raw: string | undefined): JourneyEra {
  return raw === "historico" || raw === "completo" || raw === "ux-c" ? raw : "ux-c";
}

export type JourneyReadingBounds = {
  start: Date;
  end: Date;
  mixesPeriods: boolean;
  outsideEra: boolean;
};

export function journeyReadingBounds(period: JourneyPeriod, era: JourneyEra, now: Date): JourneyReadingBounds {
  const window = journeyWindow(period, now);
  if (era === "completo") {
    return {
      start: window.start,
      end: window.end,
      mixesPeriods: window.start.getTime() < UX_C_PRODUCTION_AT.getTime() && window.end.getTime() > UX_C_PRODUCTION_AT.getTime(),
      outsideEra: false,
    };
  }
  if (era === "historico") {
    const end = window.end.getTime() < UX_C_PRODUCTION_AT.getTime() ? window.end : new Date(UX_C_PRODUCTION_AT.getTime());
    const outside = window.start.getTime() >= end.getTime();
    return { start: window.start, end: outside ? window.start : end, mixesPeriods: false, outsideEra: outside };
  }
  const start = window.start.getTime() > UX_C_PRODUCTION_AT.getTime() ? window.start : new Date(UX_C_PRODUCTION_AT.getTime());
  const outside = start.getTime() >= window.end.getTime();
  return { start: outside ? window.end : start, end: window.end, mixesPeriods: false, outsideEra: outside };
}

/** Referência operacional. Não é significância estatística. */
export function journeyReadingGuide(journeys: number): string {
  if (journeys <= 0) return JOURNEY_EMPTY;
  if (journeys < 20) return JOURNEY_SAMPLE_NOTE;
  if (journeys < 50) return "De 20 a 49 jornadas: formule hipóteses iniciais. A leitura ainda não confirma um padrão.";
  if (journeys < 100) return "De 50 a 99 jornadas: procure padrões com cautela. Uma comparação categórica fica para uma amostra maior.";
  return "100 jornadas ou mais: aprofunde a leitura se a amostra for representativa. Isso não garante significância estatística.";
}

export function parseJourneyCourse(raw: string | undefined): JourneyCourse {
  if (raw === TRAFFIC_COURSE_SLUG || raw === SITES_COURSE_SLUG) return raw;
  return "all";
}

export function journeyWindow(period: JourneyPeriod, now: Date): { start: Date; end: Date } {
  const requested = period === "all" ? PRODUCT_JOURNEY_REPORTING_START_AT : new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000);
  const start = requested.getTime() > PRODUCT_JOURNEY_REPORTING_START_AT.getTime() ? requested : new Date(PRODUCT_JOURNEY_REPORTING_START_AT.getTime());
  return { start, end: now };
}

export function journeyDashboardHref(period: JourneyPeriod, course: JourneyCourse, era: JourneyEra = "ux-c"): string {
  const params = new URLSearchParams();
  if (period !== "30") params.set("periodo", period);
  if (course !== "all") params.set("curso", course);
  if (era !== "ux-c") params.set("marco", era);
  const query = params.toString();
  return query ? `/admin/jornada?${query}` : "/admin/jornada";
}

export function formatJourneyDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("day")}/${read("month")}/${read("year")} ${read("hour")}:${read("minute")}`;
}

export function journeyCourseLabel(slug: string | null | undefined, titles: Record<string, string> = {}): string {
  if (!slug) return "Sem curso";
  return titles[slug] ?? COURSE_SHORT_LABEL[slug] ?? slug;
}

export function journeyScenarioLabel(scenario: string): string {
  if (!scenario) return "Não informado";
  return courseChoiceScenarios.find((item) => item.id === scenario)?.title ?? scenario;
}

export function journeyEventMatchesCourse(
  event: { courseSlug?: string | null; sourceCourseSlug?: string | null; targetCourseSlug?: string | null },
  course: JourneyCourse,
): boolean {
  if (course === "all") return true;
  if (event.courseSlug) return event.courseSlug === course;
  return event.sourceCourseSlug === course || event.targetCourseSlug === course;
}

export function journeyEventInRange(occurredAt: Date, start: Date, end: Date): boolean {
  const time = occurredAt.getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function attributionPair(event: { utmSource?: string | null; utmMedium?: string | null; leadSource?: string | null; leadMedium?: string | null }) {
  const source = blank(event.utmSource) ?? blank(event.leadSource);
  const medium = blank(event.utmMedium) ?? blank(event.leadMedium);
  return { source, medium };
}

export function attributionLabel(source: string | null, medium: string | null): string {
  if (!source && !medium) return "Não informado";
  if (source === "direct" && (!medium || medium === "none")) return "direct / none";
  if (source === "organic" && (!medium || medium === "search")) return "organic / search";
  if (source === "referral" && (!medium || medium === "referral")) return "referral / referral";
  if (!source) return `Não informado / ${medium}`;
  if (!medium) return source;
  return `${source} / ${medium}`;
}

export type JourneyAggregateModel = {
  period: JourneyPeriod;
  era: JourneyEra;
  outsideEra: boolean;
  mixesPeriods: boolean;
  journeysBeforeUxC: number;
  journeysAfterUxC: number;
  course: JourneyCourse;
  journeys: number;
  sessions: number;
  authenticated: number;
  funnel: Array<{ key: JourneyFunnelKey; label: string; count: number }>;
  paidOrders: number;
  paidBuyers: number;
  revenueCents: number | null;
  itemValueCents: number | null;
  coverageWithJourney: number;
  scenarios: JourneyDashboardView["scenarios"];
  courseChoices: JourneyDashboardView["courseChoices"];
  sources: JourneyDashboardView["sources"];
  campaigns: JourneyDashboardView["campaigns"];
  freeLessons: JourneyDashboardView["freeLessons"];
  transitions: JourneyDashboardView["transitions"];
  diagnosticStarted: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  diagnosticsCompleted: number | null;
};

export type JourneyDashboardView = {
  baselineLabel: string;
  uxCLabel: string;
  era: JourneyEra;
  eraNote: string;
  outsideEra: boolean;
  mixesPeriods: boolean;
  journeySplit: { before: number; after: number } | null;
  readingNote: string;
  period: JourneyPeriod;
  course: JourneyCourse;
  smallSample: boolean;
  summary: {
    journeys: number;
    sessions: number;
    authenticated: number;
    pathChoices: number;
    freeStarts: number;
    checkoutStarts: number;
  };
  funnel: Array<{ key: JourneyFunnelKey; label: string; definition: string; count: number }>;
  commercial: {
    paidOrders: number;
    paidBuyers: number;
    revenueCents: number | null;
    itemValueCents: number | null;
  };
  coverage: { buyers: number; withJourney: number; percent: number | null };
  scenarios: Array<{ id: string; label: string; home: number; catalog: number; traffic: number; sites: number }>;
  courseChoices: Array<{ slug: string; label: string; count: number }>;
  sources: Array<{ label: string; count: number }>;
  campaigns: Array<{ label: string; count: number }>;
  freeLessons: Array<{ courseLabel: string; lessonTitle: string; journeys: number; starts: number; completions: number }>;
  transitions: Array<{ from: string; to: string; journeys: number; clicks: number }>;
  observedDiagnostics: { started: number; completed: number };
  operational: {
    lessonsStarted: number;
    lessonsCompleted: number;
    diagnosticsCompleted: number | null;
  };
};

export function buildJourneyDashboard(input: {
  events: JourneyObservedEvent[];
  orders: JourneyOrderFact[];
  payments: JourneyPaymentFact[];
  progress: JourneyProgressFact[];
  diagnostics: JourneyDiagnosticFact[];
  lessonTitles?: Record<string, string>;
  courseTitles?: Record<string, string>;
  query: JourneyQuery;
  now: Date;
}): JourneyDashboardView {
  const period = parseJourneyPeriod(input.query.periodo);
  const era = parseJourneyEra(input.query.marco);
  const course = parseJourneyCourse(input.query.curso);
  const bounds = journeyReadingBounds(period, era, input.now);
  const events = input.events
    .filter((event) => journeyEventInRange(event.occurredAt, bounds.start, bounds.end))
    .filter((event) => journeyEventMatchesCourse(event, course));
  const titles = input.courseTitles ?? {};
  const lessonTitles = input.lessonTitles ?? {};
  const inWindow = (value: Date | null | undefined) => value != null && journeyEventInRange(value, bounds.start, bounds.end);

  const funnel = JOURNEY_FUNNEL.map((step) => ({
    key: step.key,
    label: step.label,
    count: distinct(events.filter((event) => (step.events as readonly string[]).includes(event.eventName)).map((event) => event.anonymousId)),
  }));
  const orders = input.orders.filter((order) => inWindow(order.createdAt) && orderMatchesCourse(order, course));
  const buyerIds = new Set(orders.map((order) => order.userId));
  const purchaseUsers = new Set(events.filter((event) => event.eventName === "purchase_completed" && event.userId).map((event) => event.userId as string));

  return assembleJourneyView({
    period,
    era,
    outsideEra: bounds.outsideEra,
    mixesPeriods: bounds.mixesPeriods,
    journeysBeforeUxC: distinct(events.filter((event) => event.occurredAt.getTime() < UX_C_PRODUCTION_AT.getTime()).map((event) => event.anonymousId)),
    journeysAfterUxC: distinct(events.filter((event) => event.occurredAt.getTime() >= UX_C_PRODUCTION_AT.getTime()).map((event) => event.anonymousId)),
    course,
    journeys: distinct(events.map((event) => event.anonymousId)),
    sessions: distinct(events.map((event) => event.sessionId).filter((id): id is string => Boolean(id))),
    authenticated: distinct(events.map((event) => event.userId).filter((id): id is string => Boolean(id))),
    funnel,
    paidOrders: orders.length,
    paidBuyers: buyerIds.size,
    revenueCents: course === "all" ? receivedRevenueCents(input.payments.filter((payment) => inWindow(payment.approvedAt ?? payment.createdAt))) : null,
    itemValueCents: course === "all" ? null : itemValueCents(orders, course),
    coverageWithJourney: [...buyerIds].filter((userId) => purchaseUsers.has(userId)).length,
    scenarios: scenarioRows(events),
    courseChoices: courseChoiceRows(events, titles),
    sources: sourceRows(events),
    campaigns: campaignRows(events),
    freeLessons: freeLessonRows(events, titles, lessonTitles),
    transitions: transitionRows(events, titles),
    diagnosticStarted: distinct(events.filter((event) => event.eventName === "diagnostic_started").map((event) => event.anonymousId)),
    lessonsStarted: distinct(input.progress.filter((row) => inWindow(row.startedAt) && (course === "all" || row.courseSlug === course)).map((row) => row.userId)),
    lessonsCompleted: distinct(input.progress.filter((row) => inWindow(row.completedAt) && (course === "all" || row.courseSlug === course)).map((row) => row.userId)),
    diagnosticsCompleted: course === "all" ? distinct(input.diagnostics.filter((row) => inWindow(row.completedAt)).map((row) => row.userId)) : null,
  });
}

export function assembleJourneyView(model: JourneyAggregateModel): JourneyDashboardView {
  const diagnosticCompleted = model.funnel.find((step) => step.key === "diagnostic_completed")?.count ?? 0;
  const uxCLabel = formatJourneyDateTime(UX_C_PRODUCTION_AT);
  const baselineLabel = formatJourneyDateTime(PRODUCT_JOURNEY_REPORTING_START_AT);
  const journeySplit = model.era === "completo" && model.mixesPeriods
    ? { before: model.journeysBeforeUxC, after: model.journeysAfterUxC }
    : null;
  return {
    baselineLabel,
    uxCLabel,
    era: model.era,
    eraNote: eraNote(model, baselineLabel, uxCLabel, journeySplit),
    outsideEra: model.outsideEra,
    mixesPeriods: model.mixesPeriods,
    journeySplit,
    readingNote: model.journeys > 0 ? journeyReadingGuide(model.journeys) : "",
    period: model.period,
    course: model.course,
    smallSample: model.journeys > 0 && model.journeys < JOURNEY_SAMPLE_MIN,
    summary: {
      journeys: model.journeys,
      sessions: model.sessions,
      authenticated: model.authenticated,
      pathChoices: model.funnel.find((step) => step.key === "path")?.count ?? 0,
      freeStarts: model.funnel.find((step) => step.key === "free_start")?.count ?? 0,
      checkoutStarts: model.funnel.find((step) => step.key === "checkout_started")?.count ?? 0,
    },
    funnel: model.funnel.map((step) => ({
      ...step,
      definition: JOURNEY_FUNNEL.find((item) => item.key === step.key)?.definition ?? "",
    })),
    commercial: {
      paidOrders: model.paidOrders,
      paidBuyers: model.paidBuyers,
      revenueCents: model.revenueCents,
      itemValueCents: model.itemValueCents,
    },
    coverage: {
      buyers: model.paidBuyers,
      withJourney: model.coverageWithJourney,
      percent: model.paidBuyers === 0 ? null : Math.round((model.coverageWithJourney / model.paidBuyers) * 100),
    },
    scenarios: model.scenarios,
    courseChoices: model.courseChoices,
    sources: model.sources,
    campaigns: model.campaigns,
    freeLessons: model.freeLessons,
    transitions: model.transitions,
    observedDiagnostics: { started: model.diagnosticStarted, completed: diagnosticCompleted },
    operational: {
      lessonsStarted: model.lessonsStarted,
      lessonsCompleted: model.lessonsCompleted,
      diagnosticsCompleted: model.diagnosticsCompleted,
    },
  };
}

export function pivotScenarios(input: {
  cells: Array<{ scenario: string; eventName: string; journeys: number }>;
  courses: Array<{ scenario: string; courseSlug: string; journeys: number }>;
}) {
  const ids = new Set<string>([
    ...courseChoiceScenarios.map((item) => item.id),
    ...input.cells.map((cell) => cell.scenario),
    ...input.courses.map((cell) => cell.scenario),
  ]);
  const cellCount = (scenario: string, eventName: string) => input.cells.find((cell) => cell.scenario === scenario && cell.eventName === eventName)?.journeys ?? 0;
  const courseCount = (scenario: string, courseSlug: string) => input.courses.find((cell) => cell.scenario === scenario && cell.courseSlug === courseSlug)?.journeys ?? 0;
  return [...ids]
    .map((id) => ({
      id,
      label: journeyScenarioLabel(id),
      home: cellCount(id, "home_course_path_click"),
      catalog: cellCount(id, "course_catalog_path_click"),
      traffic: courseCount(id, TRAFFIC_COURSE_SLUG),
      sites: courseCount(id, SITES_COURSE_SLUG),
    }))
    .filter((row) => row.home + row.catalog + row.traffic + row.sites > 0);
}

function eraNote(
  model: JourneyAggregateModel,
  baselineLabel: string,
  uxCLabel: string,
  split: { before: number; after: number } | null,
): string {
  if (model.outsideEra) return JOURNEY_ERA_OUTSIDE;
  if (model.era === "historico") return `Somente jornadas de ${baselineLabel} até ${uxCLabel}, antes da UX-C. O instante do marco não entra.`;
  if (model.era === "completo" && split) {
    return `Estes cartões somam os dois períodos. Antes da UX-C: ${split.before} jornadas com evento. Depois: ${split.after}. A mesma jornada pode aparecer nos dois lados. Leia cada lado em separado: a soma dos dois não é o total e não mede desempenho.`;
  }
  if (model.era === "completo") {
    return "Este período fica inteiro de um lado do marco. Os cartões não misturam histórico e UX-C.";
  }
  return `Somente jornadas a partir de ${uxCLabel}, marco da UX-C em Production. O histórico anterior fica no filtro Antes da UX-C.`;
}

function scenarioRows(events: JourneyObservedEvent[]) {
  const path = events.filter((event) => (PATH_EVENTS as readonly string[]).includes(event.eventName));
  const scenarios = new Set(path.map((event) => event.scenario ?? ""));
  const cells = [...scenarios].flatMap((scenario) =>
    PATH_EVENTS.map((eventName) => ({
      scenario,
      eventName,
      journeys: distinct(path.filter((event) => (event.scenario ?? "") === scenario && event.eventName === eventName).map((event) => event.anonymousId)),
    })),
  );
  const courseKeys = new Set(path.filter((event) => event.courseSlug).map((event) => `${event.scenario ?? ""}\n${event.courseSlug}`));
  const courses = [...courseKeys].map((key) => {
    const [scenario, courseSlug] = key.split("\n");
    return {
      scenario: scenario ?? "",
      courseSlug: courseSlug ?? "",
      journeys: distinct(path.filter((event) => (event.scenario ?? "") === scenario && event.courseSlug === courseSlug).map((event) => event.anonymousId)),
    };
  });
  return pivotScenarios({ cells, courses });
}

function courseChoiceRows(events: JourneyObservedEvent[], titles: Record<string, string>) {
  const path = events.filter((event) => (PATH_EVENTS as readonly string[]).includes(event.eventName) && event.courseSlug);
  return [TRAFFIC_COURSE_SLUG, SITES_COURSE_SLUG]
    .map((slug) => ({
      slug,
      label: journeyCourseLabel(slug, titles),
      count: distinct(path.filter((event) => event.courseSlug === slug).map((event) => event.anonymousId)),
    }))
    .filter((row) => row.count > 0);
}

function sourceRows(events: JourneyObservedEvent[]) {
  const counts = new Map<string, number>();
  for (const event of firstEvents(events).values()) {
    const pair = attributionPair(event);
    const label = attributionLabel(pair.source, pair.medium);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 10);
}

function campaignRows(events: JourneyObservedEvent[]) {
  const counts = new Map<string, number>();
  for (const event of firstEvents(events).values()) {
    const campaign = blank(event.utmCampaign);
    if (!campaign) continue;
    counts.set(campaign, (counts.get(campaign) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 10);
}

function freeLessonRows(events: JourneyObservedEvent[], titles: Record<string, string>, lessonTitles: Record<string, string>) {
  const keys = new Set(events.filter((event) => event.eventName === "course_free_start").map((event) => lessonKey(event.courseSlug, event.lessonSlug)));
  return [...keys]
    .map((key) => {
      const [courseSlug, lessonSlug] = key.split("\n");
      const starts = events.filter((event) => event.eventName === "course_free_start" && lessonKey(event.courseSlug, event.lessonSlug) === key);
      const completions = events.filter((event) => event.eventName === "lesson_completed" && lessonKey(event.courseSlug, event.lessonSlug) === key);
      return {
        courseLabel: journeyCourseLabel(courseSlug || null, titles),
        lessonTitle: (lessonSlug && lessonTitles[lessonSlug]) || lessonSlug || "Aula sem slug",
        journeys: distinct(starts.map((event) => event.anonymousId)),
        starts: starts.length,
        completions: distinct(completions.map((event) => event.anonymousId)),
      };
    })
    .sort((a, b) => b.journeys - a.journeys || a.lessonTitle.localeCompare(b.lessonTitle));
}

function transitionRows(events: JourneyObservedEvent[], titles: Record<string, string>) {
  const clicks = events.filter((event) => event.eventName === "course_complementary_click");
  const pairs = new Set(clicks.map((event) => `${event.sourceCourseSlug ?? ""}\n${event.targetCourseSlug ?? ""}`));
  return [...pairs]
    .map((pair) => {
      const [source, target] = pair.split("\n");
      const rows = clicks.filter((event) => (event.sourceCourseSlug ?? "") === source && (event.targetCourseSlug ?? "") === target);
      return {
        from: journeyCourseLabel(source || null, titles),
        to: journeyCourseLabel(target || null, titles),
        journeys: distinct(rows.map((event) => event.anonymousId)),
        clicks: rows.length,
      };
    })
    .sort((a, b) => b.journeys - a.journeys || a.from.localeCompare(b.from));
}

function firstEvents(events: JourneyObservedEvent[]) {
  const ordered = events.map((event, index) => ({ event, index })).sort((a, b) => a.event.occurredAt.getTime() - b.event.occurredAt.getTime() || a.index - b.index);
  const first = new Map<string, JourneyObservedEvent>();
  for (const item of ordered) {
    if (!first.has(item.event.anonymousId)) first.set(item.event.anonymousId, item.event);
  }
  return first;
}

function orderMatchesCourse(order: JourneyOrderFact, course: JourneyCourse) {
  if (course === "all") return true;
  return order.items.some((item) => item.courseSlugs.includes(course));
}

function itemValueCents(orders: JourneyOrderFact[], course: JourneyCourse) {
  return orders.reduce((sum, order) => sum + order.items.filter((item) => course !== "all" && item.courseSlugs.includes(course)).reduce((itemSum, item) => itemSum + item.finalPriceCents, 0), 0);
}

function lessonKey(courseSlug: string | null | undefined, lessonSlug: string | null | undefined) {
  return `${courseSlug ?? ""}\n${lessonSlug ?? ""}`;
}

function distinct(values: string[]) {
  return new Set(values).size;
}

function blank(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
