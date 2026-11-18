import { createHash } from "node:crypto";
import { mercadoPagoRuntimeConfig } from "@/lib/commerce/config";
import { reaisFromCents } from "@/lib/commerce/analytics";
import type { ProviderPaymentView } from "@/lib/commerce/reconcile";

const CARD_METHODS = new Set(["visa", "master", "amex", "elo", "hipercard", "cabal", "naranja", "maestro"]);
const ORDERS_URL = "https://api.mercadopago.com/v1/orders";
/** E-mail exigido pela documentação de teste do Checkout Transparente. Não é o e-mail da conta. */
const TEST_PAYER_EMAIL = "test@testuser.com";

export const PROVIDER_STATUS_DISPATCHED = "charge_dispatched";
export const PROVIDER_STATUS_UNKNOWN = "outcome_unknown";
export const UNCERTAIN_PAYMENT_MESSAGE =
  "Há uma cobrança em verificação. Abra o pedido em Minhas compras ou fale com o suporte. Não inicie outro pagamento agora.";

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

export type PixPresentation = { copy: string; image: string; ticketUrl: string | null };

export type ChargeResult =
  | { ok: true; kind: "accepted"; view: ProviderPaymentView; pix: PixPresentation | null }
  | { ok: false; kind: "rejected"; message: string; view: ProviderPaymentView | null }
  | { ok: false; kind: "unknown"; message: string; view: ProviderPaymentView | null };

export function acceptedMethod(paymentMethodId: string, token?: string): "PIX" | "CREDIT_CARD" | null {
  if (paymentMethodId === "pix") return "PIX";
  if (token && (CARD_METHODS.has(paymentMethodId) || paymentMethodId === "credit_card")) return "CREDIT_CARD";
  return null;
}

