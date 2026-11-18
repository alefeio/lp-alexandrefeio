"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { isCommerceEnabled, mercadoPagoPublicKey } from "@/lib/commerce/config";
import {
  cancelAbandonedCheckoutForUser,
  createOrderForUser,
  getOrderForUser,
  getResumeCheckoutForUser,
  preparePaymentAttempt,
  quoteForUser,
  repurchaseCancelledOrderForUser,
} from "@/lib/commerce/orders";
import {
  applyProviderView,
  claimChargeDispatch,
  reconcileMercadoPagoPayment,
  updateOpenPaymentMarkers,
} from "@/lib/commerce/apply";
import {
  acceptedMethod,
  chargeFingerprint,
  createProviderCharge,
  encodeChargeFingerprint,
  fetchPixPresentation,
  PROVIDER_STATUS_DISPATCHED,
  PROVIDER_STATUS_UNKNOWN,
  UNCERTAIN_PAYMENT_MESSAGE,
} from "@/lib/commerce/provider";
import { maxCardInstallments } from "@/lib/commerce/quote";
import { getPrisma } from "@/lib/db/prisma";

const linesSchema = z.array(z.object({ type: z.enum(["LESSON", "MODULE", "COURSE"]), id: z.string().min(8).max(40) })).max(12);

export async function quoteCartAction(rawLines: unknown) {
  const session = await requireSession();
  const lines = linesSchema.safeParse(rawLines);
  if (!lines.success) return { ok: false as const, message: "O carrinho não é válido." };
  return quoteForUser(session.user.id, lines.data);
}

export async function createOrderAction(rawLines: unknown, checkoutKey: string) {
  const session = await requireSession();
  if (!z.string().uuid().safeParse(checkoutKey).success) return { ok: false as const, message: "Não foi possível abrir o checkout." };
  const lines = linesSchema.safeParse(rawLines);
  if (!lines.success) return { ok: false as const, message: "O carrinho não é válido." };
  return createOrderForUser(session.user.id, lines.data, checkoutKey);
}

const chargeSchema = z.object({
  paymentMethodId: z.string().trim().min(2).max(40),
  token: z.string().trim().max(256).optional(),
  issuerId: z.string().trim().max(20).optional(),
  installments: z.number().int().min(1).max(maxCardInstallments()).optional(),
  payerEmail: z.string().trim().email().max(120),
  identificationType: z.string().trim().max(8).optional(),
  identificationNumber: z.string().trim().max(20).optional(),
});

