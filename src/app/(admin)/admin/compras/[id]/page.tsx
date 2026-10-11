import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { formatPriceCents } from "@/lib/learning/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const order = await getPrisma().order.findUnique({
    where: { id },
    include: { user: { select: { email: true } }, items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!order) notFound();
  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{order.status}</h1>
      <p className="mt-3 text-sm text-muted">{order.user.email}</p>
      <ul className="mt-6 space-y-2">
        {order.items.map((item) => (
          <li key={item.id}>{item.titleSnapshot} · {formatPriceCents(item.finalPriceCents)}</li>
        ))}
      </ul>
      <p className="mt-4">Total {formatPriceCents(order.totalCents)}</p>
      <ul className="mt-4 space-y-1 text-sm text-muted">
        {order.payments.map((payment) => (
          <li key={payment.id}>{payment.status}{payment.providerStatus ? ` · ${payment.providerStatus}` : ""}</li>
        ))}
      </ul>
    </Container>
  );
}
