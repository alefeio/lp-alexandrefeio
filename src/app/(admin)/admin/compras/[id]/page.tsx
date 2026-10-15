import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { formatAdminDate } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { formatPriceCents } from "@/lib/learning/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido", robots: { index: false, follow: false } };

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NEEDS_REVIEW: "Em revisão",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const order = await getPrisma().order.findUnique({
    where: { id },
    select: {
      status: true,
      totalCents: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
      items: { select: { id: true, titleSnapshot: true, finalPriceCents: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, provider: true, amountCents: true, createdAt: true },
      },
    },
  });
  if (!order) notFound();

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Pedido</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{ORDER_STATUS[order.status] ?? order.status}</h1>
      <p className="mt-3 text-sm text-muted">{formatAdminDate(order.createdAt)}</p>
      <p className="mt-2 text-sm">
        {order.user.name} · {order.user.email}
        {" · "}
        <Link className="underline underline-offset-4" href={`/admin/usuarios/${order.user.id}`}>Ver usuário</Link>
      </p>
      <ul className="mt-6 space-y-2">
        {order.items.map((item) => (
          <li key={item.id}>{item.titleSnapshot} · {formatPriceCents(item.finalPriceCents)}</li>
        ))}
      </ul>
      <p className="mt-4">Total {formatPriceCents(order.totalCents)}</p>
      <ul className="mt-4 space-y-1 text-sm text-muted">
        {order.payments.map((payment) => (
          <li key={payment.id}>{payment.status} · {payment.provider} · {formatPriceCents(payment.amountCents)}</li>
        ))}
      </ul>
    </Container>
  );
}
