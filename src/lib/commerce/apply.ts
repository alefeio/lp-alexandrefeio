import { getPrisma } from "@/lib/db/prisma";
import { sendPurchaseConfirmationIfNeeded } from "@/lib/commerce/orders";
import {
  decideChargeDispatchClaim,
  evaluateProviderBinding,
  hasRecordedMethodMismatch,
  mayOverwritePaymentStatus,
  methodMismatchDetail,
  providerMethodFromTypeId,
  shouldIgnoreStaleProviderStatus,
} from "@/lib/commerce/payment-guards";
import { fetchProviderPayment, PROVIDER_STATUS_DISPATCHED, PROVIDER_STATUS_UNKNOWN } from "@/lib/commerce/provider";
import { reconcileDecision, type InternalPaymentStatus, type ProviderPaymentView } from "@/lib/commerce/reconcile";

export async function reconcileMercadoPagoPayment(providerPaymentId: string) {
  const view = await fetchProviderPayment(providerPaymentId);
  if (!view) return { ok: false as const, message: "Pagamento não encontrado no Mercado Pago." };
  const payment = await getPrisma().payment.findFirst({
    where: {
      OR: [{ providerPaymentId: view.id }, { orderId: view.externalReference, providerPaymentId: null, amountCents: view.amountCents }],
    },
    include: { order: true },
  });
  if (!payment || payment.orderId !== view.externalReference) {
    return { ok: false as const, message: "Este aviso não corresponde a um pedido local." };
  }
  // Impede que webhook aplique ID remoto diferente do vínculo já gravado.
  if (payment.providerPaymentId && payment.providerPaymentId !== view.id) {
    return { ok: false as const, message: "Identificador remoto não corresponde à tentativa vinculada." };
  }
  await applyProviderView(payment.id, view);
  return { ok: true as const, orderId: payment.orderId };
}

export type ApplyProviderViewOptions = {
  /** Escrito na mesma transação financeira; falha faz rollback da mutação. */
  audit?: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    summary: string;
  };
};

export type ApplyProviderViewResult = {
  emailed: boolean;
  orderId?: string;
  ignored: boolean;
  audited: boolean;
  outcome: "applied" | "ignored" | "needs_review" | "rejected";
  reason?: string;
};

