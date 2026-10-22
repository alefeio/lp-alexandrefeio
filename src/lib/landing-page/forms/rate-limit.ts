import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";
import { LANDING_PAGE_RATE_POLICIES } from "@/lib/landing-page/rate-limit/policies";
import type { DurableRateLimitResult } from "@/lib/landing-page/rate-limit/durable";

/**
 * 5 envios a cada 10 minutos por publicação e visitante.
 * Visitantes diferentes não dividem o mesmo balde. O endereço não é gravado.
 */

const limiter = bindDurableRateLimit();

export function resetLandingPageFormRateLimit(): void {
  limiter.reset();
}

export function landingPageFormRateLimitKey(publicationId: string, abuseKey: string): string {
  return `${publicationId}:${abuseKey}`;
}

export async function consumeLandingPageFormRateLimit(
  input: { publicationId: string; abuseKey: string },
  now = Date.now(),
): Promise<DurableRateLimitResult> {
  return limiter.consume({
    namespace: LANDING_PAGE_RATE_POLICIES.form.namespace,
    key: landingPageFormRateLimitKey(input.publicationId, input.abuseKey),
    limit: LANDING_PAGE_RATE_POLICIES.form.limit,
    windowSeconds: LANDING_PAGE_RATE_POLICIES.form.windowSeconds,
    now,
  });
}
