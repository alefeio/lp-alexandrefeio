import { receivedRevenueCents, type PaymentRevenueStatus } from "@/lib/admin/operations";
import { courseChoiceScenarios } from "@/lib/learning/course-paths";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

/**
 * Início oficial da análise. Eventos anteriores, inclusive o smoke de produção,
 * permanecem no banco e não entram no painel. Não alterar depois do commit.
 */
export const PRODUCT_JOURNEY_REPORTING_START_AT = new Date("2026-10-26T17:42:00.000Z");

export const JOURNEY_SAMPLE_MIN = 20;
export const JOURNEY_EMPTY = "Ainda não há dados suficientes neste período.";
export const JOURNEY_SAMPLE_NOTE = "Amostra inicial: evite tirar conclusões definitivas.";
export const JOURNEY_REVENUE_NOTE = "Receita financeira é exibida apenas na visão geral.";
export const JOURNEY_DIAGNOSTIC_NOTE = "Diagnósticos operacionais não estão ligados a uma formação e aparecem só na visão geral.";

export const JOURNEY_PERIODS = ["7", "30", "90", "all"] as const;
export type JourneyPeriod = (typeof JOURNEY_PERIODS)[number];
export type JourneyCourse = "all" | typeof TRAFFIC_COURSE_SLUG | typeof SITES_COURSE_SLUG;

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
  { key: "path", label: "Escolheu um caminho", events: ["home_course_path_click", "course_catalog_path_click"] },
  { key: "course_view", label: "Visualizou um curso", events: ["course_view"] },
  { key: "free_start", label: "Começou aula gratuita", events: ["course_free_start"] },
  { key: "lesson_started", label: "Iniciou aula", events: ["lesson_started"] },
  { key: "lesson_completed", label: "Concluiu aula", events: ["lesson_completed"] },
  { key: "diagnostic_completed", label: "Concluiu diagnóstico", events: ["diagnostic_completed"] },
  { key: "checkout_started", label: "Iniciou checkout", events: ["checkout_started"] },
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

export type JourneyQuery = { periodo?: string; curso?: string };

export function parseJourneyPeriod(raw: string | undefined): JourneyPeriod {
  return raw === "7" || raw === "30" || raw === "90" || raw === "all" ? raw : "30";
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

export function journeyDashboardHref(period: JourneyPeriod, course: JourneyCourse): string {
  const params = new URLSearchParams();
  if (period !== "30") params.set("periodo", period);
  if (course !== "all") params.set("curso", course);
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
  funnel: Array<{ key: JourneyFunnelKey; label: string; count: number }>;
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
  const course = parseJourneyCourse(input.query.curso);
  const window = journeyWindow(period, input.now);
  const events = input.events
    .filter((event) => journeyEventInRange(event.occurredAt, window.start, window.end))
    .filter((event) => journeyEventMatchesCourse(event, course));
  const titles = input.courseTitles ?? {};
  const lessonTitles = input.lessonTitles ?? {};
  const inWindow = (value: Date | null | undefined) => value != null && journeyEventInRange(value, window.start, window.end);

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
  return {
    baselineLabel: formatJourneyDateTime(PRODUCT_JOURNEY_REPORTING_START_AT),
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
    funnel: model.funnel,
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
