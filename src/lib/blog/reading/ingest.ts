import type { DurableRateLimitResult } from "@/lib/landing-page/rate-limit/durable";
import { BLOG_READING_COMMIT_ATTEMPTS, BLOG_READING_MAX_BODY_BYTES } from "@/lib/blog/reading/constants";
import { decideBlogReading, type BlogClickRecord, type BlogReadingRecord } from "@/lib/blog/reading/lifecycle";
import { isBlogReadingPrefetch, parseBlogReading, type BlogReadingCommand } from "@/lib/blog/reading/schema";

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export class BlogReadingConflict extends Error {}

export type BlogReadingCommit = {
  kind: "create" | "update" | "seal";
  session: BlogReadingRecord;
  click: BlogClickRecord | null;
};

export type BlogReadingCommitResult = "applied" | "stale" | "click-conflict";

export type BlogReadingStore = {
  findSession(clientReadingId: string): Promise<BlogReadingRecord | null>;
  findClick(eventId: string): Promise<{ readingSessionId: string } | null>;
  commit(input: BlogReadingCommit): Promise<BlogReadingCommitResult>;
};

export type PublishedBlogPost = { id: string; slug: string };

function json(status: number): Response {
  if (status === 204) return new Response(null, { status: 204, headers: NO_STORE });
  return Response.json({ ok: status < 300 }, { status, headers: NO_STORE });
}

/**
 * clientReadingId deduplica a sessão. Não prova que o navegador é dono dela.
 * recordVersion é a trava otimista: gravar exige a versão lida, e tempo, profundidade e final não regridem.
 * Conflito de versão relê a linha e reavalia o mesmo comando. A cota continua valendo para o retry deduplicado.
 */
export async function handleBlogReadingRequest(
  request: Request,
  deps: {
    enabled: boolean;
    now?: number;
    consumeIdentity: (anonymousId: string, now: number) => Promise<DurableRateLimitResult>;
    consumeAbuse: (now: number) => Promise<DurableRateLimitResult>;
    findPublished: (id: string) => Promise<PublishedBlogPost | null>;
    store: BlogReadingStore;
    nextId?: () => string;
  },
): Promise<Response> {
  if (isBlogReadingPrefetch(request.headers)) return json(204);
  if (!deps.enabled) return json(404);
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return json(415);
  const text = await request.text();
  if (text.length > BLOG_READING_MAX_BODY_BYTES) return json(413);
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return json(400);
  }
  const now = deps.now ?? Date.now();
  const parsed = parseBlogReading(payload, now);
  if (!parsed.ok) return json(400);
  const abuse = await deps.consumeAbuse(now);
  if (!abuse.allowed) return json(429);
  const identity = await deps.consumeIdentity(parsed.value.anonymousId, now);
  if (!identity.allowed) return json(429);
  const nextId = deps.nextId ?? (() => crypto.randomUUID());
  return applyCommand(parsed.value, now, deps, nextId);
}

async function applyCommand(
  command: BlogReadingCommand,
  now: number,
  deps: {
    findPublished: (id: string) => Promise<PublishedBlogPost | null>;
    store: BlogReadingStore;
  },
  nextId: () => string,
): Promise<Response> {
  for (let attempt = 0; attempt < BLOG_READING_COMMIT_ATTEMPTS; attempt += 1) {
    const existing = await deps.store.findSession(command.clientReadingId);
    const published = existing ? null : await deps.findPublished(command.blogPostId);
    const existingClick = command.click ? await deps.store.findClick(command.click.eventId) : null;
    const decision = decideBlogReading({ now, command, existing, published, existingClick, nextId });
    if (decision.kind === "noop") return json(200);
    if (decision.kind === "reject") return json(decision.status);
    try {
      const result = await deps.store.commit({
        kind: decision.kind === "seal" ? "seal" : decision.created ? "create" : "update",
        session: decision.session,
        click: decision.kind === "write" ? decision.click : null,
      });
      if (result === "stale" || result === "click-conflict") continue;
      return json(decision.kind === "seal" ? 409 : 202);
    } catch (error) {
      if (error instanceof BlogReadingConflict) continue;
      if (attempt + 1 < BLOG_READING_COMMIT_ATTEMPTS) continue;
      return json(500);
    }
  }
  return json(409);
}
