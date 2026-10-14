/**
 * Comércio desta sprint só abre em development, com a flag ligada e com
 * MERCADO_PAGO_ENV=test. O prefixo da chave não decide o ambiente: no
 * Checkout Transparente via Orders, a credencial de teste também pode
 * começar com APP_USR. A referência é a seção Credenciais de teste do
 * painel, declarada aqui por MERCADO_PAGO_ENV.
 */
export function isCommerceEnabled(): boolean {
  return mercadoPagoTestConfig() != null;
}

/** Compra só aparece com comércio ligado e produto AVAILABLE. */
export function isProductForSale(
  status: "NOT_FOR_SALE" | "AVAILABLE",
  priceCents: number | null,
  enabled = isCommerceEnabled(),
): boolean {
  return enabled && status === "AVAILABLE" && priceCents != null && priceCents > 0;
}

export type MercadoPagoTestConfig = {
  publicKey: string;
  accessToken: string;
  webhookSecret: string;
  env: "test";
};

/** Access token e segredo do webhook não saem desta função para o browser. */
export function mercadoPagoTestConfig(): MercadoPagoTestConfig | null {
  if (process.env.VERCEL_ENV === "production" || process.env.DATABASE_ENV !== "development") return null;
  if (process.env.MERCADO_PAGO_ENV?.trim() !== "test") return null;
  if (process.env.COMMERCE_ENABLED !== "true") return null;
  const publicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() ?? "";
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "";
  if (!publicKey || !accessToken || webhookSecret.length < 8) return null;
  return { publicKey, accessToken, webhookSecret, env: "test" };
}

export function mercadoPagoPublicKey(): string | null {
  return mercadoPagoTestConfig()?.publicKey ?? null;
}
