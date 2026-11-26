import {
  attentionOrders,
  classifyAttention,
  computeCommerceMetrics,
  filterOrdersByAccountScope,
  parseAccountScope,
  type AccountScope,
  type CommerceOrderSnap,
} from "@/lib/admin/commerce";
import { getPrisma } from "@/lib/db/prisma";

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
};

function periodBounds(periodo: string | undefined, now = new Date()): { start: Date | null; end: Date } {
  const end = now;
  if (!periodo || periodo === "tudo") return { start: null, end };
  const days = Number(periodo);
  if (!Number.isFinite(days) || days <= 0) return { start: null, end };
  return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), end };
}

export async function loadCommerceDashboard(query: CommerceListQuery, now = new Date()) {
  const prisma = getPrisma();
  const scope = parseAccountScope(query.escopo);
  const bounds = periodBounds(query.periodo, now);

  const rows = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    where: {
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
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.produto
        ? { items: { some: { titleSnapshot: { contains: query.produto, mode: "insensitive" } } } }
        : {}),
      ...(query.metodo
        ? { payments: { some: { paymentMethodType: query.metodo as never } } }
        : {}),
    },
    select: ORDER_SELECT,
  });

  const snaps = filterOrdersByAccountScope(rows.map(toSnap), scope);
  const attentionOnly = query.atencao === "1";
  const listed = attentionOnly
    ? snaps.filter((o) => classifyAttention(o, now) != null)
    : snaps;

  const metrics = computeCommerceMetrics(snaps, now);
  const attention = attentionOrders(snaps, now);

  return {
    scope,
    query,
    metrics,
    attention,
    orders: listed.map((snap) => {
      const row = rows.find((r) => r.id === snap.id)!;
      return {
        ...snap,
        user: row.user,
        items: row.items,
        reason: classifyAttention(snap, now),
      };
    }),
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

/** Visão geral: métricas commerce segregadas. */
export async function loadOverviewCommerceSplit() {
  const prisma = getPrisma();
  const [commercialOrders, testOrders, commercialPayments, testPayments, unidentifiedPaid] = await Promise.all([
    prisma.order.count({ where: { user: { isTestAccount: false } } }),
    prisma.order.count({ where: { user: { isTestAccount: true } } }),
    prisma.payment.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_REFUNDED"] }, order: { user: { isTestAccount: false } } },
      select: { status: true, amountCents: true, refundedAmountCents: true },
    }),
    prisma.payment.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_REFUNDED"] }, order: { user: { isTestAccount: true } } },
      select: { status: true, amountCents: true, refundedAmountCents: true },
    }),
    // Pedidos sem usuário classificado como teste já estão em commercial (default false).
    // Mantemos o contador explícito zero — não há pedidos “anônimos” em Order.
    Promise.resolve(0),
  ]);

  const { approvedRevenueCents } = await import("@/lib/admin/commerce");
  return {
    commercial: {
      orders: commercialOrders,
      revenueCents: approvedRevenueCents(commercialPayments),
      approvedPayments: commercialPayments.length,
    },
    tests: {
      orders: testOrders,
      revenueCents: approvedRevenueCents(testPayments),
      approvedPayments: testPayments.length,
    },
    unidentifiedPaid,
  };
}

export type { AccountScope };
