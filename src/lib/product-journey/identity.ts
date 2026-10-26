export const JOURNEY_ANONYMOUS_KEY = "af_journey_id_v1";
export const JOURNEY_SESSION_KEY = "af_journey_session_v1";
export const JOURNEY_ANONYMOUS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type JourneyStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type AnonymousRecord = { id: string; createdAt: number };

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

/** Cria ou reutiliza o pseudônimo. Quem chama só deve fazer isso com analytics ligado. */
export function readOrCreateAnonymousId(storage: JourneyStorage, now: number, randomUUID: () => string): string {
  const current = readAnonymous(storage);
  if (current && now - current.createdAt < JOURNEY_ANONYMOUS_TTL_MS) return current.id;
  const next = { id: randomUUID(), createdAt: now };
  storage.setItem(JOURNEY_ANONYMOUS_KEY, JSON.stringify(next));
  return next.id;
}

export function readOrCreateSessionId(storage: JourneyStorage, randomUUID: () => string): string {
  const current = storage.getItem(JOURNEY_SESSION_KEY);
  if (current && isJourneyUuid(current)) return current;
  const next = randomUUID();
  storage.setItem(JOURNEY_SESSION_KEY, next);
  return next;
}

export function clearJourneyIdentity(local: JourneyStorage, session: JourneyStorage): void {
  local.removeItem(JOURNEY_ANONYMOUS_KEY);
  session.removeItem(JOURNEY_SESSION_KEY);
}