export async function applyProviderView(
  paymentId: string,
  view: ProviderPaymentView,
  options?: ApplyProviderViewOptions,
): Promise<ApplyProviderViewResult> {
  const prisma = getPrisma();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payment" WHERE "id" = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) {
      return { emailed: false as const, ignored: true as const, audited: false as const, outcome: "ignored" as const, reason: "Pagamento não encontrado." };
    }

    // Revalida condições financeiras sob lock.
    const binding = evaluateProviderBinding({
      localProviderPaymentId: payment.providerPaymentId,
      localMethod: payment.paymentMethodType as "PIX" | "CREDIT_CARD" | null,
      localStatusDetail: payment.providerStatusDetail,
      orderStatus: payment.order.status,
      orderTotalCents: payment.order.totalCents,
      paymentAmountCents: payment.amountCents,
      paymentStatus: payment.status as InternalPaymentStatus,
      view,
    });

    const isRefundOrChargeback =
      view.status === "refunded" ||
      view.status === "charged_back" ||
      view.status === "partially_refunded" ||
      view.refundedCents > 0;

    // Divergência financeira de método: não concede, não limpa marcador, preserva método.
    // Reembolso/chargeback legítimo sobre APPROVED ainda pode seguir (anti-regressão em mayOverwrite).
    if (!binding.ok && binding.recordMethodMismatch && !isRefundOrChargeback) {
      const remoteMethod = providerMethodFromTypeId(view.paymentTypeId);
      await tx.payment.updateMany({
        where: { id: payment.id },
        data: {
          paymentMethodType: binding.preservedMethod,
          providerStatusDetail: hasRecordedMethodMismatch(payment.providerStatusDetail)
            ? payment.providerStatusDetail
            : methodMismatchDetail(remoteMethod),
        },
      });
      if (payment.order.status !== "PAID" && payment.order.status !== "REFUNDED") {
        await tx.order.updateMany({
          where: { id: payment.orderId, status: { notIn: ["PAID", "REFUNDED"] } },
          data: { status: "NEEDS_REVIEW" },
        });
      }
      let audited = false;
      if (options?.audit) {
        if (options.audit.summary === "__force_audit_fail__") throw new Error("audit_write_failed");
        await tx.adminAuditLog.create({
          data: {
            actorUserId: options.audit.actorUserId,
            action: options.audit.action,
            targetType: options.audit.targetType,
            targetId: options.audit.targetId,
            summary: `Reconciliação needs_review: ${binding.reason}`.slice(0, 500),
          },
        });
        audited = true;
      }
      return {
        emailed: false as const,
        orderId: payment.orderId,
        ignored: false as const,
        audited,
        outcome: "needs_review" as const,
        reason: binding.reason,
      };
    }

    if (!binding.ok && !isRefundOrChargeback) {
      let audited = false;
      if (options?.audit) {
        if (options.audit.summary === "__force_audit_fail__") throw new Error("audit_write_failed");
        await tx.adminAuditLog.create({
          data: {
            actorUserId: options.audit.actorUserId,
            action: options.audit.action,
            targetType: options.audit.targetType,
            targetId: options.audit.targetId,
            summary: `Reconciliação rejected: ${binding.reason}`.slice(0, 500),
          },
        });
        audited = true;
      }
      return {
        emailed: false as const,
        orderId: payment.orderId,
        ignored: true as const,
        audited,
        outcome: "rejected" as const,
        reason: binding.reason,
      };
    }

    if (shouldIgnoreStaleProviderStatus(payment.status as InternalPaymentStatus, view.status)) {
      return {
        emailed: false as const,
        ignored: true as const,
        audited: false as const,
        outcome: "ignored" as const,
        reason: "Status remoto stale frente a pagamento travado.",
        orderId: payment.orderId,
      };
    }

    const granted = await tx.entitlement.count({
      where: { orderItem: { orderId: payment.orderId }, status: "ACTIVE" },
    });
    let decision = reconcileDecision({
      orderId: payment.orderId,
      orderStatus: payment.order.status,
      orderTotalCents: payment.order.totalCents,
      paymentStatus: payment.status as InternalPaymentStatus,
      paymentAmountCents: payment.amountCents,
      provider: view,
      alreadyGranted: granted > 0,
    });

    if (!mayOverwritePaymentStatus(payment.status as InternalPaymentStatus, decision.paymentStatus)) {
      decision = {
        ...decision,
        paymentStatus: payment.status as InternalPaymentStatus,
        orderStatus: payment.order.status === "PAID" ? "PAID" : decision.orderStatus,
        grant: false,
        revoke: false,
        ignore: true,
        needsReview: false,
      };
    }

    // Divergência financeira impede concessão mesmo se reconcileDecision pedir grant.
    if (binding.blockGrant || hasRecordedMethodMismatch(payment.providerStatusDetail)) {
      decision = { ...decision, grant: false, needsReview: true, orderStatus: payment.order.status === "PAID" ? "PAID" : "NEEDS_REVIEW" };
    }

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      include: { items: { include: { lessons: true } } },
    });
    if (!order) {
      return { emailed: false as const, ignored: true as const, audited: false as const, outcome: "ignored" as const, reason: "Pedido não encontrado." };
    }

    // Método original do claim sempre preservado quando já registrado.
    const nextMethod = payment.paymentMethodType ?? binding.preservedMethod ?? decision.method;
    const nextDetail =
      hasRecordedMethodMismatch(payment.providerStatusDetail) && !isRefundOrChargeback
        ? payment.providerStatusDetail
        : view.statusDetail;

    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: payment.status,
        // Não permite trocar providerPaymentId se já vinculado a outro id.
        OR: [{ providerPaymentId: null }, { providerPaymentId: view.id }],
      },
      data: {
        providerPaymentId: view.id,
        status: decision.paymentStatus,
        refundedAmountCents: decision.refundedAmountCents,
        providerStatus: view.status,
        providerStatusDetail: nextDetail,
        paymentMethodType: nextMethod,
        installments: view.installments,
        approvedAt: decision.approvedAt ? new Date() : payment.approvedAt,
      },
    });
    if (paymentUpdate.count !== 1) {
      return {
        emailed: false as const,
        ignored: true as const,
        audited: false as const,
        outcome: "ignored" as const,
        reason: "Corrida ou vínculo remoto incompatível.",
        orderId: payment.orderId,
      };
    }

    if (!decision.ignore) {
      if (order.status === "PAID" && decision.orderStatus !== "PAID" && decision.orderStatus !== "REFUNDED") {
        // Não derruba PAID para NEEDS_REVIEW/PENDING por evento stale.
      } else {
        await tx.order.updateMany({
          where: { id: payment.orderId, status: order.status },
          data: { status: decision.orderStatus },
        });
      }
    }
    if (decision.grant) {
      const now = new Date();
      for (const item of order.items) {
        for (const lesson of item.lessons) {
          await tx.entitlement.upsert({
            where: { orderItemId_lessonId: { orderItemId: item.id, lessonId: lesson.lessonId } },
            create: { userId: order.userId, lessonId: lesson.lessonId, orderItemId: item.id, status: "ACTIVE", grantedAt: now },
            update: { status: "ACTIVE", revokedAt: null },
          });
        }
      }
    }
    if (decision.revoke) {
      await tx.entitlement.updateMany({
        where: { orderItem: { orderId: order.id }, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
    }

    let audited = false;
    if (options?.audit) {
      if (options.audit.summary === "__force_audit_fail__") throw new Error("audit_write_failed");
      const outcomeLabel = decision.ignore ? "ignored" : decision.needsReview ? "needs_review" : "applied";
      await tx.adminAuditLog.create({
        data: {
          actorUserId: options.audit.actorUserId,
          action: options.audit.action,
          targetType: options.audit.targetType,
          targetId: options.audit.targetId,
          summary: `Reconciliação ${outcomeLabel}: provider=${view.status}/${view.statusDetail ?? "—"} local_antes=${payment.status}`.slice(0, 500),
        },
      });
      audited = true;
    }

    const outcome = decision.ignore ? ("ignored" as const) : decision.needsReview ? ("needs_review" as const) : ("applied" as const);
    return {
      emailed: outcome === "applied" && decision.orderStatus === "PAID" && decision.paymentStatus === "APPROVED",
      orderId: payment.orderId,
      ignored: decision.ignore,
      audited,
      outcome,
      reason: binding.reason,
    };
  });

  if (result.emailed && result.orderId) {
    await sendPurchaseConfirmationIfNeeded(result.orderId);
  }
  return {
    emailed: Boolean(result.emailed),
    orderId: result.orderId,
    ignored: Boolean(result.ignored),
    audited: Boolean(result.audited),
    outcome: result.outcome,
    reason: result.reason,
  };
}

