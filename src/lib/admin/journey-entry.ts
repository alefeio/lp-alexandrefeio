/**
 * Leitura J2-A: entrada e primeira interação por sessão.
 * Não altera UX_C_PRODUCTION_AT nem PRODUCT_JOURNEY_REPORTING_START_AT.
 *
 * `J2A_ENTRY_INSTRUMENTATION_AT` permanece null até o go-live Production com
 * SHA e deployment verificáveis (mesmo padrão da UX-C). Preview não define o marco.
 */
export const J2A_ENTRY_INSTRUMENTATION_AT: Date | null = null;

export const J2A_ENTRY_NOTE =
  "Entrada e primeira interação descrevem a plataforma inteira e não obedecem ao filtro de formação. Não misture esses denominadores com o funil filtrado por curso.";

export const J2A_ENTRY_PENDING_NOTE =
  "Marco oficial J2-A pendente de publicação em Production. Os números abaixo incluem Preview/testes e não devem ser usados como baseline histórico.";

/** Teto defensivo da consulta entry (sem índice em sessionId). Acima disso, priorizar agregação SQL em sprint futura. */
export const J2A_ENTRY_QUERY_ROW_BUDGET = 20_000;

const ADVANCE_COURSE = new Set(["course_view", "course_catalog_click", "home_course_path_click", "course_catalog_path_click"]);
const ADVANCE_LESSON = new Set(["course_free_start", "lesson_started", "lesson_completed"]);
const ADVANCE_SIGNUP = new Set(["sign_up"]);

export type JourneyEntryEvent = {
  sessionId?: string | null;
  eventName: string;
  occurredAt: Date;
  sourcePath?: string | null;
  targetPath?: string | null;
  ctaName?: string | null;
  courseSlug?: string | null;
};

export type JourneyEntrySnapshot = {
  instrumentationLabel: string;
  outsideInstrumentation: boolean;
  pendingOfficialStart: boolean;
  courseFilterIndependent: true;
  sessionsStarted: number;
  sessionsWithInteraction: number;
  entryPages: Array<{ path: string; sessions: number }>;
  firstInteractions: Array<{ label: string; sessions: number }>;
  lastPages: Array<{ path: string; sessions: number }>;
  advanced: { courses: number; lessons: number; signUps: number };
};

function inRange(value: Date, start: Date, end: Date) {
  const time = value.getTime();
  return time >= start.getTime() && time < end.getTime();
}

function topCounts(map: Map<string, number>, limit = 12) {
  return [...map.entries()]
    .map(([label, sessions]) => ({ path: label, sessions, label }))
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label))
    .slice(0, limit);
}

function pageViewRank(eventName: string): number {
  if (eventName === "site_page_view") return 0;
  if (eventName === "site_first_interaction") return 1;
  return 2;
}

export function sortJourneyEntryEvents(events: JourneyEntryEvent[]): JourneyEntryEvent[] {
  return events.slice().sort((a, b) => {
    const byTime = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (byTime !== 0) return byTime;
    const byKind = pageViewRank(a.eventName) - pageViewRank(b.eventName);
    if (byKind !== 0) return byKind;
    return (a.sourcePath ?? "").localeCompare(b.sourcePath ?? "");
  });
}

/** Janela efetiva do bloco de entrada: max(início do recorte, marco J2-A) quando o marco existir. */
export function journeyEntryBounds(
  windowStart: Date,
  windowEnd: Date,
  instrumentationAt: Date | null = J2A_ENTRY_INSTRUMENTATION_AT,
): { start: Date; end: Date; outsideInstrumentation: boolean; pendingOfficialStart: boolean } {
  if (!instrumentationAt) {
    return { start: windowStart, end: windowEnd, outsideInstrumentation: false, pendingOfficialStart: true };
  }
  const start = windowStart.getTime() > instrumentationAt.getTime() ? windowStart : new Date(instrumentationAt.getTime());
  const outsideInstrumentation = start.getTime() >= windowEnd.getTime();
  return {
    start: outsideInstrumentation ? windowEnd : start,
    end: windowEnd,
    outsideInstrumentation,
    pendingOfficialStart: false,
  };
}

