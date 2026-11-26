/**
 * COM-AUDIT-1 — regras puras de gestão comercial / atenção / indicadores.
 * Sem acesso ao banco. Contas de teste só entram quando o escopo pede.
 *
 * Taxa de conversão de pedidos = pedidos PAID / pedidos no filtro.
 * Denominador: pedidos (não tentativas de pagamento). Tentativas recusadas
 * não entram como receita nem como pedidos distintos.
 */

export const ADMIN_TZ = "America/Belem";

export const ACCOUNT_SCOPES = ["commercial", "tests", "all"] as const;
export type AccountScope = (typeof ACCOUNT_SCOPES)[number];

export const ACCOUNT_SCOPE_LABEL: Record<AccountScope, string> = {
  commercial: "Comercial",
  tests: "Testes",
  all: "Todos",
};

export type AttentionReason =
  | "payment_rejected"
  | "pix_waiting"
  | "charge_expired"
  | "abandoned"
  | "outcome_unknown"
  | "needs_review";

export const ATTENTION_LABEL: Record<AttentionReason, string> = {
  payment_rejected: "Pagamento recusado",
  pix_waiting: "Pix aguardando transferência",
  charge_expired: "Cobrança expirada",
  abandoned: "Pedido abandonado",
  outcome_unknown: "Resultado desconhecido",
  needs_review: "Pedido em revisão",
};

export type CommercePaymentSnap = {
  id: string;
  status: string;
  amountCents: number;
  refundedAmountCents: number;
  paymentMethodType: string | null;
  providerPaymentId: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CommerceOrderSnap = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isTestAccount: boolean;
  productTitles: string[];
  payments: CommercePaymentSnap[];
};

export type CommerceMetrics = {
  approvedRevenueCents: number;
  pendingOrdersCents: number;
  paidOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  totalOrders: number;
  conversionRate: number | null;
  ordersWithRejectedAttempts: number;
  attentionCount: number;
  /** Pedidos com mais de uma tentativa APPROVED/PARTIALLY_REFUNDED (anomalia). */
  anomalousMultiApprovedOrders: number;
};

export const ABANDONED_AFTER_MS = 48 * 60 * 60 * 1000;

export const ORDER_STATUS_FILTERS = [
  "PENDING_PAYMENT",
  "PAID",
  "CANCELLED",
  "REFUNDED",
  "NEEDS_REVIEW",
] as const;

export const PAYMENT_METHOD_FILTERS = ["PIX", "CREDIT_CARD"] as const;

export const COMMERCE_PAGE_SIZE = 50;

export function parseAccountScope(raw: string | undefined): AccountScope {
  return ACCOUNT_SCOPES.includes(raw as AccountScope) ? (raw as AccountScope) : "commercial";
}

export function parseOrderStatusFilter(raw: string | undefined): (typeof ORDER_STATUS_FILTERS)[number] | null {
  if (!raw) return null;
  return ORDER_STATUS_FILTERS.includes(raw as (typeof ORDER_STATUS_FILTERS)[number])
    ? (raw as (typeof ORDER_STATUS_FILTERS)[number])
    : null;
}

export function parsePaymentMethodFilter(raw: string | undefined): (typeof PAYMENT_METHOD_FILTERS)[number] | null {
  if (!raw) return null;
  return PAYMENT_METHOD_FILTERS.includes(raw as (typeof PAYMENT_METHOD_FILTERS)[number])
    ? (raw as (typeof PAYMENT_METHOD_FILTERS)[number])
    : null;
}

export function parseCommercePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function formatAdminDateTime(value: Date | string | null | undefined): string {
  if (!value) return "Sem registro";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: ADMIN_TZ,
  }).format(date);
}

export function filterOrdersByAccountScope(orders: CommerceOrderSnap[], scope: AccountScope): CommerceOrderSnap[] {
  if (scope === "commercial") return orders.filter((o) => !o.isTestAccount);
  if (scope === "tests") return orders.filter((o) => o.isTestAccount);
  return orders;
}

