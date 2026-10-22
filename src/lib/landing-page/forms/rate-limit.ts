/**
 * Limite técnico por instância: 5 envios por projeto a cada 10 minutos.
 * A chave é o projeto, não o IP. O IP não é persistido no lead.
 * BEFORE_PUBLIC_RELEASE: substituir por um limitador durável e distribuído.
 * Aceitável enquanto o curso permanece DRAFT e não há rota pública.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS = 5;
const hits = new Map<string, number[]>();

export function resetLandingPageFormRateLimit(): void {
  hits.clear();
}

export function consumeLandingPageFormRateLimit(projectId: string, now = Date.now()): boolean {
  const recent = (hits.get(projectId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_SUBMISSIONS) {
    hits.set(projectId, recent);
    return false;
  }
  recent.push(now);
  hits.set(projectId, recent);
  return true;
}
