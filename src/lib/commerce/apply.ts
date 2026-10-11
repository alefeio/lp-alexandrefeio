import { getPrisma } from "@/lib/db/prisma";
import { sendPurchaseConfirmationIfNeeded } from "@/lib/commerce/orders";
import { fetchProviderPayment } from "@/lib/commerce/provider";
import { reconcileDecision, type ProviderPaymentView } from "@/lib/commerce/reconcile";

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
  const payment = await getPrisma().payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment) return;
  const granted = await getPrisma().entitlement.count({
    where: { orderItem: { orderId: payment.orderId }, status: "ACTIVE" },
  });
  const decision = reconcileDecision({
    orderId: payment.orderId,
    orderStatus: payment.order.status,
    orderTotalCents: payment.order.totalCents,
    paymentStatus: payment.status,
    paymentAmountCents: payment.amountCents,
    provider: view,
    alreadyGranted: granted > 0,
  });

  const order = await getPrisma().order.findUnique({
    where: { id: payment.orderId },
    include: { items: { include: { lessons: true } } },
  });
  if (!order) return;

  await getPrisma().$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
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
    if (!decision.ignore) {
      await tx.order.update({ where: { id: payment.orderId }, data: { status: decision.orderStatus } });
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
  });
  if (decision.orderStatus === "PAID" && decision.paymentStatus === "APPROVED") {
    await sendPurchaseConfirmationIfNeeded(payment.orderId);
  }
}
