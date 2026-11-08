/**
 * Leitura J2-A: entrada e primeira interação por sessão.
 * Não altera UX_C_PRODUCTION_AT nem PRODUCT_JOURNEY_REPORTING_START_AT.
 *
 * Marco provisional do Preview da feature. Atualizar no go-live Production com
 * SHA e deployment, no mesmo padrão da UX-C.
 */
export const J2A_ENTRY_INSTRUMENTATION_AT = new Date("2026-11-08T06:30:00.000Z");

export const J2A_ENTRY_NOTE =
  "Entrada e primeira interação só existem a partir da instrumentação J2-A. Não compare com o histórico anterior a esse marco.";

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

/** Janela efetiva do bloco de entrada: max(início do recorte, marco J2-A). */
export function journeyEntryBounds(windowStart: Date, windowEnd: Date, instrumentationAt = J2A_ENTRY_INSTRUMENTATION_AT) {
  const start = windowStart.getTime() > instrumentationAt.getTime() ? windowStart : new Date(instrumentationAt.getTime());
  const outsideInstrumentation = start.getTime() >= windowEnd.getTime();
  return { start: outsideInstrumentation ? windowEnd : start, end: windowEnd, outsideInstrumentation };
}

/**
 * Agrega por sessionId com ordenação temporal.
 * Contagens são independentes — não formam taxa de conversão cruzada com GA4.
 */
export function buildJourneyEntrySnapshot(
  events: JourneyEntryEvent[],
  input: { start: Date; end: Date; instrumentationLabel: string; outsideInstrumentation: boolean },
): JourneyEntrySnapshot {
  if (input.outsideInstrumentation) {
    return emptyEntrySnapshot(input.instrumentationLabel, true);
  }

  const rows = events
    .filter((event) => event.sessionId && inRange(event.occurredAt, input.start, input.end))
    .slice()
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

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
    sessionsStarted,
    sessionsWithInteraction: withInteraction,
    entryPages: topCounts(entryPages).map(({ path, sessions }) => ({ path, sessions })),
    firstInteractions: topCounts(firstInteractions).map(({ label, sessions }) => ({ label, sessions })),
    lastPages: topCounts(lastPages).map(({ path, sessions }) => ({ path, sessions })),
    advanced: { courses, lessons, signUps },
  };
}

export function emptyEntrySnapshot(instrumentationLabel: string, outsideInstrumentation: boolean): JourneyEntrySnapshot {
  return {
    instrumentationLabel,
    outsideInstrumentation,
    sessionsStarted: 0,
    sessionsWithInteraction: 0,
    entryPages: [],
    firstInteractions: [],
    lastPages: [],
    advanced: { courses: 0, lessons: 0, signUps: 0 },
  };
}
