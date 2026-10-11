import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchaseBeacon } from "@/components/commerce/PurchaseBeacon";
import { RefreshPayment } from "@/components/commerce/RefreshPayment";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { getOrderForUser } from "@/lib/commerce/orders";
import { fetchPixPresentation } from "@/lib/commerce/provider";
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
  const pending = order.status === "PENDING_PAYMENT";
  const pix = pending && payment?.providerPaymentId && payment.paymentMethodType === "PIX"
    ? await fetchPixPresentation(payment.providerPaymentId)
    : null;
  const item = order.items[0];

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
      {order.zeroValueUpgrade ? <p className="mt-3 text-sm text-muted">Upgrade sem cobrança nova, coberto pelo que você já tinha pago.</p> : null}
      <ul className="mt-6 space-y-2 text-base">
        {order.items.map((row) => (
          <li key={row.id}>{row.titleSnapshot}</li>
        ))}
      </ul>
      <p className="mt-6 text-base">Subtotal {formatPriceCents(order.subtotalCents)}.</p>
      <p>Crédito {formatPriceCents(order.creditCents)}.</p>
      <p><strong>Total {formatPriceCents(order.totalCents)}.</strong></p>
      {payment ? (
        <p className="mt-4 text-sm text-muted">
          Pagamento {PAYMENT_STATUS[payment.status] ?? "em atualização"}
          {payment.paymentMethodType === "PIX" ? " · Pix" : ""}
          {payment.paymentMethodType === "CREDIT_CARD" ? " · Cartão" : ""}
          {payment.installments && payment.installments > 1 ? ` · ${payment.installments} parcelas` : ""}
        </p>
      ) : null}
      {pix ? (
        <div className="mt-6">
          <p className="text-sm">Pix pendente. A aula só abre depois da confirmação.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mt-3 h-48 w-48" alt="QR Code do Pix" src={`data:image/png;base64,${pix.image}`} />
          <p className="mt-3 break-all text-sm">{pix.copy}</p>
        </div>
      ) : null}
      <RefreshPayment orderId={order.id} pending={pending} />
      {order.status === "PAID" ? (
        <Link className="mt-6 inline-block text-sm underline underline-offset-4" href="/app/aprendizado">Continuar aprendendo</Link>
      ) : null}
    </Container>
  );
}
