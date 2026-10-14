/**
 * O comércio só abre com uma combinação explícita de ambiente.
 * O prefixo da credencial não decide nada: teste e produção usam
 * variáveis do próprio ambiente e não são copiadas entre si.
 */
export type CommerceMode = "test" | "production";

export type MercadoPagoRuntimeConfig = {
  publicKey: string;
  accessToken: string;
  webhookSecret: string;
  env: CommerceMode;
};

type Env = Record<string, string | undefined>;

function read(env: Env) {
  return {
    commerce: env.COMMERCE_ENABLED === "true",
    ready: env.COMMERCE_PRODUCTION_READY === "true",
    mercadoPago: env.MERCADO_PAGO_ENV?.trim() ?? "",
    database: env.DATABASE_ENV?.trim() ?? "",
    vercel: env.VERCEL_ENV?.trim() ?? "",
    publicKey: env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() ?? "",
    accessToken: env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "",
    webhookSecret: env.MERCADO_PAGO_WEBHOOK_SECRET?.trim() ?? "",
  };
}

function credentialsPresent(input: ReturnType<typeof read>): boolean {
  return Boolean(input.publicKey && input.accessToken && input.webhookSecret.length >= 8);
}

/** Teste só em development, fora da Vercel de production, com a flag de produção desligada. */
export function mercadoPagoTestConfig(env: Env = process.env): MercadoPagoRuntimeConfig | null {
  const input = read(env);
  if (!input.commerce || input.ready) return null;
  if (input.mercadoPago !== "test" || input.database !== "development" || input.vercel === "production") return null;
  if (!credentialsPresent(input)) return null;
  return { publicKey: input.publicKey, accessToken: input.accessToken, webhookSecret: input.webhookSecret, env: "test" };
}

/** Produção exige as cinco travas e credencial do ambiente de production. */
export function mercadoPagoProductionConfig(env: Env = process.env): MercadoPagoRuntimeConfig | null {
  const input = read(env);
  if (!input.commerce || !input.ready) return null;
  if (input.mercadoPago !== "production" || input.database !== "production" || input.vercel !== "production") return null;
  if (!credentialsPresent(input)) return null;
  return { publicKey: input.publicKey, accessToken: input.accessToken, webhookSecret: input.webhookSecret, env: "production" };
}

export function mercadoPagoRuntimeConfig(env: Env = process.env): MercadoPagoRuntimeConfig | null {
  return mercadoPagoProductionConfig(env) ?? mercadoPagoTestConfig(env);
}

export function isCommerceEnabled(env: Env = process.env): boolean {
  return mercadoPagoRuntimeConfig(env) != null;
}

export function mercadoPagoPublicKey(env: Env = process.env): string | null {
  return mercadoPagoRuntimeConfig(env)?.publicKey ?? null;
}

/** Teste aceita só live_mode=false. Produção aceita só live_mode=true. Ausência não passa. */
export function webhookLiveModeAllowed(mode: CommerceMode, liveMode: unknown): boolean {
  if (mode === "test") return liveMode === false;
  return liveMode === true;
}

/** Compra só aparece com comércio ligado e produto AVAILABLE. */
export function isProductForSale(
  status: "NOT_FOR_SALE" | "AVAILABLE",
  priceCents: number | null,
  enabled = isCommerceEnabled(),
): boolean {
  return enabled && status === "AVAILABLE" && priceCents != null && priceCents > 0;
}
