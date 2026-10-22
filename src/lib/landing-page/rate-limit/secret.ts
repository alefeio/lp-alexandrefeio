const MIN_SECRET_LENGTH = 32;

/**
 * Segredo só de servidor. Sem valor padrão e sem prefixo público.
 * Ausente ou curto demais: a proteção pública não liga.
 */
export function landingPageRateLimitSecret(env?: { LANDING_PAGE_RATE_LIMIT_SECRET?: string }): string | null {
  const source = env ?? (process.env as Record<string, string | undefined>);
  const value = (source.LANDING_PAGE_RATE_LIMIT_SECRET ?? "").trim();
  if (value.length < MIN_SECRET_LENGTH) return null;
  return value;
}
