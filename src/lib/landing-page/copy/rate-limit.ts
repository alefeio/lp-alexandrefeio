import { COPY_ASSIST_RATE_LIMIT } from "@/lib/landing-page/copy/config";

/**
 * Limite técnico por instância: 10 gerações por usuário a cada 10 minutos.
 * BEFORE_PUBLIC_RELEASE: substituir por um limitador durável e distribuído.
 * Aceitável enquanto o curso permanece DRAFT.
 */

const hits = new Map<string, number[]>();

export function resetCopyAssistRateLimit(): void {
  hits.clear();
}

export function consumeCopyAssistRateLimit(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < COPY_ASSIST_RATE_LIMIT.windowMs);
  if (recent.length >= COPY_ASSIST_RATE_LIMIT.max) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
