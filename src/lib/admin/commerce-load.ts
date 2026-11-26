import {
  COMMERCE_PAGE_SIZE,
  TEMPORAL_METRICS_NOTE,
  METHOD_FILTER_NOTE,
  CONVERSION_DENOMINATOR_NOTE,
  attentionOrders,
  classifyAttention,
  computeCommerceMetrics,
  parseAccountScope,
  parseCommercePage,
  parseOrderStatusFilter,
  parsePaymentMethodFilter,
  type AccountScope,
  type CommerceOrderSnap,
} from "@/lib/admin/commerce";
import { getPrisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

const ORDER_SELECT = {
  id: true,
  status: true,
  totalCents: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  user: { select: { id: true, name: true, email: true, isTestAccount: true } },
  items: { select: { id: true, titleSnapshot: true, finalPriceCents: true } },
  payments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      status: true,
      amountCents: true,
      refundedAmountCents: true,
      paymentMethodType: true,
      providerPaymentId: true,
      providerStatus: true,
      providerStatusDetail: true,
      provider: true,
      installments: true,
      approvedAt: true,
      originChannel: true,
      originCorrelationId: true,
      originDeviceCategory: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

function toSnap(order: {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  user: { isTestAccount: boolean };
  items: Array<{ titleSnapshot: string }>;
  payments: Array<{
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
  }>;
}): CommerceOrderSnap {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    userId: order.userId,
    isTestAccount: order.user.isTestAccount,
    productTitles: order.items.map((i) => i.titleSnapshot),
    payments: order.payments.map((p) => ({
      id: p.id,
      status: p.status,
      amountCents: p.amountCents,
      refundedAmountCents: p.refundedAmountCents,
      paymentMethodType: p.paymentMethodType,
      providerPaymentId: p.providerPaymentId,
      providerStatus: p.providerStatus,
      providerStatusDetail: p.providerStatusDetail,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  };
}

export type CommerceListQuery = {
  escopo?: string;
  periodo?: string;
  usuario?: string;
  produto?: string;
  status?: string;
  metodo?: string;
  atencao?: string;
  pagina?: string;
};

function periodBounds(periodo: string | undefined, now = new Date()): { start: Date | null; end: Date } {
  const end = now;
  if (!periodo || periodo === "tudo") return { start: null, end };
  const days = Number(periodo);
  if (!Number.isFinite(days) || days <= 0) return { start: null, end };
  return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), end };
}

function accountScopeWhere(scope: AccountScope): Prisma.OrderWhereInput {
  if (scope === "commercial") return { user: { isTestAccount: false } };
  if (scope === "tests") return { user: { isTestAccount: true } };
  return {};
}

function buildOrderWhere(query: CommerceListQuery, scope: AccountScope, now: Date): {
  where: Prisma.OrderWhereInput;
  invalidStatus: boolean;
  invalidMethod: boolean;
  status: ReturnType<typeof parseOrderStatusFilter>;
  method: ReturnType<typeof parsePaymentMethodFilter>;
} {
  const bounds = periodBounds(query.periodo, now);
  const status = parseOrderStatusFilter(query.status);
  const method = parsePaymentMethodFilter(query.metodo);
  const invalidStatus = Boolean(query.status && !status);
  const invalidMethod = Boolean(query.metodo && !method);

  if (invalidStatus || invalidMethod) {
    return { where: { id: "__invalid_filter__" }, invalidStatus, invalidMethod, status, method };
  }

  const where: Prisma.OrderWhereInput = {
    ...accountScopeWhere(scope),
    ...(bounds.start ? { createdAt: { gte: bounds.start, lt: bounds.end } } : {}),
    ...(query.usuario
      ? {
          OR: [
            { user: { email: { contains: query.usuario, mode: "insensitive" } } },
            { user: { name: { contains: query.usuario, mode: "insensitive" } } },
            { userId: query.usuario },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(query.produto
      ? { items: { some: { titleSnapshot: { contains: query.produto, mode: "insensitive" } } } }
      : {}),
    // Método = qualquer tentativa do pedido (documentado em METHOD_FILTER_NOTE).
    ...(method ? { payments: { some: { paymentMethodType: method } } } : {}),
  };

  return { where, invalidStatus, invalidMethod, status, method };
}

/**
 * Agregação no universo filtrado (escopo antes da paginação).
 * Lista paginada separada. Atenção operacional limitada.
 */
export async function loadCommerceDashboard(query: CommerceListQuery, now = new Date()) {
  const prisma = getPrisma();
  const scope = parseAccountScope(query.escopo);
  const page = parseCommercePage(query.pagina);
  const { where, invalidStatus, invalidMethod } = buildOrderWhere(query, scope, now);

  if (invalidStatus || invalidMethod) {
    return {
      scope,
      query,
      metrics: computeCommerceMetrics([]),
      attention: [] as ReturnType<typeof attentionOrders>,
      orders: [],
      page: 1,
      pages: 1,
      totalFiltered: 0,
      invalidFilters: { status: invalidStatus, method: invalidMethod },
      notes: {
        conversion: CONVERSION_DENOMINATOR_NOTE,
        temporal: TEMPORAL_METRICS_NOTE,
        method: METHOD_FILTER_NOTE,
      },
    };
  }

  // Universo para métricas: todos os IDs filtrados (sem take 500).
  const metricRows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalCents: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      user: { select: { isTestAccount: true } },
      items: { select: { titleSnapshot: true } },
      payments: {
        select: {
          id: true,
          status: true,
          amountCents: true,
          refundedAmountCents: true,
          paymentMethodType: true,
          providerPaymentId: true,
          providerStatus: true,
          providerStatusDetail: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const snaps = metricRows.map(toSnap);
  const metrics = computeCommerceMetrics(snaps, now);
  const attention = attentionOrders(snaps, now).slice(0, 100);

  const attentionOnly = query.atencao === "1";
  const listUniverse = attentionOnly ? snaps.filter((o) => classifyAttention(o, now) != null) : snaps;
  const totalFiltered = listUniverse.length;
  const pages = Math.max(1, Math.ceil(totalFiltered / COMMERCE_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageIds = listUniverse
    .slice((safePage - 1) * COMMERCE_PAGE_SIZE, safePage * COMMERCE_PAGE_SIZE)
    .map((o) => o.id);

  const pageRows =
    pageIds.length === 0
      ? []
      : await prisma.order.findMany({
          where: { id: { in: pageIds } },
          select: ORDER_SELECT,
        });
  const byId = new Map(pageRows.map((r) => [r.id, r]));

  return {
    scope,
    query,
    metrics,
    attention,
    orders: pageIds.map((id) => {
      const snap = snaps.find((s) => s.id === id)!;
      const row = byId.get(id)!;
      return {
        ...snap,
        user: row.user,
        items: row.items,
        reason: classifyAttention(snap, now),
        anomalousApprovals: snap.payments.filter((p) => p.status === "APPROVED" || p.status === "PARTIALLY_REFUNDED").length > 1,
      };
    }),
    page: safePage,
    pages,
    totalFiltered,
    invalidFilters: { status: false, method: false },
    notes: {
      conversion: CONVERSION_DENOMINATOR_NOTE,
      temporal: TEMPORAL_METRICS_NOTE,
      method: METHOD_FILTER_NOTE,
    },
  };
}

export async function loadCommerceOrderDetail(orderId: string) {
  const prisma = getPrisma();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      ...ORDER_SELECT,
      items: {
        select: {
          id: true,
          titleSnapshot: true,
          finalPriceCents: true,
          entitlements: {
            select: {
              id: true,
              status: true,
              grantedAt: true,
              revokedAt: true,
              lesson: { select: { title: true } },
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const audit = await prisma.adminAuditLog.findMany({
    where: {
      OR: [
        { targetType: "order", targetId: orderId },
        { targetType: "payment", targetId: { in: order.payments.map((p) => p.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, action: true, summary: true, createdAt: true, actorUserId: true },
  });

  const entitlements = order.items.flatMap((item) =>
    item.entitlements.map((e) => ({
      ...e,
      itemTitle: item.titleSnapshot,
    })),
  );

  return { order, entitlements, audit, snap: toSnap(order) };
}

export type { AccountScope };
