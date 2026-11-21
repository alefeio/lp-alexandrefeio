/**
 * Credenciais exclusivas para sandbox Payments API.
 * Nunca faz fallback para MERCADO_PAGO_ACCESS_TOKEN (pode ser Production).
 */

export const TEST_CREDENTIAL_SOURCE_CONFIRMATION = "developers_test_credentials";

export type SandboxTokenResolution =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/** Resolve Access Token de teste — sem fallback para o token genérico. */
export function resolveMercadoPagoTestAccessToken(
  env: Record<string, string | undefined> = process.env,
): SandboxTokenResolution {
  if ((env.MERCADO_PAGO_ENV ?? "").trim().toLowerCase() === "production") {
    return { ok: false, reason: "MERCADO_PAGO_ENV=production bloqueia sandbox." };
  }
  if ((env.VERCEL_ENV ?? "").trim().toLowerCase() === "production") {
    return { ok: false, reason: "VERCEL_ENV=production bloqueia sandbox." };
  }
  if (env.COMMERCE_PRODUCTION_READY === "true") {
    return { ok: false, reason: "COMMERCE_PRODUCTION_READY=true bloqueia sandbox." };
  }
  if ((env.MERCADO_PAGO_ENV ?? "").trim() !== "test") {
    return { ok: false, reason: "MERCADO_PAGO_ENV deve ser test." };
  }

  const source = (env.MERCADO_PAGO_TEST_CREDENTIAL_SOURCE ?? "").trim();
  if (source !== TEST_CREDENTIAL_SOURCE_CONFIRMATION) {
    return {
      ok: false,
      reason:
        "Confirme origem: MERCADO_PAGO_TEST_CREDENTIAL_SOURCE=developers_test_credentials (painel → Credenciais de teste).",
    };
  }

  const testToken = (env.MERCADO_PAGO_TEST_ACCESS_TOKEN ?? "").trim().replace(/^["']|["']$/g, "");
  if (!testToken) {
    return { ok: false, reason: "MERCADO_PAGO_TEST_ACCESS_TOKEN ausente." };
  }
  if (!testToken.startsWith("APP_USR")) {
    return { ok: false, reason: "MERCADO_PAGO_TEST_ACCESS_TOKEN com formato inesperado." };
  }

  const generic = (env.MERCADO_PAGO_ACCESS_TOKEN ?? "").trim().replace(/^["']|["']$/g, "");
  if (generic && generic === testToken) {
    return {
      ok: false,
      reason: "Token de teste idêntico a MERCADO_PAGO_ACCESS_TOKEN — recusado (risco de Production).",
    };
  }

  return { ok: true, token: testToken };
}

export type SandboxPreflightResult =
  | { ok: true; siteId: string | null }
  | { ok: false; reason: string; httpStatus: number | null };

/**
 * Preflight read-only (GET /users/me) antes de qualquer POST de cobrança.
 * Não imprime o token.
 */
export async function preflightMercadoPagoTestToken(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SandboxPreflightResult> {
  let response: Response;
  try {
    response = await fetchImpl("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, reason: "Falha de rede no preflight /users/me.", httpStatus: null };
  }
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const message =
      payload && typeof payload.message === "string" ? payload.message.slice(0, 120) : "unauthorized";
    return { ok: false, reason: `Preflight HTTP ${response.status}: ${message}`, httpStatus: response.status };
  }
  if (!payload || payload.id == null) {
    return { ok: false, reason: "Preflight sem identidade de usuário.", httpStatus: response.status };
  }
  return {
    ok: true,
    siteId: typeof payload.site_id === "string" ? payload.site_id : null,
  };
}
