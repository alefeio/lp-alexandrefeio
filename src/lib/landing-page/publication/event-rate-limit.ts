import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";
import { LANDING_PAGE_RATE_POLICIES } from "@/lib/landing-page/rate-limit/policies";
import type { DurableRateLimitResult } from "@/lib/landing-page/rate-limit/durable";

/**
 * Proteção frouxa contra flood de PAGE_VIEW, CTA, WhatsApp e início de formulário.
 * Estourar o limite descarta o evento. Não impede o clique nem o envio.
 */

const limiter = bindDurableRateLimit();

export function resetLandingPagePublicEventRateLimit(): void {
  limiter.reset();
}

export async function consumeLandingPagePublicEventRateLimit(
  input: { publicationId: string; abuseKey: string },
  now = Date.now(),
): Promise<DurableRateLimitResult> {
  return limiter.consume({
    namespace: LANDING_PAGE_RATE_POLICIES.publicEvent.namespace,
    key: `${input.publicationId}:${input.abuseKey}`,
    limit: LANDING_PAGE_RATE_POLICIES.publicEvent.limit,
    windowSeconds: LANDING_PAGE_RATE_POLICIES.publicEvent.windowSeconds,
    now,
  });
}