/** Marca despacho/incerto/rejeição apenas enquanto o pagamento continuar aberto. */
export async function updateOpenPaymentMarkers(
  paymentId: string,
  data: {
    status?: "REJECTED";
    providerStatus: string;
    providerStatusDetail: string;
  },
): Promise<{ updated: boolean; currentStatus: InternalPaymentStatus | null }> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payment" WHERE "id" = ${paymentId} FOR UPDATE`;
    const row = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!row) return { updated: false, currentStatus: null };
    const status = row.status as InternalPaymentStatus;
    if (status !== "PENDING" && status !== "IN_PROCESS") {
      return { updated: false, currentStatus: status };
    }
    // Timeout/unknown não pode sobrescrever fingerprint de outro despacho em voo com payload diferente.
    if (
      data.providerStatus === PROVIDER_STATUS_UNKNOWN &&
      row.providerStatusDetail &&
      row.providerStatusDetail !== data.providerStatusDetail &&
      (row.providerStatus === PROVIDER_STATUS_DISPATCHED || row.providerStatus === PROVIDER_STATUS_UNKNOWN)
    ) {
      return { updated: false, currentStatus: status };
    }
    const updated = await tx.payment.updateMany({
      where: { id: paymentId, status: { in: ["PENDING", "IN_PROCESS"] } },
      data: {
        ...(data.status ? { status: data.status } : {}),
        providerStatus: data.providerStatus,
        providerStatusDetail: data.providerStatusDetail,
      },
    });
    return { updated: updated.count === 1, currentStatus: status };
  });
}

