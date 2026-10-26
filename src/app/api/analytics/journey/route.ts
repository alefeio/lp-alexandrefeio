import { getSession } from "@/lib/auth/session";
import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";
import { handleProductJourneyRequest, JOURNEY_RATE_LIMIT, JOURNEY_RATE_NAMESPACE, JOURNEY_RATE_WINDOW_SECONDS } from "@/lib/product-journey/ingest";
import { insertJourneyEvent } from "@/lib/product-journey/repository";

export const dynamic = "force-dynamic";

const limiter = bindDurableRateLimit();

export function POST(request: Request) {
  return getSession()
    .then((session) =>
      handleProductJourneyRequest(request, {
        userId: session?.user.id ?? null,
        consume: (key, now) =>
          limiter.consume({
            namespace: JOURNEY_RATE_NAMESPACE,
            key,
            limit: JOURNEY_RATE_LIMIT,
            windowSeconds: JOURNEY_RATE_WINDOW_SECONDS,
            now,
          }),
        insert: insertJourneyEvent,
      }),
    )
    .catch(() => Response.json({ ok: false }, { status: 500, headers: { "cache-control": "no-store" } }));
}
