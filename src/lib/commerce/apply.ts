import { getPrisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
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
import { selectPaymentForProviderView } from "@/lib/commerce/payment-match";
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
  return reconcileFetchedProviderView(view, chargeApiKind);
}

type ApplyProviderResult =
  | { bound: true; emailed: boolean; orderId: string }
  | { bound: false; emailed: false; reason: string };

/**
 * Reconcilia um view já obtido via GET remoto (webhook/HTTP).
 * Match + bind do ID remoto na mesma transação (atualização condicional).
 */
export async function reconcileFetchedProviderView(
  view: ProviderPaymentView,
  chargeApiKind: ChargeApiKind,
) {
  const prisma = getPrisma();
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "order" WHERE "id" = ${view.externalReference} FOR UPDATE`;
    await tx.$queryRaw`
      SELECT "id" FROM "payment"
      WHERE "providerPaymentId" = ${view.id}
         OR ("orderId" = ${view.externalReference} AND "providerPaymentId" IS NULL)
      FOR UPDATE
    `;

    const locked = await tx.payment.findMany({
      where: {
        OR: [
          { providerPaymentId: view.id },
          { orderId: view.externalReference, providerPaymentId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (locked.length === 0) {
      return { ok: false as const, message: "Este aviso não corresponde a um pedido local." };
    }

    const selected = selectPaymentForProviderView({
      candidates: locked.map((row) => ({
        id: row.id,
        orderId: row.orderId,
        providerPaymentId: row.providerPaymentId,
        providerApiKind: row.providerApiKind,
        status: row.status,
        amountCents: row.amountCents,
        paymentMethodType: row.paymentMethodType,
        providerStatus: row.providerStatus,
        createdAt: row.createdAt,
      })),
      view,
      chargeApiKind,
    });
    if (!selected.ok) {
      return { ok: false as const, message: selected.reason };
    }

    const applied = await applyProviderViewInTx(tx, selected.paymentId, view);
    if (!applied.bound) {
      return { ok: false as const, message: applied.reason };
    }
    return {
      ok: true as const,
      orderId: applied.orderId,
      emailed: applied.emailed,
    };
  });

  if (!outcome.ok) return outcome;
  if (outcome.emailed) {
    await sendPurchaseConfirmationIfNeeded(outcome.orderId);
  }
  return { ok: true as const, orderId: outcome.orderId };
}

export async function applyProviderView(paymentId: string, view: ProviderPaymentView) {
  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => applyProviderViewInTx(tx, paymentId, view));
  if (result.bound && result.emailed) {
    await sendPurchaseConfirmationIfNeeded(result.orderId);
  }
  return result;
}

async function applyProviderViewInTx(
  tx: Prisma.TransactionClient,
  paymentId: string,
  view: ProviderPaymentView,
): Promise<ApplyProviderResult> {
  await tx.$queryRaw`SELECT "id" FROM "payment" WHERE "id" = ${paymentId} FOR UPDATE`;
  const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) return { bound: false, emailed: false, reason: "Tentativa local não encontrada." };

  if (shouldIgnoreStaleProviderStatus(payment.status as InternalPaymentStatus, view.status)) {
    return { bound: true, emailed: false, orderId: payment.orderId };
  }

  // Já vinculado a outro ID remoto — não sobrescreve.
  if (payment.providerPaymentId && payment.providerPaymentId !== view.id) {
    return {
      bound: false,
      emailed: false,
      reason: "Esta tentativa já está vinculada a outro identificador remoto.",
    };
  }

  const granted = await tx.entitlement.count({
    where: { orderItem: { orderId: payment.orderId }, status: "ACTIVE" },
  });
  const claimedMethod =
    payment.paymentMethodType === "PIX" || payment.paymentMethodType === "CREDIT_CARD"
      ? payment.paymentMethodType
      : null;
  let decision = reconcileDecision({
    orderId: payment.orderId,
    orderStatus: payment.order.status,
    orderTotalCents: payment.order.totalCents,
    paymentStatus: payment.status as InternalPaymentStatus,
    paymentAmountCents: payment.amountCents,
    provider: view,
    alreadyGranted: granted > 0,
    expectedMethod: claimedMethod,
  });

  if (!mayOverwritePaymentStatus(payment.status as InternalPaymentStatus, decision.paymentStatus)) {
    decision = {
      ...decision,
      paymentStatus: payment.status as InternalPaymentStatus,
      orderStatus: payment.order.status === "PAID" ? "PAID" : decision.orderStatus,
      grant: false,
      revoke: false,
      ignore: true,
      // Divergência de método não pode ser apagada por ignore de status.
      needsReview: decision.needsReview,
      method: claimedMethod ?? decision.method,
    };
  }

  const order = await tx.order.findUnique({
    where: { id: payment.orderId },
    include: { items: { include: { lessons: true } } },
  });
  if (!order) return { bound: false, emailed: false, reason: "Pedido local não encontrado." };

  // Bind atômico: só null→id ou mesmo id. Método do claim nunca é substituído.
  const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: payment.status,
      OR: [{ providerPaymentId: null }, { providerPaymentId: view.id }],
    },
    data: {
      providerPaymentId: view.id,
      status: decision.paymentStatus,
      refundedAmountCents: decision.refundedAmountCents,
      providerStatus: view.status,
      providerStatusDetail: view.statusDetail,
      ...(claimedMethod ? {} : decision.method ? { paymentMethodType: decision.method } : {}),
      installments: view.installments,
      approvedAt: decision.approvedAt ? new Date() : payment.approvedAt,
    },
  });
  if (paymentUpdate.count !== 1) {
    return {
      bound: false,
      emailed: false,
      reason: "Não foi possível vincular o identificador remoto a esta tentativa.",
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
  return {
    bound: true,
    emailed: decision.orderStatus === "PAID" && decision.paymentStatus === "APPROVED",
    orderId: payment.orderId,
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
