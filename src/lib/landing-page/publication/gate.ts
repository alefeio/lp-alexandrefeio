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

/** O armazenamento ao vivo ainda não passou pelo smoke de upload, leitura e exclusão. */
export const LIVE_MEDIA_STORE_READY = false;