/** Impressão estável da operação financeira (sem token de cartão). Inclui pagador canônico. */
export function chargeFingerprint(input: {
  orderId: string;
  amountCents: number;
  paymentMethodId: string;
  installments?: number;
  payerEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
}): string {
  const isPix = input.paymentMethodId === "pix";
  const normalizedMethod = isPix ? "pix" : input.paymentMethodId;
  const installments = isPix ? 1 : (input.installments ?? 1);
  const payer = (input.payerEmail ?? "").trim().toLowerCase();
  const idType = (input.identificationType ?? "").trim().toUpperCase();
  const idNumber = (input.identificationNumber ?? "").replace(/\D/g, "");
  const material = `${input.orderId}|${input.amountCents}|${normalizedMethod}|${installments}|${payer}|${idType}|${idNumber}`;
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export function encodeChargeFingerprint(fingerprint: string): string {
  return `fp:${fingerprint}`;
}

export function readStoredChargeFingerprint(providerStatusDetail: string | null | undefined): string | null {
  if (!providerStatusDetail?.startsWith("fp:")) return null;
  const value = providerStatusDetail.slice(3).trim();
  return value.length >= 16 ? value : null;
}

export function isUnresolvedPaymentMarker(providerStatus: string | null | undefined): boolean {
  return providerStatus === PROVIDER_STATUS_UNKNOWN || providerStatus === PROVIDER_STATUS_DISPATCHED;
}

export type ProviderChargeDiagnostics = {
  httpStatus: number | null;
  errorCode: string | null;
  providerStatus: string | null;
  statusDetail: string | null;
  method: "PIX" | "CREDIT_CARD" | null;
  remoteOrderIdPresent: boolean;
  correlationId: string | null;
};

/** Extrai campos seguros do retorno do provedor — sem token, CPF, e-mail, QR ou payload completo. */
export function extractProviderChargeDiagnostics(input: {
  httpStatus: number | null;
  payload: unknown;
  view: ProviderPaymentView | null;
  method: "PIX" | "CREDIT_CARD" | null;
  correlationId?: string | null;
}): ProviderChargeDiagnostics {
  const codes = collectErrorCodes(input.payload);
  const row = unwrapOrder(input.payload);
  const payment = row ? firstPayment(row) : null;
  const rawStatus =
    typeof payment?.status === "string"
      ? payment.status
      : typeof row?.status === "string"
        ? row.status
        : input.view?.status ?? null;
  const rawDetail =
    typeof payment?.status_detail === "string"
      ? payment.status_detail.slice(0, 80)
      : typeof row?.status_detail === "string"
        ? row.status_detail.slice(0, 80)
        : input.view?.statusDetail ?? null;
  const remoteId =
    typeof row?.id === "string" && row.id.length > 0
      ? row.id
      : typeof input.view?.id === "string" && input.view.id.length > 0
        ? input.view.id
        : null;
  return {
    httpStatus: input.httpStatus,
    errorCode: codes[0] ?? null,
    providerStatus: rawStatus ? String(rawStatus).slice(0, 40) : null,
    statusDetail: rawDetail,
    method: input.method,
    remoteOrderIdPresent: Boolean(remoteId),
    correlationId: input.correlationId ? input.correlationId.slice(0, 40) : null,
  };
}

export function userMessageForProviderRejection(diagnostics: ProviderChargeDiagnostics): string {
  const detail = (diagnostics.statusDetail ?? "").toLowerCase();
  const code = (diagnostics.errorCode ?? "").toLowerCase();
  if (detail.includes("high_risk") || code.includes("high_risk")) {
    return "O provedor recusou esta tentativa por análise de risco. Tente outro método ou fale com o suporte.";
  }
  if (detail.includes("insufficient") || code.includes("insufficient")) {
    return "O provedor recusou esta tentativa. Verifique o saldo ou tente outro método.";
  }
  if (code === "failed" || diagnostics.httpStatus === 402) {
    return "O provedor não concluiu esta cobrança (tentativa recusada). Você pode tentar de novo no mesmo pedido se ele ainda estiver aberto.";
  }
  return "O pagamento não foi aceito pelo provedor. Você pode tentar de novo se o pedido ainda estiver aguardando pagamento.";
}

/** Classifica falha HTTP/rede: rejected = definitivo; unknown = não pode abrir nova cobrança. */
export function classifyProviderChargeFailure(input: {
  networkError?: boolean;
  httpStatus: number | null;
  view: ProviderPaymentView | null;
  remoteOrderIdPresent?: boolean;
}): "rejected" | "unknown" {
  if (input.networkError) return "unknown";
  const status = input.httpStatus;
  if (status == null) return "unknown";
  if (status === 408 || status === 425 || status === 429 || status >= 500) return "unknown";
  if (input.view) {
    const viewStatus = input.view.status;
    if (viewStatus === "rejected" || viewStatus === "cancelled") return "rejected";
    // Resposta com view pendente/aprovada mas HTTP não-OK: inconclusivo.
    if (!status || status < 200 || status >= 300) return "unknown";
  }
  // HTTP 402 pode ter criado ordem remota mesmo sem view parseável — não tratar como “nada criado”.
  if (status === 402 && input.remoteOrderIdPresent && !input.view) return "unknown";
  if (status >= 400 && status < 500) return "rejected";
  return "unknown";
}

export async function createProviderCharge(input: ChargeInput): Promise<ChargeResult> {
  const config = mercadoPagoRuntimeConfig();
  if (!config) return { ok: false, kind: "rejected", message: "O pagamento não está configurado.", view: null };
  const method = acceptedMethod(input.paymentMethodId, input.token);
  if (!method) return { ok: false, kind: "rejected", message: "Esta forma de pagamento não está disponível.", view: null };
  if (method === "CREDIT_CARD" && !input.token) {
    return { ok: false, kind: "rejected", message: "Não foi possível usar este cartão.", view: null };
  }
  const installments = input.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > 3) {
    return { ok: false, kind: "rejected", message: "O parcelamento máximo neste checkout é de 3 vezes.", view: null };
  }
  const amount = reaisFromCents(input.amountCents).toFixed(2);
  if (Math.round(Number(amount) * 100) !== input.amountCents) {
    return { ok: false, kind: "rejected", message: "Não foi possível cobrar este valor.", view: null };
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
    return {
      ok: false,
      kind: "unknown",
      message: "Não foi possível confirmar o pagamento com o Mercado Pago. Consulte o pedido antes de tentar de novo.",
      view: null,
    };
  }

  const payload = await response.json().catch(() => null);
  const view = readProviderPayment(payload);
  if (response.ok && view) {
    return { ok: true, kind: "accepted", view, pix: method === "PIX" ? readPix(payload) : null };
  }

  const diagnostics = extractProviderChargeDiagnostics({
    httpStatus: response.status,
    payload,
    view,
    method,
    correlationId: input.orderId,
  });
  const failureKind = classifyProviderChargeFailure({
    httpStatus: response.status,
    view,
    remoteOrderIdPresent: diagnostics.remoteOrderIdPresent,
  });
  console.error("mercado pago charge inconclusive_or_rejected", {
    status: diagnostics.httpStatus,
    kind: failureKind,
    errorCode: diagnostics.errorCode,
    providerStatus: diagnostics.providerStatus ?? view?.status ?? null,
    statusDetail: diagnostics.statusDetail,
    method: diagnostics.method,
    remoteOrderIdPresent: diagnostics.remoteOrderIdPresent,
    correlationId: diagnostics.correlationId,
  });
  if (failureKind === "unknown") {
    return {
      ok: false,
      kind: "unknown",
      message: UNCERTAIN_PAYMENT_MESSAGE,
      view,
    };
  }
  return { ok: false, kind: "rejected", message: userMessageForProviderRejection(diagnostics), view };
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

export async function fetchPixPresentation(providerPaymentId: string): Promise<PixPresentation | null> {
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

export function readPix(payload: unknown): PixPresentation | null {
  const row = unwrapOrder(payload);
  if (!row) return null;
  const method = firstPayment(row)?.payment_method;
  const copy = method?.qr_code;
  const image = method?.qr_code_base64;
  const ticketUrl = typeof method?.ticket_url === "string" && method.ticket_url.startsWith("https://") ? method.ticket_url : null;
  if (typeof copy !== "string" || typeof image !== "string" || !copy || !image) return null;
  return { copy, image, ticketUrl };
}

function firstPayment(row: Record<string, unknown>): {
  amount?: unknown;
  status?: unknown;
  status_detail?: unknown;
  payment_method?: {
    type?: unknown;
    installments?: unknown;
    qr_code?: unknown;
    qr_code_base64?: unknown;
    ticket_url?: unknown;
  };
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
    payment_method?: {
      type?: unknown;
      installments?: unknown;
      qr_code?: unknown;
      qr_code_base64?: unknown;
      ticket_url?: unknown;
    };
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

function collectErrorCodes(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const row = payload as { message?: unknown; error?: unknown; errors?: unknown; code?: unknown };
  const codes: string[] = [];
  if (Array.isArray(row.errors)) {
    for (const item of row.errors) {
      if (!item || typeof item !== "object") continue;
      const code = (item as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) codes.push(code.trim().slice(0, 80));
    }
  }
  if (typeof row.error === "string" && row.error.trim()) codes.push(row.error.trim().slice(0, 80));
  if (typeof row.code === "string" && row.code.trim()) codes.push(row.code.trim().slice(0, 80));
  if (typeof row.message === "string" && row.message.trim() && codes.length === 0) {
    codes.push(row.message.trim().slice(0, 80));
  }
  return codes;
}
