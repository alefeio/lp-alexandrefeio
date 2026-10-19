import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { isCommerceEnabled } from "@/lib/commerce/config";
import { loadCreditSources, loadOwnedLessonIds, loadSaleCatalog } from "@/lib/commerce/catalog";
import { quoteCart, type CartLine } from "@/lib/commerce/quote";
import { formatPriceCents } from "@/lib/learning/money";
import { deliverPurchaseEmail } from "@/lib/email/purchase-mail";
import type { Prisma } from "@/generated/prisma/client";

function origin() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
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
  const existing = await getPrisma().order.findUnique({ where: { checkoutKey } });
  if (existing) {
    if (existing.userId !== userId) return { ok: false as const, message: "Não foi possível abrir este pedido." };
    return { ok: true as const, orderId: existing.id, status: existing.status, totalCents: existing.totalCents };
  }
  const quote = await quoteForUser(userId, lines);
  if (!quote.ok) return quote;

  const order = await getPrisma().$transaction(async (tx) => {
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

export async function preparePaymentAttempt(userId: string, orderId: string) {
  if (!isCommerceEnabled()) return { ok: false as const, message: "As compras ainda não estão abertas." };
  const order = await getPrisma().order.findFirst({ where: { id: orderId, userId } });
  if (!order) return { ok: false as const, message: "Pedido não encontrado." };
  if (order.status === "PAID") return { ok: false as const, message: "Este pedido já foi pago." };
  if (order.status !== "PENDING_PAYMENT" || order.totalCents <= 0) {
    return { ok: false as const, message: "Este pedido não aceita uma nova cobrança." };
  }

  const open = await getPrisma().payment.findFirst({
    where: { orderId: order.id, status: { in: ["PENDING", "IN_PROCESS"] } },
    orderBy: { createdAt: "desc" },
  });
  if (open?.providerPaymentId) {
    return { ok: true as const, paymentId: open.id, idempotencyKey: open.idempotencyKey, amountCents: open.amountCents, reused: true };
  }
  if (open && Date.now() - open.createdAt.getTime() < 20_000) {
    return { ok: false as const, message: "O pagamento já está em andamento." };
  }
  if (open) {
    await getPrisma().payment.update({ where: { id: open.id }, data: { status: "CANCELLED" } });
  }
  const payment = await getPrisma().payment.create({
    data: {
      orderId: order.id,
      provider: "MERCADO_PAGO",
      idempotencyKey: randomUUID(),
      amountCents: order.totalCents,
      status: "PENDING",
    },
  });
  return { ok: true as const, paymentId: payment.id, idempotencyKey: payment.idempotencyKey, amountCents: payment.amountCents, reused: false };
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
    include: { items: true },
  });
}
