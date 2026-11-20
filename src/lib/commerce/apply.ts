import { getPrisma } from "@/lib/db/prisma";
import { sendPurchaseConfirmationIfNeeded } from "@/lib/commerce/orders";
import {
  decideChargeDispatchClaim,
  mayOverwritePaymentStatus,
  shouldIgnoreStaleProviderStatus,
} from "@/lib/commerce/payment-guards";
import {
  isChargeApiKind,
  legacyChargeApiKind,
  type ChargeApiKind,
} from "@/lib/commerce/charge-api";
import { fetchProviderPayment, PROVIDER_STATUS_DISPATCHED, PROVIDER_STATUS_UNKNOWN } from "@/lib/commerce/provider";
import { reconcileDecision, type InternalPaymentStatus, type ProviderPaymentView } from "@/lib/commerce/reconcile";

export async function reconcileMercadoPagoPayment(
  providerPaymentId: string,
  preferredApiKind?: ChargeApiKind,
) {
  const existing = await getPrisma().payment.findFirst({
    where: { providerPaymentId },
    select: { providerApiKind: true },
  });
  const storedKind = isChargeApiKind(existing?.providerApiKind) ? existing.providerApiKind : null;
  // Preferência: kind persistido > kind do webhook > legado orders (pré-P0.1.4).
  const chargeApiKind = storedKind ?? preferredApiKind ?? legacyChargeApiKind();
  if (storedKind && preferredApiKind && storedKind !== preferredApiKind) {
    return { ok: false as const, message: "O aviso não corresponde ao mecanismo desta tentativa." };
  }

  const view = await fetchProviderPayment(providerPaymentId, chargeApiKind);
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
  if (isChargeApiKind(payment.providerApiKind) && payment.providerApiKind !== chargeApiKind) {
    return { ok: false as const, message: "O aviso não corresponde ao mecanismo desta tentativa." };
  }
  await applyProviderView(payment.id, view);
  return { ok: true as const, orderId: payment.orderId };
}

export async function applyProviderView(paymentId: string, view: ProviderPaymentView) {
  const prisma = getPrisma();

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payment" WHERE "id" = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) return { emailed: false as const };

    if (shouldIgnoreStaleProviderStatus(payment.status as InternalPaymentStatus, view.status)) {
      return { emailed: false as const };
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
      // Webhook/HTTP tardio não pode rebaixar APPROVED → PENDING/REJECTED.
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

    const order = await tx.order.findUnique({
      where: { id: payment.orderId },
      include: { items: { include: { lessons: true } } },
    });
    if (!order) return { emailed: false as const };

    // Atualização condicional: se outro worker já aprovou, count=0 e não regredimos.
    const paymentUpdate = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: payment.status,
      },
      data: {
        providerPaymentId: view.id,
        status: decision.paymentStatus,
        refundedAmountCents: decision.refundedAmountCents,
        providerStatus: view.status,
        providerStatusDetail: view.statusDetail,
        paymentMethodType: decision.method,
        installments: view.installments,
        approvedAt: decision.approvedAt ? new Date() : payment.approvedAt,
      },
    });
    if (paymentUpdate.count !== 1) {
      return { emailed: false as const };
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
    return {
      emailed: decision.orderStatus === "PAID" && decision.paymentStatus === "APPROVED",
      orderId: payment.orderId,
    };
  });

  if (result.emailed && "orderId" in result && result.orderId) {
    await sendPurchaseConfirmationIfNeeded(result.orderId);
  }
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
  | { ok: true; kind: "dispatch" | "resume"; currentStatus: InternalPaymentStatus; chargeApiKind: ChargeApiKind }
  | {
      ok: false;
      reason:
        | "approved"
        | "uncertain"
        | "fingerprint_mismatch"
        | "card_uncertain"
        | "api_kind_mismatch"
        | "not_found"
        | "not_open"
        | "lost_race";
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
  chargeApiKind: ChargeApiKind;
}): Promise<ClaimChargeDispatchResult> {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "payment" WHERE "id" = ${input.paymentId} FOR UPDATE`;
    const row = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!row) return { ok: false as const, reason: "not_found" as const, currentStatus: null };

    // Nunca troca de API depois que a tentativa já vinculou um mecanismo.
    if (isChargeApiKind(row.providerApiKind) && row.providerApiKind !== input.chargeApiKind) {
      return {
        ok: false as const,
        reason: "api_kind_mismatch" as const,
        currentStatus: row.status as InternalPaymentStatus,
      };
    }

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
        chargeApiKind: isChargeApiKind(row.providerApiKind) ? row.providerApiKind : input.chargeApiKind,
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
        providerApiKind: input.chargeApiKind,
        paymentMethodType: input.method === "PIX" ? "PIX" : "CREDIT_CARD",
      },
    });

    if (claimed.count === 1) {
      return {
        ok: true as const,
        kind: "dispatch" as const,
        currentStatus: row.status as InternalPaymentStatus,
        chargeApiKind: input.chargeApiKind,
      };
    }

    // Corrida: outro worker gravou o marker. Reavalia sem sobrescrever.
    const again = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!again) return { ok: false as const, reason: "not_found" as const, currentStatus: null };
    if (isChargeApiKind(again.providerApiKind) && again.providerApiKind !== input.chargeApiKind) {
      return {
        ok: false as const,
        reason: "api_kind_mismatch" as const,
        currentStatus: again.status as InternalPaymentStatus,
      };
    }
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
        chargeApiKind: isChargeApiKind(again.providerApiKind) ? again.providerApiKind : input.chargeApiKind,
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
