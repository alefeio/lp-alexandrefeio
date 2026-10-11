/** Comércio fechado salvo COMMERCE_ENABLED=true. Production não liga nesta sprint. */
export function isCommerceEnabled(): boolean {
  if (process.env.VERCEL_ENV === "production" || process.env.DATABASE_ENV === "production") return false;
  return process.env.COMMERCE_ENABLED === "true";
}

export type MercadoPagoTestConfig = {
  publicKey: string;
  accessToken: string;
  webhookSecret: string;
  env: "test";
};

/**
 * Só aceita credenciais de teste. Chave produtiva não entra nesta sprint.
 * Access token e segredo do webhook não saem desta função para o browser.
 */
export function mercadoPagoTestConfig(): MercadoPagoTestConfig | null {
  if (process.env.MERCADO_PAGO_ENV?.trim() !== "test") return null;
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() ?? "";
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";
  if (!publicKey.startsWith("TEST-") || !accessToken.startsWith("TEST-") || webhookSecret.length < 8) return null;
  return { publicKey, accessToken, webhookSecret, env: "test" };
}

export function mercadoPagoPublicKey(): string | null {
  return mercadoPagoTestConfig()?.publicKey ?? null;
}
