/**
 * Adaptador Pix via Payments API oficial (POST/GET /v1/payments).
 * Independente da Orders API usada pelo cartão.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
 */
import { mercadoPagoRuntimeConfig } from "@/lib/commerce/config";
import { reaisFromCents } from "@/lib/commerce/analytics";
import {
  classifyProviderChargeFailure,
  extractProviderChargeDiagnostics,
  isAllowedMercadoPagoTicketUrl,
  sanitizeProviderDiagnosticToken,
  type ChargeInput,
  type ChargeResult,
  type PixPresentation,
} from "@/lib/commerce/provider";
import type { ProviderPaymentView } from "@/lib/commerce/reconcile";

const PAYMENTS_URL = "https://api.mercadopago.com/v1/payments";
const TEST_PAYER_EMAIL = "test@testuser.com";

export async function createPixViaPaymentsApi(input: ChargeInput): Promise<ChargeResult> {
  const config = mercadoPagoRuntimeConfig();
  if (!config) return { ok: false, kind: "rejected", message: "O pagamento não está configurado.", view: null };

  const amount = reaisFromCents(input.amountCents);
  if (Math.round(amount * 100) !== input.amountCents) {
    return { ok: false, kind: "rejected", message: "Não foi possível cobrar este valor.", view: null };
  }

  const body: Record<string, unknown> = {
    transaction_amount: amount,
    description: input.description.slice(0, 180),
    payment_method_id: "pix",
    external_reference: input.orderId,
    payer: {
      email: config.env === "test" ? TEST_PAYER_EMAIL : input.payerEmail,
      ...(input.identificationType && input.identificationNumber
        ? { identification: { type: input.identificationType, number: input.identificationNumber } }
        : {}),
    },
  };

  const notificationUrl = process.env.MERCADO_PAGO_NOTIFICATION_URL?.trim();
  if (notificationUrl) body.notification_url = notificationUrl;

  let response: Response;
  try {
    response = await fetch(PAYMENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("mercado pago payments request failed", { name: error instanceof Error ? error.name : "Error" });
    return {
      ok: false,
      kind: "unknown",
      message: "Não foi possível confirmar o pagamento com o Mercado Pago. Consulte o pedido antes de tentar de novo.",
      view: null,
    };
  }

  const payload = await response.json().catch(() => null);
  const view = readProviderPaymentFromPayments(payload);
  const pix = readPixFromPayments(payload);

  if ((response.ok || response.status === 201) && view) {
    return { ok: true, kind: "accepted", view, pix };
  }

  const diagnostics = extractProviderChargeDiagnostics({
    httpStatus: response.status,
    payload,
    view,
    method: "PIX",
    correlationId: input.orderId,
  });
  const failureKind = classifyProviderChargeFailure({
    httpStatus: response.status,
    view,
    remoteOrderIdPresent: diagnostics.remoteOrderIdPresent,
  });
  console.error("mercado pago payments charge inconclusive_or_rejected", {
    status: diagnostics.httpStatus,
    kind: failureKind,
    errorCode: diagnostics.errorCode,
    providerStatus: diagnostics.providerStatus ?? view?.status ?? null,
    statusDetail: diagnostics.statusDetail,
    method: "PIX",
    remoteOrderIdPresent: diagnostics.remoteOrderIdPresent,
    correlationId: diagnostics.correlationId,
    api: "payments",
  });
  if (failureKind === "unknown") {
    return {
      ok: false,
      kind: "unknown",
      message:
        "Há uma cobrança em verificação. Abra o pedido em Minhas compras ou fale com o suporte. Não inicie outro pagamento agora.",
      view,
    };
  }
  return {
    ok: false,
    kind: "rejected",
    message: "O provedor não concluiu esta cobrança Pix. Você pode tentar de novo se o pedido ainda estiver aberto.",
    view,
  };
}

export async function fetchPaymentById(providerPaymentId: string): Promise<{
  view: ProviderPaymentView | null;
  pix: PixPresentation | null;
}> {
  const config = mercadoPagoRuntimeConfig();
  if (!config) return { view: null, pix: null };
  const response = await fetch(`${PAYMENTS_URL}/${encodeURIComponent(providerPaymentId)}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) {
    console.error("mercado pago payments lookup failed", { status: response.status });
    return { view: null, pix: null };
  }
  const payload = await response.json().catch(() => null);
  return {
    view: readProviderPaymentFromPayments(payload),
    pix: readPixFromPayments(payload),
  };
}

export function readProviderPaymentFromPayments(payload: unknown): ProviderPaymentView | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const idRaw = row.id;
  const id = typeof idRaw === "number" && Number.isFinite(idRaw) ? String(idRaw) : typeof idRaw === "string" ? idRaw : "";
  const externalReference = typeof row.external_reference === "string" ? row.external_reference : "";
  const amountCents = centsFromNumber(row.transaction_amount);
  if (!id || !externalReference || amountCents == null) return null;
  if (row.currency_id !== "BRL") return null;
  const status = typeof row.status === "string" ? row.status : "";
  const statusDetail = typeof row.status_detail === "string" ? row.status_detail.slice(0, 80) : null;
  const refundedCents = centsFromNumber(row.transaction_amount_refunded) ?? 0;
  // Sem presumir bank_transfer: só classifica Pix com evidência explícita.
  const paymentTypeId = resolvePaymentsPaymentTypeId(row);
  return {
    id,
    status: normalizePaymentsStatus(status),
    statusDetail: statusDetail ? sanitizeProviderDiagnosticToken(statusDetail, 80) : null,
    amountCents,
    currency: "BRL",
    externalReference,
    paymentTypeId,
    installments: typeof row.installments === "number" ? row.installments : 1,
    refundedCents,
  };
}

/**
 * Evidência Pix: payment_type_id, payment_method_id=pix ou point_of_interaction PIX/qr.
 * Ausência → string vazia (reconciliação não concede entitlement).
 */
export function resolvePaymentsPaymentTypeId(row: Record<string, unknown>): string {
  if (typeof row.payment_type_id === "string" && row.payment_type_id.trim()) {
    return row.payment_type_id.trim();
  }
  if (typeof row.payment_method_id === "string" && row.payment_method_id.trim().toLowerCase() === "pix") {
    return "pix";
  }
  const poi = row.point_of_interaction;
  if (poi && typeof poi === "object") {
    const poiRow = poi as Record<string, unknown>;
    if (typeof poiRow.type === "string" && poiRow.type.toUpperCase() === "PIX") {
      return "pix";
    }
    const tx = poiRow.transaction_data;
    if (tx && typeof tx === "object") {
      const data = tx as Record<string, unknown>;
      if (typeof data.qr_code === "string" && data.qr_code.trim()) return "pix";
      if (typeof data.qr_code_base64 === "string" && data.qr_code_base64.trim()) return "pix";
    }
  }
  return "";
}

export function readPixFromPayments(payload: unknown): PixPresentation | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const poi = row.point_of_interaction;
  if (!poi || typeof poi !== "object") return null;
  const tx = (poi as { transaction_data?: unknown }).transaction_data;
  if (!tx || typeof tx !== "object") return null;
  const data = tx as Record<string, unknown>;
  const copy = typeof data.qr_code === "string" && data.qr_code.trim() ? data.qr_code.trim() : null;
  const image =
    typeof data.qr_code_base64 === "string" && data.qr_code_base64.trim() ? data.qr_code_base64.trim() : null;
  const ticketUrl = isAllowedMercadoPagoTicketUrl(data.ticket_url);
  if (!copy && !image && !ticketUrl) return null;
  return { copy, image, ticketUrl };
}

function centsFromNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const cents = Math.round(value * 100);
    return Math.abs(value * 100 - cents) < 0.001 ? cents : null;
  }
  if (typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value)) {
    return Math.round(Number(value) * 100);
  }
  return null;
}

/** Payments API já usa status legado (pending/approved/…); pending_waiting_transfer → pending. */
function normalizePaymentsStatus(status: string): string {
  if (status === "pending") return "pending";
  if (status === "approved") return "approved";
  if (status === "authorized") return "authorized";
  if (status === "in_process" || status === "in_mediation") return "in_process";
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "refunded";
  if (status === "charged_back") return "charged_back";
  return status;
}
