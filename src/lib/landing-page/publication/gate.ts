import { landingPageRateLimitSecret } from "@/lib/landing-page/rate-limit/secret";

type RuntimeEnv = {
  NODE_ENV?: string;
  LANDING_PAGE_PUBLIC_RUNTIME_ENABLED?: string;
  LANDING_PAGE_RATE_LIMIT_SECRET?: string;
};

/**
 * Liga o runtime público. Não usar prefixo NEXT_PUBLIC.
 * Qualquer valor diferente de "true" deixa a rota no escuro, inclusive em produção sem a variável.
 * O núcleo de publicação pode gravar a versão. A rota /p só responde com a variável ligada.
 */
export function landingPagePublicRuntimeEnabled(env?: { LANDING_PAGE_PUBLIC_RUNTIME_ENABLED?: string }): boolean {
  const runtime = process.env as Record<string, string | undefined>;
  const value = env?.LANDING_PAGE_PUBLIC_RUNTIME_ENABLED ?? runtime.LANDING_PAGE_PUBLIC_RUNTIME_ENABLED;
  return value === "true";
}

/**
 * Em produção a rota continua no escuro sem o segredo do limitador.
 * Fora de produção o flag sozinho ainda permite o smoke isolado.
 */
export function landingPagePublicRouteEnabled(env?: RuntimeEnv): boolean {
  if (!landingPagePublicRuntimeEnabled(env)) return false;
  const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV;
  if (nodeEnv !== "production") return true;
  return landingPageRateLimitSecret(env) !== null;
}

/** O ciclo sintético de upload, leitura, exclusão e leitura 404 foi confirmado. Não liga o runtime público. */
export const LIVE_MEDIA_STORE_READY = true;
