import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { formatPriceCents } from "@/lib/learning/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compras" };

export default async function AdminOrdersPage() {
  const session = await requireAdmin();
  if (!session) return null;
  const orders = await getPrisma().order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { email: true } } },
  });
  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Compras</h1>
      <ul className="mt-8 space-y-3 text-sm">
        {orders.map((order) => (
          <li key={order.id}>
            <Link className="underline underline-offset-4" href={`/admin/compras/${order.id}`}>
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(order.createdAt)} · {order.user.email} · {order.status} · {formatPriceCents(order.totalCents)}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
