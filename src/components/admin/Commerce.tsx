import Link from "next/link";
import type { ReactNode } from "react";
import {
  ACCOUNT_SCOPE_LABEL,
  ATTENTION_LABEL,
  CONVERSION_DENOMINATOR_NOTE,
  commerceHref,
  formatAdminDateTime,
  maskRemoteId,
  providerRefusalMessage,
  type AccountScope,
  type AttentionReason,
} from "@/lib/admin/commerce";
import {
  inspectMercadoPagoPaymentAction,
  reconcileAdminPaymentAction,
  setUserTestAccountAction,
} from "@/lib/admin/commerce-actions";
import { formatPriceCents } from "@/lib/learning/money";

const ORDER_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Pendente",
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
  PARTIALLY_REFUNDED: "Parcialmente reembolsado",
  CHARGED_BACK: "Chargeback",
};

function Status({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded border border-border px-2 py-0.5 text-xs">{children}</span>;
}

export function CommerceScopeTabs({ scope }: { scope: AccountScope }) {
  return (
    <nav className="mt-4 flex flex-wrap gap-3 text-sm" aria-label="Escopo comercial">
      {(["commercial", "tests", "all"] as const).map((value) => (
        <Link
          key={value}
          href={commerceHref({ scope: value })}
          className={scope === value ? "font-medium text-foreground underline underline-offset-4" : "text-muted underline underline-offset-4"}
        >
          {ACCOUNT_SCOPE_LABEL[value]}
        </Link>
      ))}
    </nav>
  );
}

export function CommerceMetricsGrid({
  metrics,
}: {
  metrics: {
    approvedRevenueCents: number;
    pendingOrdersCents: number;
    paidOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    totalOrders: number;
    conversionRate: number | null;
    ordersWithRejectedAttempts: number;
    attentionCount: number;
  };
}) {
  const cards = [
    { label: "Receita aprovada", value: formatPriceCents(metrics.approvedRevenueCents) },
    { label: "Pedidos pendentes (valor)", value: formatPriceCents(metrics.pendingOrdersCents) },
    { label: "Pedidos pagos", value: String(metrics.paidOrders) },
    { label: "Pedidos cancelados", value: String(metrics.cancelledOrders) },
    { label: "Reembolsos", value: String(metrics.refundedOrders) },
    {
      label: "Taxa de conversão",
      value: metrics.conversionRate == null ? "—" : `${(metrics.conversionRate * 100).toFixed(1)}%`,
    },
    { label: "Com tentativas recusadas", value: String(metrics.ordersWithRejectedAttempts) },
    { label: "Precisam de atenção", value: String(metrics.attentionCount) },
  ];
  return (
    <div className="mt-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.label} className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted">{card.label}</p>
            <p className="mt-2 text-lg font-medium tabular-nums">{card.value}</p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{CONVERSION_DENOMINATOR_NOTE}</p>
    </div>
  );
}

export function CommerceFilters({
  scope,
  query,
}: {
  scope: AccountScope;
  query: {
    periodo?: string;
    usuario?: string;
    produto?: string;
    status?: string;
    metodo?: string;
    atencao?: string;
  };
}) {
  return (
    <form className="mt-6 flex flex-wrap items-end gap-3 text-sm" method="get">
      {scope !== "commercial" ? <input type="hidden" name="escopo" value={scope} /> : null}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Período</span>
        <select name="periodo" defaultValue={query.periodo ?? "tudo"} className="rounded border border-border bg-background px-2 py-1.5">
          <option value="tudo">Tudo</option>
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Usuário</span>
        <input name="usuario" defaultValue={query.usuario ?? ""} placeholder="Nome, e-mail ou id" className="rounded border border-border bg-background px-2 py-1.5" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Produto</span>
        <input name="produto" defaultValue={query.produto ?? ""} className="rounded border border-border bg-background px-2 py-1.5" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Status</span>
        <select name="status" defaultValue={query.status ?? ""} className="rounded border border-border bg-background px-2 py-1.5">
          <option value="">Todos</option>
          {Object.entries(ORDER_STATUS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Método</span>
        <select name="metodo" defaultValue={query.metodo ?? ""} className="rounded border border-border bg-background px-2 py-1.5">
          <option value="">Todos</option>
          <option value="PIX">Pix</option>
          <option value="CREDIT_CARD">Cartão</option>
        </select>
      </label>
      <label className="flex items-center gap-2 pb-1.5">
        <input type="checkbox" name="atencao" value="1" defaultChecked={query.atencao === "1"} />
        <span>Só atenção</span>
      </label>
      <button type="submit" className="rounded border border-border px-3 py-1.5">Filtrar</button>
    </form>
  );
}

export function CommerceOrdersTable({
  orders,
}: {
  orders: Array<{
    id: string;
    status: string;
    totalCents: number;
    createdAt: Date;
    isTestAccount: boolean;
    productTitles: string[];
    reason: AttentionReason | null;
    user: { id: string; name: string; email: string; isTestAccount: boolean };
  }>;
}) {
  if (orders.length === 0) {
    return <p className="mt-6 text-sm text-muted">Nenhum pedido neste filtro.</p>;
  }
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-[0.08em] text-muted">
          <tr>
            {["Data", "Usuário", "Produto", "Valor", "Status", "Atenção", ""].map((h) => (
              <th key={h || "a"} className="px-2 py-3 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-border align-top">
              <td className="px-2 py-3">
                <Link className="underline underline-offset-4" href={`/admin/compras/${order.id}`}>
                  {formatAdminDateTime(order.createdAt)}
                </Link>
              </td>
              <td className="px-2 py-3">
                <span className="block">{order.user.name}</span>
                <span className="text-muted">{order.user.email}</span>
                {order.isTestAccount ? <span className="mt-1 block text-xs text-muted">Conta de teste</span> : null}
              </td>
              <td className="px-2 py-3">{order.productTitles.join(", ") || "Sem item"}</td>
              <td className="px-2 py-3 tabular-nums">{formatPriceCents(order.totalCents)}</td>
              <td className="px-2 py-3">{ORDER_STATUS[order.status] ?? order.status}</td>
              <td className="px-2 py-3">{order.reason ? ATTENTION_LABEL[order.reason] : "—"}</td>
              <td className="px-2 py-3">
                <Link className="underline underline-offset-4" href={`/admin/usuarios/${order.user.id}`}>Usuário</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TestAccountToggle({
  userId,
  isTestAccount,
}: {
  userId: string;
  isTestAccount: boolean;
}) {
  return (
    <form action={setUserTestAccountAction} className="mt-4 rounded-lg border border-border p-4 text-sm">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="isTestAccount" value={isTestAccount ? "0" : "1"} />
      <p className="font-medium">Classificação comercial</p>
      <p className="mt-1 text-muted">
        {isTestAccount
          ? "Esta conta está marcada como teste. Não entra na visão comercial por padrão."
          : "Conta comercial (padrão). Marque como teste apenas com confirmação do proprietário."}
      </p>
      <button type="submit" className="mt-3 rounded border border-border px-3 py-1.5">
        {isTestAccount ? "Desmarcar como teste" : "Marcar como teste"}
      </button>
    </form>
  );
}

export function PaymentAttemptHistory({
  payments,
}: {
  payments: Array<{
    id: string;
    status: string;
    amountCents: number;
    paymentMethodType: string | null;
    providerPaymentId: string | null;
    providerStatus: string | null;
    providerStatusDetail: string | null;
    originChannel: string | null;
    originCorrelationId: string | null;
    originDeviceCategory: string | null;
    createdAt: Date;
    updatedAt: Date;
    approvedAt: Date | null;
  }>;
}) {
  if (payments.length === 0) {
    return <p className="mt-3 text-sm text-muted">Nenhuma tentativa registrada.</p>;
  }
  return (
    <ol className="mt-4 space-y-4">
      {payments.map((payment, index) => {
        const refusal = providerRefusalMessage(payment.providerStatusDetail);
        return (
          <li key={payment.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Tentativa {payments.length - index}</span>
              <Status>{PAYMENT_STATUS[payment.status] ?? payment.status}</Status>
              {payment.paymentMethodType ? <Status>{payment.paymentMethodType}</Status> : null}
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-muted">Criada</dt><dd>{formatAdminDateTime(payment.createdAt)}</dd></div>
              <div><dt className="text-muted">Última atualização</dt><dd>{formatAdminDateTime(payment.updatedAt)}</dd></div>
              <div><dt className="text-muted">Aprovação</dt><dd>{formatAdminDateTime(payment.approvedAt)}</dd></div>
              <div><dt className="text-muted">Valor</dt><dd>{formatPriceCents(payment.amountCents)}</dd></div>
              <div><dt className="text-muted">Status local</dt><dd>{PAYMENT_STATUS[payment.status] ?? payment.status}</dd></div>
              <div><dt className="text-muted">Status provedor</dt><dd>{payment.providerStatus ?? "—"}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Motivo / detalhe</dt>
                <dd>
                  {refusal.message}
                  {refusal.code ? <span className="ml-2 font-mono text-xs text-muted">[{refusal.code}]</span> : null}
                </dd>
              </div>
              <div><dt className="text-muted">Id remoto</dt><dd className="font-mono text-xs">{maskRemoteId(payment.providerPaymentId)}</dd></div>
              <div>
                <dt className="text-muted">Origem (prospectiva)</dt>
                <dd>
                  {payment.originChannel ?? "não registrada"}
                  {payment.originDeviceCategory ? ` · ${payment.originDeviceCategory}` : ""}
                  {payment.originCorrelationId ? (
                    <span className="ml-2 font-mono text-xs text-muted">{maskRemoteId(payment.originCorrelationId)}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={inspectMercadoPagoPaymentAction}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <button type="submit" className="rounded border border-border px-3 py-1.5" disabled={!payment.providerPaymentId}>
                  Consultar Mercado Pago
                </button>
              </form>
              <form action={reconcileAdminPaymentAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="paymentId" value={payment.id} />
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" name="confirm" value="1" required />
                  Confirmo reconciliação
                </label>
                <button type="submit" className="rounded border border-border px-3 py-1.5" disabled={!payment.providerPaymentId}>
                  Reconciliar pagamento
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function AttentionActions({
  reason,
  user,
}: {
  reason: AttentionReason | null;
  user: { id: string; name: string; email: string };
}) {
  if (!reason) return null;
  return (
    <section className="mt-8 rounded-lg border border-border p-4 text-sm">
      <h2 className="font-semibold">Recuperação comercial</h2>
      <p className="mt-2 text-muted">{ATTENTION_LABEL[reason]}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        {reason === "pix_waiting" ? <li>Aguardar transferência ou reconciliar após confirmação no provedor.</li> : null}
        {reason === "payment_rejected" ? <li>Contato manual com o comprador; não criar nova cobrança pela área admin.</li> : null}
        {reason === "abandoned" ? <li>Pedido sem cobrança aberta há mais de 48h — contato manual se fizer sentido.</li> : null}
        {reason === "outcome_unknown" ? <li>Consultar Mercado Pago e reconciliar somente com confirmação.</li> : null}
        {reason === "needs_review" ? <li>Revisar divergência financeira antes de qualquer liberação.</li> : null}
        {reason === "charge_expired" ? <li>Cobrança expirada confirmada — orientar nova tentativa no checkout do comprador.</li> : null}
      </ul>
      <p className="mt-3">
        Contato (manual, respeitando preferências/LGPD): {user.name} · {user.email}
        {" · "}
        <Link className="underline underline-offset-4" href={`/admin/usuarios/${user.id}`}>Ficha do usuário</Link>
      </p>
      <p className="mt-2 text-xs text-muted">Esta sprint não envia mensagens automaticamente.</p>
    </section>
  );
}
