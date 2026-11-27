/**
 * COM-AUDIT-1.1 — validação e aplicação administrativa de reconciliação.
 * Sem adaptador Payments API. Não força PAID sem confirmação financeira válida.
 */

import type { AdminAuditAction } from "@/lib/admin/commerce-audit";
import { applyProviderView } from "@/lib/commerce/apply";
import { hasRecordedMethodMismatch, providerMethodFromTypeId } from "@/lib/commerce/payment-guards";
import type { ProviderPaymentView } from "@/lib/commerce/reconcile";
import { getPrisma } from "@/lib/db/prisma";

export type AdminReconcileOutcome = "applied" | "ignored" | "rejected" | "needs_review";

export type AdminReconcileValidation = {
  outcome: AdminReconcileOutcome;
  reason: string;
  mayApply: boolean;
};

export const providerMethodOf = providerMethodFromTypeId;

/** Divergência financeira de método — não confundir com outros NEEDS_REVIEW. */
export function hasOpenMethodDivergence(input: {
  orderStatus: string;
  providerStatusDetail: string | null | undefined;
}): boolean {
  return hasRecordedMethodMismatch(input.providerStatusDetail);
}

export function validateAdminReconcile(input: {
  confirmed: boolean;
  queriedProviderPaymentId: string;
  local: {
    orderId: string;
    orderTotalCents: number;
    orderStatus: string;
    amountCents: number;
    providerPaymentId: string | null;
    paymentMethodType: string | null;
    providerStatusDetail: string | null;
  };
  view: ProviderPaymentView | null;
}): AdminReconcileValidation {
  if (!input.confirmed) {
    return { outcome: "rejected", reason: "Confirmação administrativa ausente.", mayApply: false };
  }
  if (!input.local.providerPaymentId) {
    return { outcome: "rejected", reason: "Sem identificador remoto local.", mayApply: false };
  }
  if (!input.view) {
    return { outcome: "rejected", reason: "Provedor não retornou o pagamento.", mayApply: false };
  }
  if (input.view.id !== input.queriedProviderPaymentId || input.view.id !== input.local.providerPaymentId) {
    return {
      outcome: "rejected",
      reason: "Identificador remoto consultado diverge do retornado/local.",
      mayApply: false,
    };
  }
  if (input.view.externalReference !== input.local.orderId) {
    return { outcome: "rejected", reason: "external_reference diverge do pedido associado.", mayApply: false };
  }
  if (input.view.currency !== "BRL") {
    return { outcome: "rejected", reason: "Moeda remota não é BRL.", mayApply: false };
  }
  if (input.view.amountCents !== input.local.amountCents) {
    return { outcome: "rejected", reason: "Valor remoto diverge da tentativa local.", mayApply: false };
  }
  if (input.view.amountCents !== input.local.orderTotalCents) {
    return { outcome: "needs_review", reason: "Valor remoto diverge do total do pedido.", mayApply: false };
  }

  if (hasOpenMethodDivergence(input.local)) {
    return {
      outcome: "needs_review",
      reason: "Divergência de método previamente identificada; reconciliação não a elimina.",
      mayApply: false,
    };
  }

  const remoteMethod = providerMethodOf(input.view.paymentTypeId);
  if (input.local.paymentMethodType && remoteMethod && input.local.paymentMethodType !== remoteMethod) {
    return {
      outcome: "needs_review",
      reason: `Método divergente (local ${input.local.paymentMethodType} ≠ remoto ${remoteMethod}). Método original preservado.`,
      mayApply: false,
    };
  }
  if (input.local.paymentMethodType && !remoteMethod) {
    return {
      outcome: "needs_review",
      reason: "Método remoto não reconhecido; método local preservado.",
      mayApply: false,
    };
  }

  return { outcome: "applied", reason: "Validações financeiras ok.", mayApply: true };
}

export async function setUserTestAccountAtomic(input: {
  actorUserId: string;
  userId: string;
  isTestAccountRaw: string;
}): Promise<{ ok: true; changed: boolean } | { ok: false; reason: string }> {
  const userId = input.userId.trim();
  if (!userId || userId.length < 8 || userId.length > 80) {
    return { ok: false, reason: "userId inválido." };
  }
  if (input.isTestAccountRaw !== "0" && input.isTestAccountRaw !== "1") {
    return { ok: false, reason: "isTestAccount deve ser 0 ou 1." };
  }
  const next = input.isTestAccountRaw === "1";
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, isTestAccount: true },
    });
    if (!user) return { ok: false as const, reason: "Usuário não encontrado." };
    if (user.isTestAccount === next) return { ok: true as const, changed: false };

    await tx.user.update({
      where: { id: userId },
      data: { isTestAccount: next, updatedAt: new Date() },
    });
    const action: AdminAuditAction = next ? "test_account_set" : "test_account_clear";
    await tx.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action,
        targetType: "user",
        targetId: userId,
        summary: next
          ? "Conta marcada como teste (classificação administrativa)."
          : "Conta desmarcada como teste (classificação administrativa).",
      },
    });
    return { ok: true as const, changed: true };
  });
}

