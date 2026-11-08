export const JOURNEY_ANONYMOUS_KEY = "af_journey_id_v1";
export const JOURNEY_SESSION_KEY = "af_journey_session_v1";
export const JOURNEY_FIRST_INTERACTION_KEY = "af_journey_first_interaction_v1";
export const JOURNEY_ANONYMOUS_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Renova o sessionId após inatividade prolongada na mesma aba. */
export const JOURNEY_SESSION_IDLE_MS = 30 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JourneyStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type AnonymousRecord = { id: string; createdAt: number };
type SessionRecord = { id: string; lastActivityAt: number };

export function isJourneyUuid(value: string): boolean {
  return UUID.test(value);
}

function readAnonymous(storage: JourneyStorage): AnonymousRecord | null {
  const raw = storage.getItem(JOURNEY_ANONYMOUS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AnonymousRecord>;
    if (typeof parsed.id !== "string" || !isJourneyUuid(parsed.id)) return null;
    if (typeof parsed.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) return null;
    return { id: parsed.id, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

function readSession(storage: JourneyStorage): SessionRecord | null {
  const raw = storage.getItem(JOURNEY_SESSION_KEY);
  if (!raw) return null;
  if (isJourneyUuid(raw)) {
    return { id: raw, lastActivityAt: 0 };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SessionRecord>;
    if (typeof parsed.id !== "string" || !isJourneyUuid(parsed.id)) return null;
    if (typeof parsed.lastActivityAt !== "number" || !Number.isFinite(parsed.lastActivityAt)) return null;
    return { id: parsed.id, lastActivityAt: parsed.lastActivityAt };
  } catch {
    return null;
  }
}

function writeSession(storage: JourneyStorage, record: SessionRecord): void {
  storage.setItem(JOURNEY_SESSION_KEY, JSON.stringify(record));
}

/** Cria ou reutiliza o pseudônimo. Quem chama só deve fazer isso com analytics ligado. */
export function readOrCreateAnonymousId(storage: JourneyStorage, now: number, randomUUID: () => string): string {
  const current = readAnonymous(storage);
  if (current && now - current.createdAt < JOURNEY_ANONYMOUS_TTL_MS) return current.id;
  const next = { id: randomUUID(), createdAt: now };
  storage.setItem(JOURNEY_ANONYMOUS_KEY, JSON.stringify(next));
  return next.id;
}

/**
 * Cria ou reutiliza o sessionId. Legado (UUID puro) é promovido ao formato com lastActivityAt.
 * Após JOURNEY_SESSION_IDLE_MS sem atividade, gera um novo id.
 */
export function readOrCreateSessionId(storage: JourneyStorage, randomUUID: () => string, now = Date.now()): string {
  const current = readSession(storage);
  if (current) {
    const idle = current.lastActivityAt === 0 ? false : now - current.lastActivityAt >= JOURNEY_SESSION_IDLE_MS;
    if (!idle) {
      writeSession(storage, { id: current.id, lastActivityAt: now });
      return current.id;
    }
  }
  const next = { id: randomUUID(), lastActivityAt: now };
  writeSession(storage, next);
  return next.id;
}

export function clearJourneyIdentity(local: JourneyStorage, session: JourneyStorage): void {
  local.removeItem(JOURNEY_ANONYMOUS_KEY);
  session.removeItem(JOURNEY_SESSION_KEY);
}

/** Remove markers de dedupe de page view / course view no sessionStorage. */
export function clearJourneySessionMarkers(session: JourneyStorage): void {
  const keys: string[] = [];
  if ("length" in session && typeof (session as Storage).key === "function") {
    const store = session as Storage;
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key) keys.push(key);
    }
  } else if (session instanceof Map || typeof (session as { keys?: () => IterableIterator<string> }).keys === "function") {
    // memoryStorage de testes não expõe key(); limpeza parcial via prefixes conhecidos fica no caller.
  }
  for (const key of keys) {
    if (
      key.startsWith("af_journey_course_view_") ||
      key.startsWith("af_journey_pv_") ||
      key === JOURNEY_FIRST_INTERACTION_KEY
    ) {
      session.removeItem(key);
    }
  }
  session.removeItem(JOURNEY_FIRST_INTERACTION_KEY);
}