/** Receita: só APPROVED/PARTIALLY_REFUNDED, líquido. Uma linha de pagamento = uma tentativa. */
export function approvedRevenueCents(payments: Array<{ status: string; amountCents: number; refundedAmountCents: number }>): number {
  return payments.reduce((sum, payment) => {
    if (payment.status !== "APPROVED" && payment.status !== "PARTIALLY_REFUNDED") return sum;
    return sum + Math.max(0, payment.amountCents - payment.refundedAmountCents);
  }, 0);
}

export function countApprovedAttempts(payments: CommercePaymentSnap[]): number {
  return payments.filter((p) => p.status === "APPROVED" || p.status === "PARTIALLY_REFUNDED").length;
}

export function computeCommerceMetrics(orders: CommerceOrderSnap[], now = new Date()): CommerceMetrics {
  const paidOrders = orders.filter((o) => o.status === "PAID").length;
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED").length;
  const refundedOrders = orders.filter((o) => o.status === "REFUNDED").length;
  const pendingOrdersCents = orders
    .filter((o) => o.status === "PENDING_PAYMENT")
    .reduce((sum, o) => sum + o.totalCents, 0);

  const revenuePayments = orders.flatMap((o) => o.payments);
  const approvedRevenue = approvedRevenueCents(revenuePayments);

  const ordersWithRejectedAttempts = orders.filter((o) =>
    o.payments.some((p) => p.status === "REJECTED"),
  ).length;

  const anomalousMultiApprovedOrders = orders.filter((o) => countApprovedAttempts(o.payments) > 1).length;

  const attentionCount = orders.filter((o) => classifyAttention(o, now) != null).length;
  const totalOrders = orders.length;
  const conversionRate = totalOrders === 0 ? null : paidOrders / totalOrders;

  return {
    approvedRevenueCents: approvedRevenue,
    pendingOrdersCents,
    paidOrders,
    cancelledOrders,
    refundedOrders,
    totalOrders,
    conversionRate,
    ordersWithRejectedAttempts,
    attentionCount,
    anomalousMultiApprovedOrders,
  };
}

/** Estados financeiros inconclusivos — não são abandono recuperável. */
export function isInconclusivePayment(payment: CommercePaymentSnap | null): boolean {
  if (!payment) return false;
  const status = (payment.providerStatus ?? "").toLowerCase();
  if (status === "outcome_unknown" || status === "charge_dispatched") return true;
  if (payment.status === "IN_PROCESS") return true;
  if (
    (payment.status === "PENDING" || payment.status === "IN_PROCESS") &&
    !payment.providerPaymentId &&
    (status === "charge_dispatched" || status === "outcome_unknown" || status.startsWith("fp:"))
  ) {
    return true;
  }
  return false;
}