export async function payOrderAction(orderId: string, raw: unknown) {
  const session = await requireSession();
  if (!isCommerceEnabled()) {
    return { ok: false as const, message: "As compras ainda não estão abertas.", code: "commerce_disabled" as const };
  }
  if (!mercadoPagoPublicKey()) {
    return { ok: false as const, message: "O pagamento não está configurado.", code: "not_configured" as const };
  }
  const parsed = chargeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Revise os dados do pagamento.", code: "invalid_payload" as const };
  const method = acceptedMethod(parsed.data.paymentMethodId, parsed.data.token);
  if (!method) {
    return { ok: false as const, message: "Esta forma de pagamento não está disponível.", code: "method_unavailable" as const };
  }

  const prepared = await preparePaymentAttempt(session.user.id, orderId);
  if (!prepared.ok) {
    return {
      ok: false as const,
      message: prepared.message,
      code: "code" in prepared ? prepared.code : ("prepare_failed" as const),
    };
  }

  if (prepared.mode === "reuse_provider") {
    const current = await getPrisma().payment.findUnique({ where: { id: prepared.paymentId } });
    const orderRow = await getPrisma().order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (orderRow?.status === "PAID" || current?.status === "APPROVED") {
      return {
        ok: true as const,
        status: current?.status ?? "APPROVED",
        pix: null,
        message: "Este pagamento já foi confirmado.",
        code: "already_confirmed" as const,
      };
    }
    if (current?.providerPaymentId) {
      await reconcileMercadoPagoPayment(current.providerPaymentId);
      const refreshed = await getPrisma().payment.findUnique({ where: { id: prepared.paymentId } });
      const pix =
        refreshed?.providerPaymentId && refreshed.paymentMethodType === "PIX"
          ? await fetchPixPresentation(refreshed.providerPaymentId)
          : null;
      return {
        ok: true as const,
        status: refreshed?.status ?? "PENDING",
        pix,
        message: "Este pagamento já foi iniciado.",
        code: "reused" as const,
      };
    }
    return {
      ok: true as const,
      status: current?.status ?? "PENDING",
      pix: null,
      message: "Este pagamento já foi iniciado.",
      code: "reused" as const,
    };
  }

  const fingerprint = chargeFingerprint({
    orderId,
    amountCents: prepared.amountCents,
    paymentMethodId: parsed.data.paymentMethodId,
    installments: parsed.data.installments,
    payerEmail: parsed.data.payerEmail,
    identificationType: parsed.data.identificationType,
    identificationNumber: parsed.data.identificationNumber,
  });
  const fingerprintDetail = encodeChargeFingerprint(fingerprint);

  // Claim atômico: só o vencedor (ou retomada Pix idêntica) chama o provedor.
  const claimed = await claimChargeDispatch({
    paymentId: prepared.paymentId,
    fingerprintDetail,
    method,
  });
  if (!claimed.ok) {
    if (claimed.reason === "approved") {
      return {
        ok: true as const,
        status: "APPROVED",
        pix: null,
        message: "Este pagamento já foi confirmado.",
        code: "already_confirmed" as const,
      };
    }
    if (claimed.reason === "fingerprint_mismatch") {
      return { ok: false as const, message: UNCERTAIN_PAYMENT_MESSAGE, code: "fingerprint_mismatch" as const };
    }
    return { ok: false as const, message: UNCERTAIN_PAYMENT_MESSAGE, code: "payment_uncertain" as const };
  }

  const order = await getOrderForUser(session.user.id, orderId);
  if (!order) return { ok: false as const, message: "Pedido não encontrado.", code: "not_found" as const };

  const charge = await createProviderCharge({
    orderId,
    idempotencyKey: prepared.idempotencyKey,
    amountCents: prepared.amountCents,
    description: order.items.map((item) => item.titleSnapshot).join(", "),
    paymentMethodId: parsed.data.paymentMethodId,
    token: parsed.data.token,
    issuerId: parsed.data.issuerId,
    installments: parsed.data.installments,
    payerEmail: parsed.data.payerEmail,
    identificationType: parsed.data.identificationType,
    identificationNumber: parsed.data.identificationNumber,
  });

  if (charge.ok) {
    await applyProviderView(prepared.paymentId, charge.view);
    const refreshed = await getPrisma().payment.findUnique({ where: { id: prepared.paymentId } });
    if (method === "PIX" && !charge.pix) {
      return {
        ok: true as const,
        status: refreshed?.status === "APPROVED" ? "approved" : charge.view.status,
        pix: null,
        message: "Pagamento Pix iniciado. Abra o pedido para atualizar o QR Code.",
        code: "pix_pending" as const,
      };
    }
    return {
      ok: true as const,
      status: refreshed?.status === "APPROVED" ? "approved" : charge.view.status,
      pix: charge.pix,
      message: "Pagamento enviado.",
      code: "charged" as const,
    };
  }

  if (charge.kind === "unknown") {
    // Nunca força status=PENDING: se o webhook já aprovou, updateMany não altera a linha.
    const marked = await updateOpenPaymentMarkers(prepared.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: fingerprintDetail,
    });
    if (charge.view) await applyProviderView(prepared.paymentId, charge.view);
    if (marked.currentStatus === "APPROVED") {
      return {
        ok: true as const,
        status: "APPROVED",
        pix: null,
        message: "Este pagamento já foi confirmado.",
        code: "already_confirmed" as const,
      };
    }
    return { ok: false as const, message: charge.message, code: "payment_uncertain" as const };
  }

  if (charge.view) await applyProviderView(prepared.paymentId, charge.view);
  else {
    const rejected = await updateOpenPaymentMarkers(prepared.paymentId, {
      status: "REJECTED",
      providerStatus: "request_failed",
      providerStatusDetail: fingerprintDetail,
    });
    if (rejected.currentStatus === "APPROVED") {
      return {
        ok: true as const,
        status: "APPROVED",
        pix: null,
        message: "Este pagamento já foi confirmado.",
        code: "already_confirmed" as const,
      };
    }
  }
  return { ok: false as const, message: charge.message, code: "rejected" as const };
}

export async function refreshOrderPaymentAction(orderId: string) {
  const session = await requireSession();
  const order = await getOrderForUser(session.user.id, orderId);
  if (!order) return { ok: false as const, message: "Pedido não encontrado." };
  const payment = order.payments.find((item) => item.providerPaymentId);
  if (!payment?.providerPaymentId) {
    const uncertain = order.payments.find(
      (item) =>
        (item.status === "PENDING" || item.status === "IN_PROCESS") &&
        (item.providerStatus === PROVIDER_STATUS_UNKNOWN || item.providerStatus === PROVIDER_STATUS_DISPATCHED),
    );
    if (uncertain) {
      return { ok: false as const, message: UNCERTAIN_PAYMENT_MESSAGE, code: "payment_uncertain" as const };
    }
    return { ok: false as const, message: "Ainda não há um pagamento para consultar." };
  }
  return reconcileMercadoPagoPayment(payment.providerPaymentId);
}

export async function cancelAbandonedCheckoutAction(orderId: string) {
  const session = await requireSession();
  if (!z.string().min(8).max(40).safeParse(orderId).success) {
    return { ok: false as const, message: "Pedido inválido." };
  }
  return cancelAbandonedCheckoutForUser(session.user.id, orderId);
}

export async function resumeCheckoutAction(orderId: string) {
  const session = await requireSession();
  if (!z.string().min(8).max(40).safeParse(orderId).success) {
    return { ok: false as const, message: "Pedido inválido.", code: "invalid_order" as const };
  }
  return getResumeCheckoutForUser(session.user.id, orderId);
}

export async function repurchaseCancelledOrderAction(orderId: string, checkoutKey: string) {
  const session = await requireSession();
  if (!z.string().min(8).max(40).safeParse(orderId).success) {
    return { ok: false as const, message: "Pedido inválido.", code: "invalid_order" as const };
  }
  if (!z.string().uuid().safeParse(checkoutKey).success) {
    return { ok: false as const, message: "Não foi possível abrir um novo checkout.", code: "invalid_checkout_key" as const };
  }
  return repurchaseCancelledOrderForUser(session.user.id, orderId, checkoutKey);
}
