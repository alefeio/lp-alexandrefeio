import { mercadoPagoTestConfig } from "@/lib/commerce/config";
import { reaisFromCents } from "@/lib/commerce/analytics";
import type { ProviderPaymentView } from "@/lib/commerce/reconcile";

const CARD_METHODS = new Set(["visa", "master", "amex", "elo", "hipercard", "cabal", "naranja", "maestro"]);

export type ChargeInput = {
  orderId: string;
  idempotencyKey: string;
  amountCents: number;
  description: string;
  paymentMethodId: string;
  token?: string;
  issuerId?: string;
  installments?: number;
  payerEmail: string;
  identificationType?: string;
  identificationNumber?: string;
};

export type ChargeResult =
  | { ok: true; view: ProviderPaymentView; pix: { copy: string; image: string } | null }
  | { ok: false; message: string; view: ProviderPaymentView | null };

export function acceptedMethod(paymentMethodId: string, token?: string): "PIX" | "CREDIT_CARD" | null {
  if (paymentMethodId === "pix") return "PIX";
  if (token && (CARD_METHODS.has(paymentMethodId) || paymentMethodId === "credit_card")) return "CREDIT_CARD";
  return null;
}

export async function createProviderCharge(input: ChargeInput): Promise<ChargeResult> {
  const config = mercadoPagoTestConfig();
  if (!config) return { ok: false, message: "O pagamento de teste não está configurado.", view: null };
  const method = acceptedMethod(input.paymentMethodId, input.token);
  if (!method) return { ok: false, message: "Esta forma de pagamento não está disponível.", view: null };
  if (method === "CREDIT_CARD" && !input.token) return { ok: false, message: "Não foi possível usar este cartão.", view: null };
  const installments = input.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > 3) {
    return { ok: false, message: "O parcelamento máximo neste checkout é de 3 vezes.", view: null };
  }
  const transactionAmount = reaisFromCents(input.amountCents);
  if (Math.round(transactionAmount * 100) !== input.amountCents) {
    return { ok: false, message: "Não foi possível cobrar este valor.", view: null };
  }

  const body: Record<string, unknown> = {
    transaction_amount: transactionAmount,
    description: input.description.slice(0, 180),
    payment_method_id: input.paymentMethodId === "credit_card" ? undefined : input.paymentMethodId,
    installments,
    external_reference: input.orderId,
    payer: {
      email: input.payerEmail,
      ...(input.identificationType && input.identificationNumber
        ? { identification: { type: input.identificationType, number: input.identificationNumber } }
        : {}),
    },
  };
  if (method === "CREDIT_CARD") {
    body.token = input.token;
    if (input.issuerId) body.issuer_id = input.issuerId;
  }
  if (!body.payment_method_id) return { ok: false, message: "Esta forma de pagamento não está disponível.", view: null };

  let response: Response;
  try {
    response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("mercado pago request failed", { name: error instanceof Error ? error.name : "Error" });
    return { ok: false, message: "Não foi possível falar com o Mercado Pago.", view: null };
  }

  const payload = await response.json().catch(() => null);
  const view = readProviderPayment(payload);
  if (!response.ok || !view) {
    console.error("mercado pago charge rejected", { status: response.status, providerStatus: view?.status ?? "unknown" });
    return { ok: false, message: "O pagamento não foi aceito.", view };
  }
  return { ok: true, view, pix: method === "PIX" ? readPix(payload) : null };
}

export async function fetchProviderPayment(providerPaymentId: string): Promise<ProviderPaymentView | null> {
  const config = mercadoPagoTestConfig();
  if (!config) return null;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) {
    console.error("mercado pago lookup failed", { status: response.status });
    return null;
  }
  return readProviderPayment(await response.json().catch(() => null));
}

export async function fetchPixPresentation(providerPaymentId: string): Promise<{ copy: string; image: string } | null> {
  const config = mercadoPagoTestConfig();
  if (!config) return null;
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) return null;
  return readPix(await response.json().catch(() => null));
}

export function readProviderPayment(payload: unknown): ProviderPaymentView | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const id = typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : "";
  const status = typeof row.status === "string" ? row.status : "";
  const amount = typeof row.transaction_amount === "number" ? Math.round(row.transaction_amount * 100) : null;
  const currency = row.currency_id === "BRL" ? "BRL" : "";
  const externalReference = typeof row.external_reference === "string" ? row.external_reference : "";
  if (!id || !status || amount == null || !currency || !externalReference) return null;
  const refundedRaw = typeof row.transaction_amount_refunded === "number" ? Math.round(row.transaction_amount_refunded * 100) : 0;
  return {
    id,
    status,
    statusDetail: typeof row.status_detail === "string" ? row.status_detail.slice(0, 80) : null,
    amountCents: amount,
    currency,
    externalReference,
    paymentTypeId: typeof row.payment_type_id === "string" ? row.payment_type_id : "",
    installments: typeof row.installments === "number" ? row.installments : null,
    refundedCents: refundedRaw,
  };
}

function readPix(payload: unknown): { copy: string; image: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const point = (payload as { point_of_interaction?: { transaction_data?: { qr_code?: unknown; qr_code_base64?: unknown } } }).point_of_interaction;
  const copy = point?.transaction_data?.qr_code;
  const image = point?.transaction_data?.qr_code_base64;
  if (typeof copy !== "string" || typeof image !== "string") return null;
  return { copy, image };
}
