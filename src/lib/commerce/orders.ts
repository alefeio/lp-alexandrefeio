import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { isCommerceEnabled } from "@/lib/commerce/config";
import { loadCreditSources, loadOwnedLessonIds, loadSaleCatalog } from "@/lib/commerce/catalog";
import { quoteCart, type CartLine } from "@/lib/commerce/quote";
import { cartOverlapsUncertainOrder, productKey } from "@/lib/commerce/payment-guards";
import { PROVIDER_STATUS_DISPATCHED, PROVIDER_STATUS_UNKNOWN, UNCERTAIN_PAYMENT_MESSAGE } from "@/lib/commerce/provider";
import { formatPriceCents } from "@/lib/learning/money";
import { deliverPurchaseEmail } from "@/lib/email/purchase-mail";
import { Prisma } from "@/generated/prisma/client";

function origin() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}

export async function quoteForUser(userId: string | null, lines: CartLine[]) {
  if (!isCommerceEnabled()) return { ok: false as const, message: "As compras ainda não estão abertas." };
  const catalog = await loadSaleCatalog();
  const sources = userId ? await loadCreditSources(userId) : [];
  const ownedLessonIds = userId ? await loadOwnedLessonIds(userId) : [];
  return quoteCart({ lines, ...catalog, sources, ownedLessonIds });
}

export async function createOrderForUser(userId: string, lines: CartLine[], checkoutKey: string) {
  if (!isCommerceEnabled()) return { ok: false as const, message: "As compras ainda não estão abertas." };
  const prisma = getPrisma();
  const existing = await prisma.order.findUnique({ where: { checkoutKey } });
  if (existing) {
    if (existing.userId !== userId) return { ok: false as const, message: "Não foi possível abrir este pedido." };
    return { ok: true as const, orderId: existing.id, status: existing.status, totalCents: existing.totalCents };
  }
  const quote = await quoteForUser(userId, lines);
  if (!quote.ok) return quote;

  if (quote.kind !== "zero_upgrade") {
    const blocked = await findOverlappingUncertainOrder(userId, quote.items.map((item) => productKey(item.productType, item.productId)));
    if (blocked) {
      return {
        ok: false as const,
        message: UNCERTAIN_PAYMENT_MESSAGE,
        code: "payment_uncertain" as const,
        orderId: blocked,
      };
    }
  }

  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          checkoutKey,
          currency: "BRL",
          subtotalCents: quote.subtotalCents,
          creditCents: quote.creditCents,
          totalCents: quote.totalCents,
          status: quote.kind === "zero_upgrade" ? "PAID" : "PENDING_PAYMENT",
          zeroValueUpgrade: quote.kind === "zero_upgrade",
        },
      });
      for (const item of quote.items) {
        const row = await tx.orderItem.create({
          data: {
            orderId: created.id,
            productType: item.productType,
            lessonId: item.productType === "LESSON" ? item.productId : null,
            moduleId: item.productType === "MODULE" ? item.productId : null,
            courseId: item.productType === "COURSE" ? item.productId : null,
            titleSnapshot: item.title,
            listPriceCents: item.listPriceCents,
            creditAppliedCents: item.creditAppliedCents,
            finalPriceCents: item.finalPriceCents,
          },
        });
        if (item.lessonIds.length > 0) {
          await tx.orderItemLesson.createMany({
            data: item.lessonIds.map((lessonId) => ({ orderItemId: row.id, lessonId })),
          });
        }
        if (quote.kind === "zero_upgrade") await grantItem(tx, userId, row.id, item.lessonIds);
      }
      return created;
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await prisma.order.findUnique({ where: { checkoutKey } });
    if (!raced || raced.userId !== userId) return { ok: false as const, message: "Não foi possível abrir este pedido." };
    return { ok: true as const, orderId: raced.id, status: raced.status, totalCents: raced.totalCents };
  }

  if (order.status === "PAID") await sendPurchaseConfirmationIfNeeded(order.id);
  return { ok: true as const, orderId: order.id, status: order.status, totalCents: order.totalCents };
}

