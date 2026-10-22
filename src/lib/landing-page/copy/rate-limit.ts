import { COPY_ASSIST_RATE_LIMIT } from "@/lib/landing-page/copy/config";
import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";
import { LANDING_PAGE_RATE_POLICIES } from "@/lib/landing-page/rate-limit/policies";

/**
 * 10 gerações por usuário autenticado a cada 10 minutos.
 * A chave é o usuário, não o endereço. Em produção o balde fica no Postgres.
 */

const limiter = bindDurableRateLimit();

export function resetCopyAssistRateLimit(): void {
  limiter.reset();
}

export async function consumeCopyAssistRateLimit(userId: string, now = Date.now()): Promise<boolean> {
  const decision = await limiter.consume({
    namespace: LANDING_PAGE_RATE_POLICIES.copy.namespace,
    key: userId,
    limit: COPY_ASSIST_RATE_LIMIT.max,
    windowSeconds: LANDING_PAGE_RATE_POLICIES.copy.windowSeconds,
    now,
  });
  return decision.allowed;
}
