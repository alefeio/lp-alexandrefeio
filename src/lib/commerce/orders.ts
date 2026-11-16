import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { isCommerceEnabled } from "@/lib/commerce/config";
import { loadCreditSources, loadOwnedLessonIds, loadSaleCatalog } from "@/lib/commerce/catalog";
import { quoteCart, type CartLine } from "@/lib/commerce/quote";
import {
  canCancelAbandonedCheckout,
  collectLessonIdsFromOrderItems,
  isUncertainProviderStatus,
  lessonSetsOverlap,
} from "@/lib/commerce/payment-guards";
import { UNCERTAIN_PAYMENT_MESSAGE } from "@/lib/commerce/provider";
import { formatPriceCents } from "@/lib/learning/money";
import { deliverPurchaseEmail } from "@/lib/email/purchase-mail";
import { Prisma } from "@/generated/prisma/client";

/** Serializa checkouts do mesmo usuário (create + prepare) entre conexões/poolers. */
export function commerceCheckoutLockSql(userId: string) {
  return Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`commerce-checkout:${userId}`}))`;
}

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
  const quote = await quoteForUser(userId, lines);
  if (!quote.ok) return quote;

  type Created = { id: string; status: string; totalCents: number };
  let order: Created;
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(commerceCheckoutLockSql(userId));

      const existing = await tx.order.findUnique({ where: { checkoutKey } });
      if (existing) {
        if (existing.userId !== userId) {
          return { kind: "error" as const, message: "Não foi possível abrir este pedido." };
        }
        return {
          kind: "existing" as const,
          order: { id: existing.id, status: existing.status, totalCents: existing.totalCents },
        };
      }

      if (quote.kind !== "zero_upgrade") {
        const cartLessonIds = quote.items.flatMap((item) => item.lessonIds);
        const blocked = await findOverlappingPendingCheckout(tx, userId, cartLessonIds);
        if (blocked) {
          return {
            kind: "blocked" as const,
            orderId: blocked.orderId,
            code: blocked.uncertain ? ("payment_uncertain" as const) : ("checkout_overlap" as const),
            message: blocked.uncertain
              ? UNCERTAIN_PAYMENT_MESSAGE
              : "Já existe um checkout aberto para este conteúdo. Conclua ou aguarde a verificação do pedido anterior.",
          };
        }
      }

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
      return { kind: "created" as const, order: { id: created.id, status: created.status, totalCents: created.totalCents } };
    });

    if (outcome.kind === "error") return { ok: false as const, message: outcome.message };
    if (outcome.kind === "blocked") {
      return {
        ok: false as const,
        message: outcome.message,
        code: outcome.code,
        orderId: outcome.orderId,
      };
    }
    order = outcome.order;
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

/**
 * Impede novo checkout enquanto existir pedido PENDING_PAYMENT com aulas sobrepostas.
 * Usa OrderItemLesson (aulas efetivas), não só chaves LESSON/MODULE/COURSE do SKU.
 */
export async function findOverlappingPendingCheckout(
  tx: Prisma.TransactionClient,
  userId: string,
  cartLessonIds: string[],
  options?: { excludeOrderId?: string },
): Promise<{ orderId: string; uncertain: boolean } | null> {
  if (cartLessonIds.length === 0) return null;
  const candidates = await tx.order.findMany({
    where: {
      userId,
      status: "PENDING_PAYMENT",
      ...(options?.excludeOrderId ? { id: { not: options.excludeOrderId } } : {}),
    },
    include: {
      items: {
        select: {
          lessonId: true,
          lessons: { select: { lessonId: true } },
        },
      },
      payments: {
        where: { status: { in: ["PENDING", "IN_PROCESS"] } },
        select: { providerStatus: true, providerPaymentId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  for (const order of candidates) {
    const orderLessonIds = collectLessonIdsFromOrderItems(order.items);
    if (!lessonSetsOverlap(cartLessonIds, orderLessonIds)) continue;
    const uncertain = order.payments.some(
      (payment) => isUncertainProviderStatus(payment.providerStatus) || Boolean(payment.providerPaymentId),
    );
    return { orderId: order.id, uncertain };
  }
  return null;
}

/** Compat: só pedidos com marker incerto e aulas sobrepostas. */
export async function findOverlappingUncertainOrder(userId: string, cartLessonIds: string[]): Promise<string | null> {
  const hit = await findOverlappingPendingCheckout(
    getPrisma() as unknown as Prisma.TransactionClient,
    userId,
    cartLessonIds,
  );
  return hit?.uncertain ? hit.orderId : null;
}

/**
 * Cancela explicitamente um checkout abandonado (sem despacho/incerteza/provider id).
 * Permite novo checkoutKey depois. Nunca toca tentativas uncertain.
 */
export async function cancelAbandonedCheckoutForUser(userId: string, orderId: string) {
  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(commerceCheckoutLockSql(userId));
    await tx.$queryRaw(orderPaymentLockSql(orderId, userId));

    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      include: {
        payments: {
          select: { id: true, status: true, providerStatus: true, providerPaymentId: true },
        },
      },
    });
    if (!order) return { ok: false as const, message: "Pedido não encontrado.", code: "not_found" as const };
    if (!canCancelAbandonedCheckout({ orderStatus: order.status, payments: order.payments })) {
      const uncertain = order.payments.some(
        (payment) =>
          Boolean(payment.providerPaymentId) || isUncertainProviderStatus(payment.providerStatus),
      );
      return {
        ok: false as const,
        message: uncertain
          ? UNCERTAIN_PAYMENT_MESSAGE
          : "Este pedido não pode ser cancelado automaticamente. Abra o pedido ou fale com o suporte.",
        code: uncertain ? ("payment_uncertain" as const) : ("not_abandonable" as const),
      };
    }

    await tx.payment.updateMany({
      where: {
        orderId: order.id,
        status: { in: ["PENDING", "IN_PROCESS"] },
        providerPaymentId: null,
        OR: [{ providerStatus: null }, { providerStatus: { notIn: ["charge_dispatched", "outcome_unknown"] } }],
      },
      data: { status: "CANCELLED", providerStatus: "checkout_abandoned" },
    });
    const cancelled = await tx.order.updateMany({
      where: { id: order.id, userId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count !== 1) {
      return { ok: false as const, message: "Não foi possível cancelar este checkout.", code: "conflict" as const };
    }
    return { ok: true as const, orderId: order.id, status: "CANCELLED" as const };
  });
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
    await tx.$executeRaw(commerceCheckoutLockSql(userId));
    const locked = await tx.$queryRaw<Array<{ id: string }>>(orderPaymentLockSql(orderId, userId));
    if (locked.length === 0) {
      return { ok: false as const, message: "Pedido não encontrado.", code: "not_found" as const };
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { lessons: { select: { lessonId: true } } } } },
    });
    if (!order) return { ok: false as const, message: "Pedido não encontrado.", code: "not_found" as const };
    if (order.status === "PAID") {
      return { ok: false as const, message: "Este pedido já foi pago.", code: "already_paid" as const };
    }
    if (order.status !== "PENDING_PAYMENT" || order.totalCents <= 0) {
      return { ok: false as const, message: "Este pedido não aceita uma nova cobrança.", code: "not_chargeable" as const };
    }

    const cartLessonIds = collectLessonIdsFromOrderItems(order.items);
    const blocked = await findOverlappingPendingCheckout(tx, userId, cartLessonIds, { excludeOrderId: order.id });
    if (blocked) {
      return {
        ok: false as const,
        message: blocked.uncertain
          ? UNCERTAIN_PAYMENT_MESSAGE
          : "Já existe um checkout aberto para este conteúdo. Conclua ou aguarde a verificação do pedido anterior.",
        code: blocked.uncertain ? ("payment_uncertain" as const) : ("checkout_overlap" as const),
      };
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