async function grantItem(tx: Prisma.TransactionClient, userId: string, orderItemId: string, lessonIds: string[]) {
  for (const lessonId of lessonIds) {
    await tx.entitlement.upsert({
      where: { orderItemId_lessonId: { orderItemId, lessonId } },
      create: { userId, lessonId, orderItemId, status: "ACTIVE", grantedAt: new Date() },
      update: { status: "ACTIVE", revokedAt: null },
    });
  }
}

/** Impede novo checkoutKey enquanto existir cobrança incerta sobre os mesmos produtos. */
export async function findOverlappingUncertainOrder(userId: string, cartKeys: string[]): Promise<string | null> {
  if (cartKeys.length === 0) return null;
  const candidates = await getPrisma().order.findMany({
    where: {
      userId,
      status: "PENDING_PAYMENT",
      payments: {
        some: {
          status: { in: ["PENDING", "IN_PROCESS"] },
          providerStatus: { in: [PROVIDER_STATUS_UNKNOWN, PROVIDER_STATUS_DISPATCHED] },
        },
      },
    },
    include: {
      items: { select: { productType: true, lessonId: true, moduleId: true, courseId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const order of candidates) {
    const keys = order.items
      .map((item) => {
        if (item.productType === "LESSON" && item.lessonId) return productKey("LESSON", item.lessonId);
        if (item.productType === "MODULE" && item.moduleId) return productKey("MODULE", item.moduleId);
        if (item.productType === "COURSE" && item.courseId) return productKey("COURSE", item.courseId);
        return null;
      })
      .filter((key): key is string => Boolean(key));
    if (cartOverlapsUncertainOrder({ cartKeys, uncertainOrderKeys: keys })) return order.id;
  }
  return null;
}

export async function grantOrderAccess(orderId: string) {
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    include: { items: { include: { lessons: true } } },
  });
  if (!order) return;
  await getPrisma().$transaction(async (tx) => {
    for (const item of order.items) {
      await grantItem(tx, order.userId, item.id, item.lessons.map((lesson) => lesson.lessonId));
    }
  });
}

export async function revokeOrderAccess(orderId: string) {
  const now = new Date();
  await getPrisma().entitlement.updateMany({
    where: { orderItem: { orderId }, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: now },
  });
}

/** Lock pessimista no nome físico da tabela (`@@map("order")`), não no nome do model Prisma. */
export function orderPaymentLockSql(orderId: string, userId: string) {
  return Prisma.sql`
    SELECT "id" FROM "order"
    WHERE "id" = ${orderId} AND "userId" = ${userId}
    FOR UPDATE
  `;
}

export type OpenPaymentSnapshot = {
  id: string;
  idempotencyKey: string;
  amountCents: number;
  providerPaymentId: string | null;
  providerStatus: string | null;
  providerStatusDetail: string | null;
  status: string;
};

export type PaymentAttemptDecision =
  | { action: "reuse_provider"; payment: OpenPaymentSnapshot }
  | { action: "continue_same"; payment: OpenPaymentSnapshot }
  | { action: "resume_idempotent"; payment: OpenPaymentSnapshot }
  | { action: "create_new" };

/**
 * Decide o que fazer com a tentativa aberta.
 * Nunca cancela automaticamente uma tentativa ainda incerta para abrir outra chave.
 */
export function decidePaymentAttempt(open: OpenPaymentSnapshot | null): PaymentAttemptDecision {
  if (!open) return { action: "create_new" };
  if (open.providerPaymentId) return { action: "reuse_provider", payment: open };
  if (open.providerStatus === "outcome_unknown" || open.providerStatus === "charge_dispatched") {
    // Mesma chave/idempotência; payOrderAction só reenvia se a impressão coincidir (Pix estável).
    return { action: "resume_idempotent", payment: open };
  }
  // PENDING virgem: reutiliza a mesma linha/chave (dois cliques / retry de UI sem nova cobrança).
  return { action: "continue_same", payment: open };
}

export async function preparePaymentAttempt(userId: string, orderId: string) {
  if (!isCommerceEnabled()) return { ok: false as const, message: "As compras ainda não estão abertas.", code: "commerce_disabled" as const };
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(orderPaymentLockSql(orderId, userId));
    if (locked.length === 0) {
      return { ok: false as const, message: "Pedido não encontrado.", code: "not_found" as const };
    }

    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return { ok: false as const, message: "Pedido não encontrado.", code: "not_found" as const };
    if (order.status === "PAID") {
      return { ok: false as const, message: "Este pedido já foi pago.", code: "already_paid" as const };
    }
    if (order.status !== "PENDING_PAYMENT" || order.totalCents <= 0) {
      return { ok: false as const, message: "Este pedido não aceita uma nova cobrança.", code: "not_chargeable" as const };
    }

    const openRow = await tx.payment.findFirst({
      where: { orderId: order.id, status: { in: ["PENDING", "IN_PROCESS"] } },
      orderBy: { createdAt: "desc" },
    });
    const open: OpenPaymentSnapshot | null = openRow
      ? {
          id: openRow.id,
          idempotencyKey: openRow.idempotencyKey,
          amountCents: openRow.amountCents,
          providerPaymentId: openRow.providerPaymentId,
          providerStatus: openRow.providerStatus,
          providerStatusDetail: openRow.providerStatusDetail,
          status: openRow.status,
        }
      : null;

    const decision = decidePaymentAttempt(open);
    if (decision.action === "reuse_provider" || decision.action === "continue_same" || decision.action === "resume_idempotent") {
      return {
        ok: true as const,
        paymentId: decision.payment.id,
        idempotencyKey: decision.payment.idempotencyKey,
        amountCents: decision.payment.amountCents,
        mode: decision.action,
        storedFingerprint: decision.payment.providerStatusDetail?.startsWith("fp:")
          ? decision.payment.providerStatusDetail.slice(3)
          : null,
      };
    }

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        provider: "MERCADO_PAGO",
        idempotencyKey: randomUUID(),
        amountCents: order.totalCents,
        status: "PENDING",
      },
    });
    return {
      ok: true as const,
      paymentId: payment.id,
      idempotencyKey: payment.idempotencyKey,
      amountCents: payment.amountCents,
      mode: "fresh" as const,
      storedFingerprint: null,
    };
  });
}

export async function sendPurchaseConfirmationIfNeeded(orderId: string) {
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    include: { user: { select: { email: true } }, items: true },
  });
  if (!order || order.status !== "PAID" || order.confirmationEmailSentAt) return { sent: false };
  const claim = await getPrisma().order.updateMany({
    where: { id: orderId, status: "PAID", confirmationEmailSentAt: null },
    data: { confirmationEmailSentAt: new Date() },
  });
  if (claim.count !== 1) return { sent: false };
  try {
    await deliverPurchaseEmail({
      to: order.user.email,
      items: order.items.map((item) => item.titleSnapshot),
      totalLabel: formatPriceCents(order.totalCents),
      learnUrl: `${origin()}/app/aprendizado`,
    });
    return { sent: true };
  } catch (error) {
    await getPrisma().order.update({ where: { id: orderId }, data: { confirmationEmailSentAt: null } });
    console.error("purchase email failed", { name: error instanceof Error ? error.name : "Error" });
    return { sent: false };
  }
}

export async function getOrderForUser(userId: string, orderId: string) {
  return getPrisma().order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { include: { lesson: { select: { slug: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listOrdersForUser(userId: string) {
  return getPrisma().order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: { include: { lesson: { select: { slug: true } } } } },
  });
}