export function j2aInstrumentationLabel(instrumentationAt: Date | null = J2A_ENTRY_INSTRUMENTATION_AT): string {
  if (!instrumentationAt) return "pendente de Production";
  return instrumentationAt.toISOString();
}

/**
 * Agrega por sessionId com ordenação temporal (occurredAt do cliente quando válido).
 * Contagens são independentes — não formam taxa de conversão cruzada com GA4 nem com o filtro de curso.
 */
export function buildJourneyEntrySnapshot(
  events: JourneyEntryEvent[],
  input: {
    start: Date;
    end: Date;
    instrumentationLabel: string;
    outsideInstrumentation: boolean;
    pendingOfficialStart?: boolean;
  },
): JourneyEntrySnapshot {
  if (input.outsideInstrumentation) {
    return emptyEntrySnapshot(input.instrumentationLabel, true, Boolean(input.pendingOfficialStart));
  }

  const rows = sortJourneyEntryEvents(events.filter((event) => event.sessionId && inRange(event.occurredAt, input.start, input.end)));

  const bySession = new Map<string, JourneyEntryEvent[]>();
  for (const event of rows) {
    const id = event.sessionId as string;
    const list = bySession.get(id);
    if (list) list.push(event);
    else bySession.set(id, [event]);
  }

  const entryPages = new Map<string, number>();
  const lastPages = new Map<string, number>();
  const firstInteractions = new Map<string, number>();
  let withInteraction = 0;
  let courses = 0;
  let lessons = 0;
  let signUps = 0;
  let sessionsStarted = 0;

  for (const sessionEvents of bySession.values()) {
    const pageViews = sessionEvents.filter((event) => event.eventName === "site_page_view" && event.sourcePath);
    if (pageViews.length === 0) continue;
    sessionsStarted += 1;
    const entry = pageViews[0]!.sourcePath!;
    const last = pageViews[pageViews.length - 1]!.sourcePath!;
    entryPages.set(entry, (entryPages.get(entry) ?? 0) + 1);
    lastPages.set(last, (lastPages.get(last) ?? 0) + 1);

    const firstInteraction = sessionEvents.find((event) => event.eventName === "site_first_interaction");
    if (firstInteraction) {
      withInteraction += 1;
      const label = firstInteraction.ctaName?.trim() || "interacao";
      firstInteractions.set(label, (firstInteractions.get(label) ?? 0) + 1);
    }

    if (sessionEvents.some((event) => ADVANCE_COURSE.has(event.eventName))) courses += 1;
    if (sessionEvents.some((event) => ADVANCE_LESSON.has(event.eventName))) lessons += 1;
    if (sessionEvents.some((event) => ADVANCE_SIGNUP.has(event.eventName))) signUps += 1;
  }

  return {
    instrumentationLabel: input.instrumentationLabel,
    outsideInstrumentation: false,
    pendingOfficialStart: Boolean(input.pendingOfficialStart),
    courseFilterIndependent: true,
    sessionsStarted,
    sessionsWithInteraction: withInteraction,
    entryPages: topCounts(entryPages).map(({ path, sessions }) => ({ path, sessions })),
    firstInteractions: topCounts(firstInteractions).map(({ label, sessions }) => ({ label, sessions })),
    lastPages: topCounts(lastPages).map(({ path, sessions }) => ({ path, sessions })),
    advanced: { courses, lessons, signUps },
  };
}

export function emptyEntrySnapshot(
  instrumentationLabel: string,
  outsideInstrumentation: boolean,
  pendingOfficialStart = false,
): JourneyEntrySnapshot {
  return {
    instrumentationLabel,
    outsideInstrumentation,
    pendingOfficialStart,
    courseFilterIndependent: true,
    sessionsStarted: 0,
    sessionsWithInteraction: 0,
    entryPages: [],
    firstInteractions: [],
    lastPages: [],
    advanced: { courses: 0, lessons: 0, signUps: 0 },
  };
}
