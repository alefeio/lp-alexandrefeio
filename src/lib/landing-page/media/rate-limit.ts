import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";
import { LANDING_PAGE_RATE_POLICIES } from "@/lib/landing-page/rate-limit/policies";

/**
 * 20 inícios de upload por usuário autenticado a cada 10 minutos.
 * Em produção o balde fica no Postgres.
 */

const limiter = bindDurableRateLimit();

export function resetLandingPageMediaRateLimit(): void {
  limiter.reset();
}

export async function consumeLandingPageMediaRateLimit(userId: string, now = Date.now()): Promise<boolean> {
  const decision = await limiter.consume({
    namespace: LANDING_PAGE_RATE_POLICIES.mediaUpload.namespace,
    key: userId,
    limit: LANDING_PAGE_RATE_POLICIES.mediaUpload.limit,
    windowSeconds: LANDING_PAGE_RATE_POLICIES.mediaUpload.windowSeconds,
    now,
  });
  return decision.allowed;
}