export type ClaimChargeDispatchResult =
  | { ok: true; kind: "dispatch" | "resume"; currentStatus: InternalPaymentStatus }
  | {
      ok: false;
      reason: "approved" | "uncertain" | "fingerprint_mismatch" | "card_uncertain" | "not_found" | "not_open" | "lost_race";
      currentStatus: InternalPaymentStatus | null;
    };

/**
 * Reivindica atomicamente o direito de chamar o provedor nesta tentativa.
 * O perdedor da corrida não envia cobrança divergente.
 */
export async function claimChargeDispatch(input: {
  paymentId: string;
  fingerprintDetail: string;
  method: "PIX" | "CREDIT_CARD";
}): Promise<ClaimChargeDispatchResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payment" WHERE "id" = ${input.paymentId} FOR UPDATE`;
    const row = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!row) return { ok: false as const, reason: "not_found" as const, currentStatus: null };

    const decision = decideChargeDispatchClaim({
      status: row.status,
      providerStatus: row.providerStatus,
      providerStatusDetail: row.providerStatusDetail,
      providerPaymentId: row.providerPaymentId,
      fingerprintDetail: input.fingerprintDetail,
      method: input.method,
    });

    if (decision.kind === "deny") {
      return {
        ok: false as const,
        reason: decision.reason,
        currentStatus: row.status as InternalPaymentStatus,
      };
    }

    if (decision.kind === "resume") {
      return {
        ok: true as const,
        kind: "resume" as const,
        currentStatus: row.status as InternalPaymentStatus,
      };
    }

    // Claim exclusivo: só grava se ainda não houver marker de despacho/incerteza.
    const claimed = await tx.payment.updateMany({
      where: {
        id: input.paymentId,
        status: { in: ["PENDING", "IN_PROCESS"] },
        providerPaymentId: null,
        OR: [{ providerStatus: null }, { providerStatus: { notIn: [PROVIDER_STATUS_DISPATCHED, PROVIDER_STATUS_UNKNOWN] } }],
      },
      data: {
        providerStatus: PROVIDER_STATUS_DISPATCHED,
        providerStatusDetail: input.fingerprintDetail,
      },
    });

    if (claimed.count === 1) {
      return {
        ok: true as const,
        kind: "dispatch" as const,
        currentStatus: row.status as InternalPaymentStatus,
      };
    }

    // Corrida: outro worker gravou o marker. Reavalia sem sobrescrever.
    const again = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!again) return { ok: false as const, reason: "not_found" as const, currentStatus: null };
    const retry = decideChargeDispatchClaim({
      status: again.status,
      providerStatus: again.providerStatus,
      providerStatusDetail: again.providerStatusDetail,
      providerPaymentId: again.providerPaymentId,
      fingerprintDetail: input.fingerprintDetail,
      method: input.method,
    });
    if (retry.kind === "resume") {
      return {
        ok: true as const,
        kind: "resume" as const,
        currentStatus: again.status as InternalPaymentStatus,
      };
    }
    if (retry.kind === "deny") {
      return {
        ok: false as const,
        reason: retry.reason,
        currentStatus: again.status as InternalPaymentStatus,
      };
    }
    return {
      ok: false as const,
      reason: "lost_race" as const,
      currentStatus: again.status as InternalPaymentStatus,
    };
  });
}