export async function inspectMercadoPagoPaymentService(input: {
  actorUserId: string;
  paymentId: string;
  fetchView: (providerPaymentId: string) => Promise<ProviderPaymentView | null>;
}): Promise<{ ok: boolean; orderId?: string; summary: string }> {
  const prisma = getPrisma();
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: { id: true, orderId: true, providerPaymentId: true },
  });
  if (!payment?.providerPaymentId) {
    return { ok: false, summary: "Sem identificador remoto para consultar." };
  }

  const view = await input.fetchView(payment.providerPaymentId);
  const summary = view
    ? `Consulta MP (somente leitura): status=${view.status} detail=${view.statusDetail ?? "—"} amount=${view.amountCents}`
    : "Consulta MP (somente leitura): pagamento não encontrado no provedor.";

  await prisma.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "payment_inspect",
      targetType: "payment",
      targetId: payment.id,
      summary: summary.slice(0, 500),
    },
  });

  return { ok: Boolean(view), orderId: payment.orderId, summary };
}

export async function reconcileAdminPaymentService(input: {
  actorUserId: string;
  paymentId: string;
  confirmed: boolean;
  fetchView: (providerPaymentId: string) => Promise<ProviderPaymentView | null>;
}): Promise<{ outcome: AdminReconcileOutcome; reason: string; orderId?: string }> {
  const prisma = getPrisma();
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      orderId: true,
      providerPaymentId: true,
      status: true,
      amountCents: true,
      paymentMethodType: true,
      providerStatusDetail: true,
      order: { select: { id: true, totalCents: true, status: true } },
    },
  });
  if (!payment?.providerPaymentId) {
    return { outcome: "rejected", reason: "Pagamento local sem identificador remoto." };
  }

  const queriedId = payment.providerPaymentId;
  const view = await input.fetchView(queriedId);
  const validation = validateAdminReconcile({
    confirmed: input.confirmed,
    queriedProviderPaymentId: queriedId,
    local: {
      orderId: payment.orderId,
      orderTotalCents: payment.order.totalCents,
      orderStatus: payment.order.status,
      amountCents: payment.amountCents,
      providerPaymentId: payment.providerPaymentId,
      paymentMethodType: payment.paymentMethodType,
      providerStatusDetail: payment.providerStatusDetail,
    },
    view,
  });

  if (!validation.mayApply) {
    await prisma.$transaction(async (tx) => {
      if (validation.outcome === "needs_review" && payment.order.status !== "PAID" && payment.order.status !== "REFUNDED") {
        await tx.order.updateMany({
          where: { id: payment.orderId, status: { notIn: ["PAID", "REFUNDED"] } },
          data: { status: "NEEDS_REVIEW" },
        });
        if (validation.reason.includes("Método divergente") || validation.reason.includes("método")) {
          const remoteMethod = view ? providerMethodOf(view.paymentTypeId) : null;
          await tx.payment.updateMany({
            where: { id: payment.id },
            data: {
              // Preserva o método do claim; só registra a divergência financeira.
              paymentMethodType: payment.paymentMethodType,
              providerStatusDetail: hasRecordedMethodMismatch(payment.providerStatusDetail)
                ? payment.providerStatusDetail
                : `method_mismatch:${remoteMethod || "unknown"}`.slice(0, 80),
            },
          });
        }
      }
      await tx.adminAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "payment_reconcile",
          targetType: "payment",
          targetId: payment.id,
          summary: `Reconciliação ${validation.outcome}: ${validation.reason}`.slice(0, 500),
        },
      });
    });
    return { outcome: validation.outcome, reason: validation.reason, orderId: payment.orderId };
  }

  if (!view) {
    return { outcome: "rejected", reason: "Provedor não retornou o pagamento.", orderId: payment.orderId };
  }

  // apply + audit na mesma transação; outcome reflete a decisão efetiva.
  const applyResult = await applyProviderView(payment.id, view, {
    audit: {
      actorUserId: input.actorUserId,
      action: "payment_reconcile",
      targetType: "payment",
      targetId: payment.id,
      summary: `Reconciliação: provider=${view.status}/${view.statusDetail ?? "—"} local_antes=${payment.status}`,
    },
  });

  if (!applyResult.audited && (applyResult.outcome === "ignored" || applyResult.outcome === "rejected")) {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "payment_reconcile",
        targetType: "payment",
        targetId: payment.id,
        summary: `Reconciliação ${applyResult.outcome}: ${applyResult.reason ?? "estado local preservado"}`.slice(0, 500),
      },
    });
  }

  return {
    outcome: applyResult.outcome,
    reason: applyResult.reason ?? validation.reason,
    orderId: payment.orderId,
  };
}