function latestPayment(order: CommerceOrderSnap): CommercePaymentSnap | null {
  if (order.payments.length === 0) return null;
  return [...order.payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

function isExpiredDetail(detail: string | null | undefined): boolean {
  if (!detail) return false;
  const d = detail.toLowerCase();
  return d.includes("expired") || d.includes("expirad");
}

/**
 * Uma razão por pedido (prioridade operacional).
 * Pix aguardando ≠ abandono. charge_dispatched / outcome_unknown ≠ abandono.
 */
export function classifyAttention(order: CommerceOrderSnap, now = new Date()): AttentionReason | null {
  if (order.status === "NEEDS_REVIEW") return "needs_review";
  if (order.status === "PAID" || order.status === "REFUNDED" || order.status === "CANCELLED") return null;

  const latest = latestPayment(order);

  if (
    latest &&
    (latest.status === "PENDING" || latest.status === "IN_PROCESS") &&
    latest.paymentMethodType === "PIX" &&
    latest.providerPaymentId &&
    !isExpiredDetail(latest.providerStatusDetail) &&
    latest.providerStatus !== "outcome_unknown"
  ) {
    return "pix_waiting";
  }

  if (isInconclusivePayment(latest)) return "outcome_unknown";

  if (latest && isExpiredDetail(latest.providerStatusDetail) && latest.status !== "APPROVED") {
    return "charge_expired";
  }

  if (latest?.status === "REJECTED" && order.status === "PENDING_PAYMENT") {
    return "payment_rejected";
  }

  if (order.status === "PENDING_PAYMENT") {
    const openWaiting =
      latest &&
      (latest.status === "PENDING" || latest.status === "IN_PROCESS") &&
      Boolean(latest.providerPaymentId);
    if (openWaiting) return null;

    // Em processamento / despacho sem resolução: nunca abandono.
    if (isInconclusivePayment(latest)) return "outcome_unknown";

    const anchor = latest?.updatedAt ?? order.updatedAt;
    if (now.getTime() - anchor.getTime() >= ABANDONED_AFTER_MS) return "abandoned";
  }

  return null;
}

export function attentionOrders(orders: CommerceOrderSnap[], now = new Date()) {
  return orders
    .map((order) => {
      const reason = classifyAttention(order, now);
      return reason ? { order, reason } : null;
    })
    .filter((row): row is { order: CommerceOrderSnap; reason: AttentionReason } => row != null);
}

/** Mensagem humana + código técnico preservado. */
export function providerRefusalMessage(statusDetail: string | null | undefined): { message: string; code: string | null } {
  const code = statusDetail?.trim() || null;
  if (!code) return { message: "Sem detalhe do provedor.", code: null };
  const lower = code.toLowerCase();
  if (lower.includes("high_risk")) {
    return { message: "Recusa por análise de risco do provedor.", code };
  }
  if (lower.includes("insufficient")) {
    return { message: "Recusa por saldo insuficiente ou limite.", code };
  }
  if (lower.includes("expired") || lower.includes("expirad")) {
    return { message: "Cobrança expirada no provedor.", code };
  }
  if (lower.includes("cc_rejected") || lower.includes("rejected")) {
    return { message: "Tentativa recusada pelo provedor.", code };
  }
  if (lower === "outcome_unknown" || lower.includes("unknown")) {
    return { message: "Resultado inconclusivo no provedor.", code };
  }
  if (lower.startsWith("fp:") || lower === "charge_dispatched") {
    return { message: "Marcador interno de despacho (não é status financeiro).", code };
  }
  return { message: "Detalhe técnico do provedor.", code };
}

export function maskRemoteId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export { classifyDeviceCategory } from "@/lib/commerce/payment-origin";

export function commerceHref(input: {
  scope?: AccountScope;
  periodo?: string;
  usuario?: string;
  produto?: string;
  status?: string;
  metodo?: string;
  atencao?: string;
  pagina?: number;
} = {}) {
  const params = new URLSearchParams();
  if (input.scope && input.scope !== "commercial") params.set("escopo", input.scope);
  if (input.periodo) params.set("periodo", input.periodo);
  if (input.usuario) params.set("usuario", input.usuario);
  if (input.produto) params.set("produto", input.produto);
  if (input.status) params.set("status", input.status);
  if (input.metodo) params.set("metodo", input.metodo);
  if (input.atencao === "1") params.set("atencao", "1");
  if (input.pagina && input.pagina > 1) params.set("pagina", String(input.pagina));
  const q = params.toString();
  return q ? `/admin/compras?${q}` : "/admin/compras";
}

export const CONVERSION_DENOMINATOR_NOTE =
  "Conversão = pedidos PAID ÷ pedidos no filtro (criação do pedido). Receita líquida = soma de tentativas APPROVED/PARTIALLY_REFUNDED (aprovação financeira), já líquida de estorno — não é a mesma métrica. Tentativas recusadas não entram. Filtro de método = qualquer tentativa do pedido com aquele método.";

export const TEMPORAL_METRICS_NOTE =
  "Período filtra pela data de criação do pedido. Receita usa pagamentos aprovados cujos pedidos entram no filtro; a data de approvedAt pode cair fora do período.";

export const METHOD_FILTER_NOTE =
  "Filtro de método corresponde a qualquer tentativa do pedido (não necessariamente a tentativa financeira efetiva).";
