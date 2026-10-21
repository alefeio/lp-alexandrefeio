import { LANDING_PAGE_MEDIA_LIMITS } from "@/lib/landing-page/media/limits";

/**
 * Limite técnico por instância: 20 inícios de upload por usuário a cada 10 minutos.
 * BEFORE_PUBLIC_RELEASE: substituir por um limitador durável. Aceitável enquanto o curso permanece DRAFT.
 * Uploads abandonados não têm cron. `expireAbandonedLandingPageUploads` marca UPLOADING antigo como FAILED.
 */

const hits = new Map<string, number[]>();

export function resetLandingPageMediaRateLimit(): void {
  hits.clear();
}

export function consumeLandingPageMediaRateLimit(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < LANDING_PAGE_MEDIA_LIMITS.uploadWindowMs);
  if (recent.length >= LANDING_PAGE_MEDIA_LIMITS.uploadMaxPerWindow) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
