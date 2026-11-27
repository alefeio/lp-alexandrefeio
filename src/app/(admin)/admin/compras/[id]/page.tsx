import Link from "next/link";
import { notFound } from "next/navigation";
import { AttentionActions, PaymentAttemptHistory } from "@/components/admin/Commerce";
import { Container } from "@/components/ui/Container";
import { classifyAttention, formatAdminDateTime } from "@/lib/admin/commerce";
import { loadCommerceOrderDetail } from "@/lib/admin/commerce-load";
import { requireAdmin } from "@/lib/auth/session";
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
  const detail = await loadCommerceOrderDetail(id);
  if (!detail) notFound();

  const { order, entitlements, audit, snap } = detail;
  const reason = classifyAttention(snap);

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Pedido</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {ORDER_STATUS[order.status] ?? order.status}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Criado {formatAdminDateTime(order.createdAt)} · Atualizado {formatAdminDateTime(order.updatedAt)}
        {order.user.isTestAccount ? " · Conta de teste" : ""}
      </p>
      <p className="mt-2 text-sm">
        {order.user.name} · {order.user.email}
        {" · "}
        <Link className="underline underline-offset-4" href={`/admin/usuarios/${order.user.id}`}>
          Ver usuário
        </Link>
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Produto e valor</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.titleSnapshot} · {formatPriceCents(item.finalPriceCents)}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-medium">Total {formatPriceCents(order.totalCents)}</p>
      </section>

      <AttentionActions reason={reason} user={order.user} />

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Histórico de tentativas</h2>
        <p className="mt-2 text-sm text-muted">
          Apenas tentativas registradas. Não há reconstrução artificial de eventos antigos.
          Histórico de mudanças de status administrativas aparece abaixo, separado.
        </p>
        <PaymentAttemptHistory payments={order.payments} />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Entitlements</h2>
        {entitlements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum entitlement neste pedido.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {entitlements.map((e) => (
              <li key={e.id}>
                {e.lesson.title} · {e.status === "ACTIVE" ? "Ativo" : "Revogado"} ·{" "}
                {formatAdminDateTime(e.grantedAt)}
                {e.revokedAt ? ` · revogado ${formatAdminDateTime(e.revokedAt)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Auditoria administrativa</h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Sem eventos administrativos neste pedido.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {audit.map((row) => (
              <li key={row.id}>
                {formatAdminDateTime(row.createdAt)} · {row.action} · {row.summary}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}
