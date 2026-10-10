import { resultResponseSchema } from "@/lib/learning/blocks";

export const LOCAL_PROGRESS_KEY = "af_lesson_progress_v1";

export type LocalLessonProgress = {
  updatedAt: string;
  lastBlockKey: string | null;
  viewedBlockKeys: string[];
  responses: Record<string, unknown>;
  result: Record<string, string> | null;
};

export type LocalProgressStore = Record<string, LocalLessonProgress>;

export function emptyLocalLesson(now = new Date().toISOString()): LocalLessonProgress {
  return {
    updatedAt: now,
    lastBlockKey: null,
    viewedBlockKeys: [],
    responses: {},
    result: null,
  };
}

export function parseLocalStore(raw: string | null): LocalProgressStore {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const store: LocalProgressStore = {};
    for (const [slug, value] of Object.entries(parsed)) {
      const lesson = parseLocalLesson(value);
      if (lesson && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) store[slug] = lesson;
    }
    return store;
  } catch {
    return {};
  }
}

export function parseLocalLesson(value: unknown): LocalLessonProgress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<LocalLessonProgress>;
  if (typeof record.updatedAt !== "string") return null;
  const viewedBlockKeys = Array.isArray(record.viewedBlockKeys)
    ? record.viewedBlockKeys.filter((key): key is string => typeof key === "string").slice(0, 200)
    : [];
  const responses =
    record.responses && typeof record.responses === "object" && !Array.isArray(record.responses)
      ? (record.responses as Record<string, unknown>)
      : {};
  const resultParsed = resultResponseSchema.safeParse(record.result ?? {});
  return {
    updatedAt: record.updatedAt,
    lastBlockKey: typeof record.lastBlockKey === "string" ? record.lastBlockKey : null,
    viewedBlockKeys,
    responses,
    result: record.result && resultParsed.success ? resultParsed.data : null,
  };
}

/**
 * Não sobrescreve progresso do servidor com estado local mais antigo.
 * Se o local for mais novo e ainda não houver servidor, importa.
 * Se os dois existirem e o local for mais novo, une blocos vistos.
 * Resposta e resultado já gravados no servidor prevalecem.
 */
export function mergeLessonProgress(
  server: LocalLessonProgress | null,
  local: LocalLessonProgress | null,
): { progress: LocalLessonProgress | null; write: boolean } {
  if (!local) return { progress: server, write: false };
  if (!server) return { progress: local, write: true };

  const serverTime = Date.parse(server.updatedAt);
  const localTime = Date.parse(local.updatedAt);
  if (!Number.isFinite(localTime) || (Number.isFinite(serverTime) && serverTime >= localTime)) {
    return { progress: server, write: false };
  }

  return {
    write: true,
    progress: {
      updatedAt: local.updatedAt,
      lastBlockKey: local.lastBlockKey ?? server.lastBlockKey,
      viewedBlockKeys: [...new Set([...server.viewedBlockKeys, ...local.viewedBlockKeys])],
      responses: { ...local.responses, ...server.responses },
      result: server.result ?? local.result,
    },
  };
}

export function readLocalProgress(slug: string): LocalLessonProgress | null {
  if (typeof window === "undefined") return null;
  const store = parseLocalStore(window.localStorage.getItem(LOCAL_PROGRESS_KEY));
  return store[slug] ?? null;
}

export function writeLocalProgress(slug: string, progress: LocalLessonProgress): void {
  if (typeof window === "undefined") return;
  const store = parseLocalStore(window.localStorage.getItem(LOCAL_PROGRESS_KEY));
  store[slug] = progress;
  window.localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(store));
}
