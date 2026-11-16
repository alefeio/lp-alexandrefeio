import { getPrisma } from "@/lib/db/prisma";
import { sendPurchaseConfirmationIfNeeded } from "@/lib/commerce/orders";
import { mayOverwritePaymentStatus, shouldIgnoreStaleProviderStatus } from "@/lib/commerce/payment-guards";
import { fetchProviderPayment } from "@/lib/commerce/provider";
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
