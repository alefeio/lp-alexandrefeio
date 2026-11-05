import { BLOG_READING_IDLE_MS, BLOG_READING_MAX_ACTIVE_MS } from "@/lib/blog/reading/constants";
import { BLOG_READING_INDEX_KEY, isBlogReaderUuid } from "@/lib/blog/reading/identity";

export type BlogReadingCheckpoint = {
  clientReadingId: string;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  lastActivityAt: number;
  opened: boolean;
};

type IndexMap = Record<string, BlogReadingCheckpoint>;

function isCheckpoint(value: unknown): value is BlogReadingCheckpoint {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BlogReadingCheckpoint>;
  if (typeof row.clientReadingId !== "string" || !isBlogReaderUuid(row.clientReadingId)) return false;
  if (typeof row.activeTimeMs !== "number" || !Number.isFinite(row.activeTimeMs) || row.activeTimeMs < 0 || row.activeTimeMs > BLOG_READING_MAX_ACTIVE_MS) return false;
  if (typeof row.maxScrollPercent !== "number" || !Number.isInteger(row.maxScrollPercent) || row.maxScrollPercent < 0 || row.maxScrollPercent > 100) return false;
  if (typeof row.reachedEnd !== "boolean") return false;
  if (typeof row.lastActivityAt !== "number" || !Number.isFinite(row.lastActivityAt) || row.lastActivityAt <= 0) return false;
  if (typeof row.opened !== "boolean") return false;
  return true;
}

function readIndex(storage: { getItem(key: string): string | null }): IndexMap {
  const raw = storage.getItem(BLOG_READING_INDEX_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: IndexMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isCheckpoint(value)) out[key] = value;
      else if (value && typeof value === "object" && typeof (value as { clientReadingId?: unknown }).clientReadingId === "string") {
        // Entrada antiga só com id: descartada com segurança (sem progresso inventado).
        continue;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeIndex(storage: { setItem(key: string, value: string): void; removeItem(key: string): void }, index: IndexMap) {
  if (Object.keys(index).length === 0) {
    storage.removeItem(BLOG_READING_INDEX_KEY);
    return;
  }
  storage.setItem(BLOG_READING_INDEX_KEY, JSON.stringify(index));
}

export function readBlogReadingCheckpoint(
  storage: { getItem(key: string): string | null },
  blogPostId: string,
  now: number,
): { kind: "fresh" } | { kind: "resume"; checkpoint: BlogReadingCheckpoint } | { kind: "expired"; checkpoint: BlogReadingCheckpoint } {
  const current = readIndex(storage)[blogPostId];
  if (!current) return { kind: "fresh" };
  if (now - current.lastActivityAt >= BLOG_READING_IDLE_MS) return { kind: "expired", checkpoint: current };
  return { kind: "resume", checkpoint: current };
}

export function writeBlogReadingCheckpoint(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void },
  blogPostId: string,
  checkpoint: BlogReadingCheckpoint,
): void {
  const index = readIndex(storage);
  index[blogPostId] = checkpoint;
  writeIndex(storage, index);
}

export function clearBlogReadingCheckpoint(
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void },
  blogPostId: string,
): void {
  const index = readIndex(storage);
  delete index[blogPostId];
  writeIndex(storage, index);
}
