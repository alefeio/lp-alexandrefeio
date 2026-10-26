import type { DurableRateLimitResult } from "@/lib/landing-page/rate-limit/durable";
import { parseJourneyEvent, type JourneyEventRecord } from "@/lib/product-journey/schema";

export const JOURNEY_MAX_BODY_BYTES = 4096;
export const JOURNEY_RATE_NAMESPACE = "product-journey:event";
export const JOURNEY_RATE_LIMIT = 120;
export const JOURNEY_RATE_WINDOW_SECONDS = 10 * 60;

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export type JourneyInsert = JourneyEventRecord & { userId: string | null; occurredAt: Date };

export function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function json(status: number): Response {
  return Response.json({ ok: status < 300 }, { status, headers: NO_STORE });
}

export async function handleProductJourneyRequest(
  request: Request,
  deps: {
    now?: number;
    userId?: string | null;
    consume: (key: string, now: number) => Promise<DurableRateLimitResult>;
    insert: (row: JourneyInsert) => Promise<void>;
  },
): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) return json(415);
  const text = await request.text();
  if (text.length > JOURNEY_MAX_BODY_BYTES) return json(413);
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return json(400);
  }
  const now = deps.now ?? Date.now();
  const parsed = parseJourneyEvent(payload, now);
  if (!parsed.ok) return json(400);
  const key = deps.userId ? `user:${deps.userId}` : `anon:${parsed.value.anonymousId}`;
  const limit = await deps.consume(key, now);
  if (!limit.allowed) return json(429);
  try {
    await deps.insert({ ...parsed.value, userId: deps.userId ?? null, occurredAt: new Date(now) });
    return json(202);
  } catch (error) {
    if (isUniqueConstraint(error)) return json(200);
    return json(500);
  }
}
