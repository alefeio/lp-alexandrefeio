export const BLOG_READING_SCHEMA_VERSION = 1;
export const BLOG_READING_IDLE_MS = 30 * 60 * 1000;
export const BLOG_READING_MAX_INCREMENT_MS = 60 * 1000;
export const BLOG_READING_CLOCK_SKEW_MS = 5 * 1000;
export const BLOG_READING_MAX_ACTIVE_MS = 4 * 60 * 60 * 1000;
export const BLOG_READING_MAX_BODY_BYTES = 4096;
export const BLOG_READING_RATE_NAMESPACE = "blog-reading:session";
export const BLOG_READING_ABUSE_NAMESPACE = "blog-reading:abuse";
export const BLOG_READING_RATE_LIMIT = 30;
export const BLOG_READING_ABUSE_LIMIT = 60;
export const BLOG_READING_RATE_WINDOW_SECONDS = 10 * 60;
export const BLOG_READING_RETENTION_MONTHS = 12;
export const BLOG_READING_RETENTION_BATCH = 100;
/** Teto por execução do cron (≈2k sessões). O restante fica para o próximo disparo. */
export const BLOG_READING_RETENTION_MAX_BATCHES = 20;
export const BLOG_READING_COMMIT_ATTEMPTS = 3;

export const BLOG_ENGAGED_MIN_ACTIVE_MS = 30_000;
export const BLOG_ENGAGED_MIN_SCROLL = 50;
export const BLOG_DEEP_MIN_ACTIVE_MS = 60_000;
export const BLOG_DEEP_MIN_SCROLL = 75;

/** Ausente ou qualquer valor diferente de "true" deixa o endpoint sem gravação. */
export function blogReadingIngestEnabled(env?: { BLOG_READING_INGEST_ENABLED?: string }): boolean {
  const source = env ?? { BLOG_READING_INGEST_ENABLED: process.env.BLOG_READING_INGEST_ENABLED };
  return source.BLOG_READING_INGEST_ENABLED === "true";
}
