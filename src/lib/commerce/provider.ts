import { mercadoPagoRuntimeConfig } from "@/lib/commerce/config";
import { reaisFromCents } from "@/lib/commerce/analytics";
import type { ProviderPaymentView } from "@/lib/commerce/reconcile";

const CARD_METHODS = new Set(["visa", "master", "amex", "elo", "hipercard", "cabal", "naranja", "maestro"]);
const ORDERS_URL = "https://api.mercadopago.com/v1/orders";
/** E-mail exigido pela documentação de teste do Checkout Transparente. Não é o e-mail da conta. */
const TEST_PAYER_EMAIL = "test@testuser.com";

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
  const config = mercadoPagoRuntimeConfig();
  if (!config) return { ok: false, message: "O pagamento não está configurado.", view: null };
  const method = acceptedMethod(input.paymentMethodId, input.token);
  if (!method) return { ok: false, message: "Esta forma de pagamento não está disponível.", view: null };
  if (method === "CREDIT_CARD" && !input.token) return { ok: false, message: "Não foi possível usar este cartão.", view: null };
  const installments = input.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > 3) {
    return { ok: false, message: "O parcelamento máximo neste checkout é de 3 vezes.", view: null };
  }
  const amount = reaisFromCents(input.amountCents).toFixed(2);
  if (Math.round(Number(amount) * 100) !== input.amountCents) {
    return { ok: false, message: "Não foi possível cobrar este valor.", view: null };
  }

  const paymentMethod =
    method === "PIX"
      ? { id: "pix", type: "bank_transfer" }
      : {
          id: input.paymentMethodId,
          type: "credit_card",
          token: input.token,
          installments,
        };
  const body = {
    type: "online",
    processing_mode: "automatic",
    total_amount: amount,
    external_reference: input.orderId,
    description: input.description.slice(0, 180),
    payer: {
      email: config.env === "test" ? TEST_PAYER_EMAIL : input.payerEmail,
      ...(input.identificationType && input.identificationNumber
        ? { identification: { type: input.identificationType, number: input.identificationNumber } }
        : {}),
    },
    transactions: { payments: [{ amount, payment_method: paymentMethod }] },
  };

  let response: Response;
  try {
    response = await fetch(ORDERS_URL, {
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
  if (!view) {
    console.error("mercado pago charge rejected", { status: response.status, providerStatus: safeErrorCode(payload) });
    return { ok: false, message: "O pagamento não foi aceito.", view: null };
  }
  if (!response.ok) {
    console.error("mercado pago charge rejected", { status: response.status, providerStatus: view.status });
    return { ok: false, message: "O pagamento não foi aceito.", view };
  }
  return { ok: true, view, pix: method === "PIX" ? readPix(payload) : null };
}

export async function fetchProviderPayment(providerPaymentId: string): Promise<ProviderPaymentView | null> {
  const config = mercadoPagoRuntimeConfig();
  if (!config) return null;
  const response = await fetch(`${ORDERS_URL}/${encodeURIComponent(providerPaymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) {
    console.error("mercado pago lookup failed", { status: response.status });
    return null;
  }
  return readProviderPayment(await response.json().catch(() => null));
}

export async function fetchPixPresentation(providerPaymentId: string): Promise<{ copy: string; image: string } | null> {
  const config = mercadoPagoRuntimeConfig();
  if (!config) return null;
  const response = await fetch(`${ORDERS_URL}/${encodeURIComponent(providerPaymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) return null;
  return readPix(await response.json().catch(() => null));
}

export function readProviderPayment(payload: unknown): ProviderPaymentView | null {
  const row = unwrapOrder(payload);
  if (!row) return null;
  const id = typeof row.id === "string" ? row.id : "";
  const externalReference = typeof row.external_reference === "string" ? row.external_reference : "";
  const payment = firstPayment(row);
  const amountCents = centsFrom(payment?.amount ?? row.total_amount);
  const totalCents = centsFrom(row.total_amount);
  if (!id || !externalReference || amountCents == null || (totalCents != null && totalCents !== amountCents)) return null;
  const currency = row.currency_id === "BRL" || row.currency === "BRL" || row.country_code === "BRA" ? "BRL" : "";
  if (!currency) return null;
  const rawStatus = typeof payment?.status === "string" ? payment.status : typeof row.status === "string" ? row.status : "";
  const rawDetail = typeof payment?.status_detail === "string" ? payment.status_detail : typeof row.status_detail === "string" ? row.status_detail : null;
  const method = payment?.payment_method;
  return {
    id,
    status: legacyStatus(rawStatus, rawDetail),
    statusDetail: rawDetail ? rawDetail.slice(0, 80) : null,
    amountCents,
    currency,
    externalReference,
    paymentTypeId: typeof method?.type === "string" ? method.type : "",
    installments: typeof method?.installments === "number" ? method.installments : null,
    refundedCents: rawStatus === "refunded" ? amountCents : 0,
  };
}

export function readPix(payload: unknown): { copy: string; image: string } | null {
  const row = unwrapOrder(payload);
  if (!row) return null;
  const method = firstPayment(row)?.payment_method;
  const copy = method?.qr_code;
  const image = method?.qr_code_base64;
  if (typeof copy !== "string" || typeof image !== "string" || !copy || !image) return null;
  return { copy, image };
}

function firstPayment(row: Record<string, unknown>): {
  amount?: unknown;
  status?: unknown;
  status_detail?: unknown;
  payment_method?: { type?: unknown; installments?: unknown; qr_code?: unknown; qr_code_base64?: unknown };
} | null {
  const transactions = row.transactions;
  if (!transactions || typeof transactions !== "object" || !("payments" in transactions)) return null;
  const payments = (transactions as { payments?: unknown }).payments;
  const payment = Array.isArray(payments) ? payments[0] : null;
  if (!payment || typeof payment !== "object") return null;
  return payment as {
    amount?: unknown;
    status?: unknown;
    status_detail?: unknown;
    payment_method?: { type?: unknown; installments?: unknown; qr_code?: unknown; qr_code_base64?: unknown };
  };
}

/** A Orders API devolve a order em `data` quando a transação falha com HTTP 402. */
function unwrapOrder(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const data = row.data;
  if (data && typeof data === "object" && !Array.isArray(data) && typeof (data as Record<string, unknown>).id === "string") {
    return data as Record<string, unknown>;
  }
  return row;
}

function centsFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Math.round(value * 100);
    return Math.abs(value * 100 - cents) < 0.001 ? cents : null;
  }
  if (typeof value === "string" && /^\d+\.\d{2}$/.test(value)) return Math.round(Number(value) * 100);
  return null;
}

/** Traduz o status da Orders API para a regra única de reconciliação. */
function legacyStatus(status: string, detail: string | null): string {
  if (status === "processed" && detail === "accredited") return "approved";
  if (status === "processed" && detail === "partially_refunded") return "partially_refunded";
  if (status === "failed") return "rejected";
  if (status === "canceled" || status === "expired") return "cancelled";
  if (status === "refunded") return "refunded";
  if (status === "charged_back" && detail === "settled") return "charged_back";
  if (status === "charged_back") return "in_mediation";
  if (status === "action_required" || status === "created") return "pending";
  if (status === "processing" || status === "in_review") return "in_process";
  return status;
}

function safeErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "unknown";
  const row = payload as { message?: unknown; error?: unknown; errors?: { code?: unknown }[] };
  const nested = row.errors?.[0]?.code;
  const code = typeof nested === "string" ? nested : typeof row.error === "string" ? row.error : typeof row.message === "string" ? row.message : "unknown";
  return code.length > 80 ? "long_error" : code;
}
