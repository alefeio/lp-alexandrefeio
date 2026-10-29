import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { listOrdersForUser } from "@/lib/commerce/orders";
import { paidOrderStart } from "@/lib/commerce/purchase-cta";
import { formatPriceCents } from "@/lib/learning/money";

export const metadata = { title: "Compras" };

const STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NEEDS_REVIEW: "Em revisão",
};

export default async function PurchasesPage() {
  const session = await requireSession();
  const orders = await listOrdersForUser(session.user.id);
  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Compras</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Histórico</h1>
      {orders.length === 0 ? <p className="mt-6 text-base">Nenhuma compra ainda.</p> : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => {
            const start = order.status === "PAID"
              ? paidOrderStart(order.items.map((item) => ({ productType: item.productType, lessonSlug: item.lesson?.slug ?? null })))
              : null;
            return (
            <li key={order.id} className="rounded-lg border border-border p-4">
              <p className="text-sm text-muted">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(order.createdAt)}</p>
              <p className="mt-2 font-medium">{order.items.map((item) => item.titleSnapshot).join(", ")}</p>
              <p className="mt-1 text-sm">{formatPriceCents(order.totalCents)} · {STATUS[order.status] ?? order.status}</p>
              {start ? (
                <p className="mt-2 text-sm">
                  Acesso liberado.{" "}
                  <Link className="underline underline-offset-4" href={start.href}>
                    {start.cta}
                  </Link>
                </p>
              ) : null}
              <Link className="mt-3 inline-block text-sm underline underline-offset-4" href={`/app/compras/${order.id}`}>Ver pedido</Link>
            </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
