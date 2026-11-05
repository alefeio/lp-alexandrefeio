export const BLOG_READER_KEY = "af_blog_reader_id_v1";
export const BLOG_SESSION_KEY = "af_blog_session_v1";
export const BLOG_READING_INDEX_KEY = "af_blog_reading_index_v1";
export const BLOG_READER_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BlogReadingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type ReaderRecord = { id: string; createdAt: number };

export function isBlogReaderUuid(value: string): boolean {
  return UUID.test(value);
}

function readReader(storage: BlogReadingStorage): ReaderRecord | null {
  const raw = storage.getItem(BLOG_READER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderRecord>;
    if (typeof parsed.id !== "string" || !isBlogReaderUuid(parsed.id)) return null;
    if (typeof parsed.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) return null;
    return { id: parsed.id, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
}

/** Pseudônimo editorial. Só deve ser chamado com analytics ligado. Não é o id da jornada. */
export function readOrCreateBlogReaderId(storage: BlogReadingStorage, now: number, randomUUID: () => string): string {
  const current = readReader(storage);
  if (current && now - current.createdAt < BLOG_READER_TTL_MS) return current.id;
  const next = { id: randomUUID(), createdAt: now };
  storage.setItem(BLOG_READER_KEY, JSON.stringify(next));
  return next.id;
}

export function readOrCreateBlogSessionId(storage: BlogReadingStorage, randomUUID: () => string): string {
  const current = storage.getItem(BLOG_SESSION_KEY);
  if (current && isBlogReaderUuid(current)) return current;
  const next = randomUUID();
  storage.setItem(BLOG_SESSION_KEY, next);
  return next;
}

export function clearBlogReadingIdentity(local: BlogReadingStorage, session: BlogReadingStorage): void {
  local.removeItem(BLOG_READER_KEY);
  session.removeItem(BLOG_SESSION_KEY);
  session.removeItem(BLOG_READING_INDEX_KEY);
}
