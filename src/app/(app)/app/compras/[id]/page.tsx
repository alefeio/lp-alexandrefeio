import { notFound } from "next/navigation";
import { PurchaseBeacon } from "@/components/commerce/PurchaseBeacon";
import { PixPaymentPanel } from "@/components/commerce/PixPaymentPanel";
import { PurchaseJourneyActions } from "@/components/commerce/PurchaseJourneyActions";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { canCancelAbandonedCheckout } from "@/lib/commerce/payment-guards";
import { getOrderForUser } from "@/lib/commerce/orders";
import { decidePurchaseJourney } from "@/lib/commerce/purchase-journey";
import { paidOrderStart } from "@/lib/commerce/purchase-cta";
import { isChargeApiKind, legacyChargeApiKind } from "@/lib/commerce/charge-api";
import { fetchPixPresentation, hasPresentablePix } from "@/lib/commerce/provider";
import { formatPriceCents } from "@/lib/learning/money";

export const metadata = { title: "Pedido" };

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NEEDS_REVIEW: "Em revisão",
};

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROCESS: "Em processamento",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PARTIALLY_REFUNDED: "Reembolso parcial",
  CHARGED_BACK: "Chargeback",
};

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const order = await getOrderForUser(session.user.id, id);
  if (!order) notFound();
  const payment = order.payments[0] ?? null;
  const abandonable = canCancelAbandonedCheckout({
    orderStatus: order.status,
    payments: order.payments.map((row) => ({
      status: row.status,
      providerStatus: row.providerStatus,
      providerPaymentId: row.providerPaymentId,
    })),
  });
  const journey = decidePurchaseJourney({
    orderStatus: order.status,
    payments: order.payments.map((row) => ({
      status: row.status,
      providerStatus: row.providerStatus,
      providerPaymentId: row.providerPaymentId,
      paymentMethodType: row.paymentMethodType,
    })),
    abandonable,
  });
  const awaitingPix = journey.kind === "pix_pending" && Boolean(payment?.providerPaymentId);
  const pixApiKind = isChargeApiKind(payment?.providerApiKind) ? payment.providerApiKind : legacyChargeApiKind();
  const pix =
    awaitingPix && payment?.providerPaymentId
      ? await fetchPixPresentation(payment.providerPaymentId, pixApiKind)
      : null;
  const item = order.items[0];
  const start =
    order.status === "PAID"
      ? paidOrderStart(order.items.map((row) => ({ productType: row.productType, lessonSlug: row.lesson?.slug ?? null })))
      : null;

  return (
    <Container className="max-w-2xl">
      <PurchaseBeacon
        orderId={order.id}
        totalCents={order.totalCents}
        itemType={item?.productType ?? "LESSON"}
        itemSlug={null}
        paid={order.status === "PAID"}
      />
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Pedido</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{ORDER_STATUS[order.status] ?? "Pedido"}</h1>
      {order.zeroValueUpgrade ? (
        <p className="mt-3 text-sm text-muted">Upgrade sem cobrança nova, coberto pelo que você já tinha pago.</p>
      ) : null}
      <ul className="mt-6 space-y-2 text-base">
        {order.items.map((row) => (
          <li key={row.id}>{row.titleSnapshot}</li>
        ))}
      </ul>
      <p className="mt-6 text-base">Subtotal {formatPriceCents(order.subtotalCents)}.</p>
      <p>Crédito {formatPriceCents(order.creditCents)}.</p>
      <p>
        <strong>Total {formatPriceCents(order.totalCents)}.</strong>
      </p>
      {payment ? (
        <p className="mt-4 text-sm text-muted">
          Pagamento {PAYMENT_STATUS[payment.status] ?? "em atualização"}
          {payment.paymentMethodType === "PIX" ? " · Pix" : ""}
          {payment.paymentMethodType === "CREDIT_CARD" ? " · Cartão" : ""}
          {payment.installments && payment.installments > 1 ? ` · ${payment.installments} parcelas` : ""}
        </p>
      ) : null}
      {awaitingPix ? (
        <PixPaymentPanel
          copy={pix?.copy}
          image={pix?.image}
          ticketUrl={pix?.ticketUrl}
          missing={!hasPresentablePix(pix)}
        />
      ) : null}
      <PurchaseJourneyActions
        orderId={order.id}
        journey={journey}
        accessHref={start?.href}
        accessCta={start?.cta}
      />
    </Container>
  );
}
