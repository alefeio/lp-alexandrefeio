import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { loadAdminOrders } from "@/lib/admin/load-operations";
import { EMPTY_PURCHASES, formatAdminDate } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/auth/session";
import { formatPriceCents } from "@/lib/learning/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compras", robots: { index: false, follow: false } };

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Pendente",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  NEEDS_REVIEW: "Em revisão",
};

export default async function AdminOrdersPage() {
  const session = await requireAdmin();
  if (!session) return null;
  const orders = await loadAdminOrders();

  return (
    <Container>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Compras</h1>
      {orders.length === 0 ? <p className="mt-6 text-sm text-muted">{EMPTY_PURCHASES}</p> : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-[0.08em] text-muted">
              <tr>
                {["Data", "Usuário", "Produto", "Valor", "Status", ""].map((heading) => (
                  <th key={heading || "acao"} className="px-2 py-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-border">
                  <td className="px-2 py-3">
                    <Link className="underline underline-offset-4" href={`/admin/compras/${order.id}`}>{formatAdminDate(order.createdAt)}</Link>
                  </td>
                  <td className="px-2 py-3">
                    <span className="block">{order.user.name}</span>
                    <span className="text-muted">{order.user.email}</span>
                  </td>
                  <td className="px-2 py-3">{order.items.map((item) => item.titleSnapshot).join(", ") || "Sem item"}</td>
                  <td className="px-2 py-3">{formatPriceCents(order.totalCents)}</td>
                  <td className="px-2 py-3">{ORDER_STATUS[order.status] ?? order.status}</td>
                  <td className="px-2 py-3">
                    <Link className="underline underline-offset-4" href={`/admin/usuarios/${order.user.id}`}>Ver usuário</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Container>
  );
}
