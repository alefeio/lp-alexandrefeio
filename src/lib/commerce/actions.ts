"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { isCommerceEnabled, mercadoPagoPublicKey } from "@/lib/commerce/config";
import { createOrderForUser, getOrderForUser, preparePaymentAttempt, quoteForUser } from "@/lib/commerce/orders";
import { applyProviderView, reconcileMercadoPagoPayment } from "@/lib/commerce/apply";
import { acceptedMethod, createProviderCharge, fetchPixPresentation } from "@/lib/commerce/provider";
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
  if (!isCommerceEnabled()) return { ok: false as const, message: "As compras ainda não estão abertas." };
  if (!mercadoPagoPublicKey()) return { ok: false as const, message: "O pagamento de teste não está configurado." };
  const parsed = chargeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: "Revise os dados do pagamento." };
  if (!acceptedMethod(parsed.data.paymentMethodId, parsed.data.token)) {
    return { ok: false as const, message: "Esta forma de pagamento não está disponível." };
  }
  const prepared = await preparePaymentAttempt(session.user.id, orderId);
  if (!prepared.ok) return prepared;
  if (prepared.reused) {
    const current = await getPrisma().payment.findUnique({ where: { id: prepared.paymentId } });
    const pix = current?.providerPaymentId && current.paymentMethodType === "PIX" ? await fetchPixPresentation(current.providerPaymentId) : null;
    return { ok: true as const, status: current?.status ?? "PENDING", pix, message: "Este pagamento já foi iniciado." };
  }
  const order = await getOrderForUser(session.user.id, orderId);
  if (!order) return { ok: false as const, message: "Pedido não encontrado." };
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
  if (charge.view) await applyProviderView(prepared.paymentId, charge.view);
  else if (!charge.ok) {
    await getPrisma().payment.update({ where: { id: prepared.paymentId }, data: { status: "REJECTED", providerStatus: "request_failed" } });
  }
  if (!charge.ok) return { ok: false as const, message: charge.message };
  return { ok: true as const, status: charge.view.status, pix: charge.pix, message: "Pagamento enviado." };
}

export async function refreshOrderPaymentAction(orderId: string) {
  const session = await requireSession();
  const order = await getOrderForUser(session.user.id, orderId);
  if (!order) return { ok: false as const, message: "Pedido não encontrado." };
  const payment = order.payments.find((item) => item.providerPaymentId);
  if (!payment?.providerPaymentId) return { ok: false as const, message: "Ainda não há um pagamento para consultar." };
  return reconcileMercadoPagoPayment(payment.providerPaymentId);
}
