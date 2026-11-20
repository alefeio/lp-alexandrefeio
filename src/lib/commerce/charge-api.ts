/**
 * Seleção explícita do mecanismo de cobrança Pix.
 * Cartão permanece sempre na Orders API.
 * A escolha fica persistida em Payment.providerApiKind no claim — sem troca automática depois.
 */

export type ChargeApiKind = "orders" | "payments";

export const CHARGE_API_ORDERS: ChargeApiKind = "orders";
export const CHARGE_API_PAYMENTS: ChargeApiKind = "payments";

/** Env: MERCADO_PAGO_PIX_CHARGE_API=orders|payments. Default seguro: orders (comportamento pré-P0.1.4). */
export function resolvePixChargeApiKind(
  env: Record<string, string | undefined> = process.env,
): ChargeApiKind {
  const raw = (env.MERCADO_PAGO_PIX_CHARGE_API ?? "").trim().toLowerCase();
  if (raw === "payments") return CHARGE_API_PAYMENTS;
  return CHARGE_API_ORDERS;
}

export function resolveChargeApiKindForMethod(
  method: "PIX" | "CREDIT_CARD",
  env: Record<string, string | undefined> = process.env,
): ChargeApiKind {
  if (method === "CREDIT_CARD") return CHARGE_API_ORDERS;
  return resolvePixChargeApiKind(env);
}

export function isChargeApiKind(value: unknown): value is ChargeApiKind {
  return value === "orders" || value === "payments";
}

/** Para linhas legadas sem providerApiKind: só Orders era usado. */
export function legacyChargeApiKind(): ChargeApiKind {
  return CHARGE_API_ORDERS;
}
