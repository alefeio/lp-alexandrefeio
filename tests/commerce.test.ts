import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { canReadLessonBody, visibleBlocks } from "../src/lib/learning/access";
import { commerceAnalyticsPayload, purchaseDedupeKey } from "../src/lib/commerce/analytics";
import { isCommerceEnabled } from "../src/lib/commerce/config";
import { amountDueCents, eligibleCreditCents, quoteCart, type CreditSource, type SaleCourse, type SaleLesson, type SaleModule } from "../src/lib/commerce/quote";
import { reconcileDecision, type ProviderPaymentView } from "../src/lib/commerce/reconcile";
import { verifyMercadoPagoSignature } from "../src/lib/commerce/signature";
import { purchaseEmail } from "../src/lib/email/purchase-mail";
import { needsSession } from "../src/proxy";

loadEnv({ path: ".env.local" });

function lesson(id: string, price: number, patch: Partial<SaleLesson> = {}): SaleLesson {
  return {
    id,
    slug: id,
    title: `Aula ${id}`,
    accessType: "PAID",
    status: "PUBLISHED",
    commerceStatus: "AVAILABLE",
    priceCents: price,
    moduleId: "mod",
    courseId: "course",
    ...patch,
  };
}

function source(id: string, paid: number, lessonIds: string[]): CreditSource {
  return { orderItemId: id, finalPriceCents: paid, lessonIds };
}

const lessons = [lesson("a", 3990), lesson("b", 3990), lesson("c", 2410)];
const moduleRow: SaleModule = {
  id: "mod",
  slug: "google-ads",
  title: "Google Ads",
  status: "PUBLISHED",
  commerceStatus: "AVAILABLE",
  bundlePriceCents: 10390,
  courseId: "course",
  paidLessonIds: ["a", "b", "c"],
};
const course: SaleCourse = {
  id: "course",
  slug: "trafego",
  title: "Curso",
  status: "PUBLISHED",
  commerceStatus: "AVAILABLE",
  bundlePriceCents: 24990,
  paidLessonIds: ["a", "b", "c"],
};

function view(patch: Partial<ProviderPaymentView>): ProviderPaymentView {
  return {
    id: "mp-1",
    status: "pending",
    statusDetail: null,
    amountCents: 3990,
    currency: "BRL",
    externalReference: "order-1",
    paymentTypeId: "bank_transfer",
    installments: 1,
    refundedCents: 0,
    ...patch,
  };
}

test("preço, crédito e pacote saem do servidor", () => {
  const clientPriceIgnored = quoteCart({
    lines: [{ type: "LESSON", id: "a" }, { type: "LESSON", id: "b" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(clientPriceIgnored.ok, true);
  if (!clientPriceIgnored.ok) return;
  assert.equal(clientPriceIgnored.subtotalCents, 7980);
  assert.equal(clientPriceIgnored.totalCents, 7980);
  assert.equal(clientPriceIgnored.items.length, 2);

  const hidden = quoteCart({
    lines: [{ type: "LESSON", id: "a" }],
    lessons: [lesson("a", 3990, { commerceStatus: "NOT_FOR_SALE" })],
    modules: [],
    courses: [],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(hidden.ok, false);

  const moduleQuote = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [source("paid-lesson", 2990, ["a"])],
    ownedLessonIds: ["a"],
  });
  assert.equal(moduleQuote.ok && moduleQuote.creditCents, 2990);
  assert.equal(moduleQuote.ok && moduleQuote.totalCents, 7400);

  const courseQuote = quoteCart({
    lines: [{ type: "COURSE", id: "course" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [source("lesson-paid", 3990, ["a"]), source("module-paid", 6400, ["a", "b", "c"])],
    ownedLessonIds: ["a"],
  });
  assert.equal(courseQuote.ok && courseQuote.creditCents, 10390);
  assert.equal(courseQuote.ok && courseQuote.totalCents, 14600);
  assert.equal(eligibleCreditCents(["a", "b", "c"], [source("lesson-paid", 3990, ["a"]), source("module-paid", 10390, ["a", "b", "c"])]), 14380);
  assert.notEqual(eligibleCreditCents(["a", "b", "c"], [source("lesson-paid", 3990, ["a"]), source("module-paid", 6400, ["a", "b", "c"])]), 3990 + 10390);

  const historical = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons: [lesson("a", 4990), lesson("b", 4990), lesson("c", 4990)],
    modules: [{ ...moduleRow, bundlePriceCents: 12000 }],
    courses: [],
    sources: [source("old", 2990, ["a"])],
    ownedLessonIds: ["a"],
  });
  assert.equal(historical.ok && historical.creditCents, 2990);

  assert.equal(amountDueCents(10390, 20000), 0);
  const capped = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons,
    modules: [moduleRow],
    courses: [],
    sources: [source("big", 20000, ["a"])],
    ownedLessonIds: [],
  });
  assert.equal(capped.ok && capped.totalCents, 0);
  assert.equal(capped.ok && capped.kind, "zero_upgrade");
  assert.equal(capped.ok && capped.items[0]?.creditAppliedCents, 10390);

  const owned = quoteCart({
    lines: [{ type: "MODULE", id: "mod" }],
    lessons,
    modules: [moduleRow],
    courses: [],
    sources: [],
    ownedLessonIds: ["a", "b", "c"],
  });
  assert.equal(owned.ok, false);

  const mixed = quoteCart({
    lines: [{ type: "COURSE", id: "course" }, { type: "LESSON", id: "a" }],
    lessons,
    modules: [moduleRow],
    courses: [course],
    sources: [],
    ownedLessonIds: [],
  });
  assert.equal(mixed.ok, false);
});

test("reconciliação não libera pendente e não duplica aprovado", () => {
  const pending = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "pending" }),
    alreadyGranted: false,
  });
  assert.equal(pending.grant, false);
  assert.equal(pending.paymentStatus, "PENDING");

  const approved = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "approved", paymentTypeId: "credit_card" }),
    alreadyGranted: false,
  });
  assert.equal(approved.grant, true);
  assert.equal(approved.orderStatus, "PAID");

  const repeat = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "approved" }),
    alreadyGranted: true,
  });
  assert.equal(repeat.ignore, true);
  assert.equal(repeat.grant, false);

  const secondApproved = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "approved", id: "mp-2" }),
    alreadyGranted: true,
  });
  assert.equal(secondApproved.orderStatus, "NEEDS_REVIEW");
  assert.equal(secondApproved.grant, false);

  const unknown = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 3990,
    paymentStatus: "PENDING",
    paymentAmountCents: 3990,
    provider: view({ status: "mystery" }),
    alreadyGranted: false,
  });
  assert.equal(unknown.grant, false);
  assert.equal(unknown.orderStatus, "NEEDS_REVIEW");

  const partial = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "approved", refundedCents: 1000 }),
    alreadyGranted: true,
  });
  assert.equal(partial.paymentStatus, "PARTIALLY_REFUNDED");
  assert.equal(partial.orderStatus, "NEEDS_REVIEW");
  assert.equal(partial.revoke, false);

  const refunded = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "refunded", refundedCents: 3990 }),
    alreadyGranted: true,
  });
  assert.equal(refunded.revoke, true);
  assert.equal(refunded.orderStatus, "REFUNDED");

  const chargeback = reconcileDecision({
    orderId: "order-1",
    orderStatus: "PAID",
    orderTotalCents: 3990,
    paymentStatus: "APPROVED",
    paymentAmountCents: 3990,
    provider: view({ status: "charged_back" }),
    alreadyGranted: true,
  });
  assert.equal(chargeback.paymentStatus, "CHARGED_BACK");
  assert.equal(chargeback.revoke, true);
});

test("aula gratuita abre e aula paga só abre com direito", () => {
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "FREE" }), true);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }), false);
  assert.equal(canReadLessonBody({ status: "PUBLISHED", accessType: "PAID" }, { entitled: true }), true);
  assert.deepEqual(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, ["segredo"]), []);
  assert.deepEqual(visibleBlocks({ status: "PUBLISHED", accessType: "PAID" }, ["segredo"], { entitled: true }), ["segredo"]);
});

test("assinatura inválida é recusada e a válida confere o manifesto", () => {
  assert.equal(verifyMercadoPagoSignature({ secret: "segredo-teste", xSignature: null, xRequestId: "req", dataId: "123" }), false);
  const manifest = "id:123;request-id:req-1;ts:1000;";
  const v1 = createHmac("sha256", "segredo-teste").update(manifest).digest("hex");
  assert.equal(
    verifyMercadoPagoSignature({
      secret: "segredo-teste",
      xSignature: `ts=1000,v1=${v1}`,
      xRequestId: "req-1",
      dataId: "123",
    }),
    true,
  );
  assert.equal(
    verifyMercadoPagoSignature({
      secret: "outro-segredo",
      xSignature: `ts=1000,v1=${v1}`,
      xRequestId: "req-1",
      dataId: "123",
    }),
    false,
  );
});

test("e-mail e analytics de compra não levam cartão nem repetem o pedido", () => {
  const message = purchaseEmail({ items: ["Aula A"], totalLabel: "R$ 39,90", learnUrl: "http://localhost:3000/app/aprendizado" });
  assert.equal(message.subject, "Compra confirmada — Alexandre Feio");
  assert.equal(message.text.includes("cartão"), false);
  assert.equal(message.text.includes("CVV"), false);
  const payload = commerceAnalyticsPayload({ totalCents: 3990, orderId: "order-public", itemType: "LESSON", itemSlug: "aula-a" });
  assert.equal(payload.currency, "BRL");
  assert.equal(payload.value, 39.9);
  assert.equal(payload.transaction_id, "order-public");
  assert.equal("email" in payload, false);
  assert.equal(purchaseDedupeKey("order-public"), purchaseDedupeKey("order-public"));
  assert.equal(needsSession("/app/compras"), true);
  assert.equal(needsSession("/app/checkout"), true);
  assert.equal(needsSession("/api/webhooks/mercado-pago"), false);
  if (process.env.VERCEL_ENV === "production" || process.env.DATABASE_ENV === "production") {
    assert.equal(isCommerceEnabled(), false);
  }
});

test("pedido, acesso e webhook usam o banco de desenvolvimento", async () => {
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const previousCommerce = process.env.COMMERCE_ENABLED;
  const previousResend = process.env.RESEND_API_KEY;
  const previousMp = {
    env: process.env.MERCADO_PAGO_ENV,
    key: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
    token: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  };
  process.env.COMMERCE_ENABLED = "true";
  delete process.env.RESEND_API_KEY;
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { createOrderForUser, getOrderForUser, preparePaymentAttempt, sendPurchaseConfirmationIfNeeded } = await import("../src/lib/commerce/orders");
  const { applyProviderView } = await import("../src/lib/commerce/apply");
  const { getPublicLesson, loadLessonBlocks } = await import("../src/lib/learning/catalog");
  const { hasActiveEntitlement } = await import("../src/lib/commerce/access");
  const prisma = getPrisma();
  const stamp = Date.now();
  const userA = `commerce-a-${stamp}`;
  const userB = `commerce-b-${stamp}`;
  await prisma.user.create({ data: { id: userA, name: "A", email: `sprint5-a-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  await prisma.user.create({ data: { id: userB, name: "B", email: `sprint5-b-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() } });
  const courseRow = await prisma.course.create({
    data: { slug: `commerce-${stamp}`, title: "Fixture", description: "Teste", status: "PUBLISHED", commerceStatus: "AVAILABLE", bundlePriceCents: 5000, publishedAt: new Date() },
  });
  const moduleRowDb = await prisma.module.create({
    data: { courseId: courseRow.id, slug: "pacote", title: "Pacote", description: "Teste", status: "PUBLISHED", commerceStatus: "AVAILABLE", bundlePriceCents: 3990 },
  });
  const otherModule = await prisma.module.create({
    data: { courseId: courseRow.id, slug: "outro", title: "Outro", description: "Teste", status: "PUBLISHED", commerceStatus: "NOT_FOR_SALE" },
  });
  const lessonA = await prisma.lesson.create({
    data: { moduleId: moduleRowDb.id, slug: `commerce-a-${stamp}`, title: "Aula A", summary: "Resumo", status: "PUBLISHED", accessType: "PAID", commerceStatus: "AVAILABLE", priceCents: 3990, publishedAt: new Date() },
  });
  const lessonB = await prisma.lesson.create({
    data: { moduleId: moduleRowDb.id, slug: `commerce-b-${stamp}`, title: "Aula B", summary: "Resumo", status: "PUBLISHED", accessType: "PAID", commerceStatus: "AVAILABLE", priceCents: 2000, publishedAt: new Date() },
  });
  const hidden = await prisma.lesson.create({
    data: { moduleId: otherModule.id, slug: `commerce-hidden-${stamp}`, title: "Escondida", summary: "Resumo", status: "PUBLISHED", accessType: "PAID", commerceStatus: "NOT_FOR_SALE", priceCents: 1000, publishedAt: new Date() },
  });
  const free = await prisma.lesson.create({
    data: { moduleId: otherModule.id, slug: `commerce-free-${stamp}`, title: "Livre", summary: "Resumo", status: "PUBLISHED", accessType: "FREE", commerceStatus: "NOT_FOR_SALE", publishedAt: new Date() },
  });
  await prisma.lessonBlock.create({
    data: { lessonId: lessonA.id, blockKey: "corpo", type: "TEXT", position: 0, payload: { type: "TEXT", body: "Segredo pago" }, countsForProgress: true, required: false },
  });
  await prisma.lessonBlock.create({
    data: { lessonId: free.id, blockKey: "corpo", type: "TEXT", position: 0, payload: { type: "TEXT", body: "Texto livre" }, countsForProgress: true, required: false },
  });

  try {
    const closed = await createOrderForUser(userA, [{ type: "LESSON", id: hidden.id }], `00000000-0000-4000-8000-${String(stamp).padStart(12, "0").slice(-12)}`);
    assert.equal(closed.ok, false);

    const created = await createOrderForUser(userA, [{ type: "LESSON", id: lessonA.id }], `11111111-1111-4111-8111-${String(stamp).padStart(12, "0").slice(-12)}`);
    assert.equal(created.ok && created.totalCents, 3990);
    if (!created.ok) return;
    await prisma.lesson.update({ where: { id: lessonA.id }, data: { priceCents: 4990 } });
    const stored = await prisma.orderItem.findFirst({ where: { orderId: created.orderId } });
    assert.equal(stored?.listPriceCents, 3990);
    assert.equal(await getOrderForUser(userB, created.orderId), null);

    const firstTry = await preparePaymentAttempt(userA, created.orderId);
    assert.equal(firstTry.ok, true);
    if (!firstTry.ok) return;
    await prisma.payment.update({ where: { id: firstTry.paymentId }, data: { status: "REJECTED" } });
    const secondTry = await preparePaymentAttempt(userA, created.orderId);
    assert.equal(secondTry.ok, true);
    if (!secondTry.ok) return;
    assert.notEqual(secondTry.idempotencyKey, firstTry.idempotencyKey);

    await applyProviderView(secondTry.paymentId, {
      id: `mp-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: 3990,
      currency: "BRL",
      externalReference: created.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal(await prisma.entitlement.count({ where: { userId: userA, lessonId: lessonA.id, status: "ACTIVE" } }), 1);
    await applyProviderView(secondTry.paymentId, {
      id: `mp-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: 3990,
      currency: "BRL",
      externalReference: created.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal(await prisma.entitlement.count({ where: { userId: userA, lessonId: lessonA.id } }), 1);
    assert.equal((await preparePaymentAttempt(userA, created.orderId)).ok, false);

    const upgrade = await createOrderForUser(userA, [{ type: "MODULE", id: moduleRowDb.id }], `22222222-2222-4222-8222-${String(stamp).padStart(12, "0").slice(-12)}`);
    if (!upgrade.ok) assert.fail(upgrade.message);
    assert.equal(upgrade.status, "PAID");
    assert.equal(upgrade.ok && upgrade.totalCents, 0);
    if (upgrade.ok) {
      const upgradeRow = await prisma.order.findUnique({ where: { id: upgrade.orderId } });
      assert.equal(upgradeRow?.zeroValueUpgrade, true);
      assert.equal(await prisma.payment.count({ where: { orderId: upgrade.orderId } }), 0);
    }
    assert.equal(await hasActiveEntitlement(userA, lessonB.id), true);

    const paidPage = await getPublicLesson(lessonA.slug);
    assert.equal(paidPage?.blocks.length, 0);
    assert.equal(await hasActiveEntitlement(userA, lessonA.id), true);
    const opened = await loadLessonBlocks(lessonA.id);
    assert.equal(opened[0]?.data.type === "TEXT" && opened[0].data.body, "Segredo pago");
    const freePage = await getPublicLesson(free.slug);
    assert.equal(freePage?.blocks.length, 1);

    const extra = await prisma.order.create({
      data: {
        userId: userA,
        status: "PAID",
        currency: "BRL",
        subtotalCents: 2000,
        creditCents: 0,
        totalCents: 2000,
        items: {
          create: {
            productType: "LESSON",
            lessonId: lessonB.id,
            titleSnapshot: "Aula B",
            listPriceCents: 2000,
            creditAppliedCents: 0,
            finalPriceCents: 2000,
            lessons: { create: { lessonId: lessonA.id } },
            entitlements: { create: { userId: userA, lessonId: lessonA.id, status: "ACTIVE" } },
          },
        },
        payments: { create: { provider: "MERCADO_PAGO", idempotencyKey: `extra-${stamp}`, amountCents: 2000, status: "APPROVED", providerPaymentId: `extra-mp-${stamp}` } },
      },
      include: { payments: true },
    });
    const extraPayment = extra.payments[0];
    assert.ok(extraPayment);
    await applyProviderView(extraPayment.id, {
      id: `extra-mp-${stamp}`,
      status: "refunded",
      statusDetail: null,
      amountCents: 2000,
      currency: "BRL",
      externalReference: extra.id,
      paymentTypeId: "pix",
      installments: 1,
      refundedCents: 2000,
    });
    assert.equal(await hasActiveEntitlement(userA, lessonA.id), true);

    await prisma.order.update({ where: { id: created.orderId }, data: { status: "PAID", confirmationEmailSentAt: null } });
    const failedMail = await sendPurchaseConfirmationIfNeeded(created.orderId);
    assert.equal(failedMail.sent, false);
    assert.equal((await prisma.order.findUnique({ where: { id: created.orderId } }))?.confirmationEmailSentAt, null);
    await prisma.order.update({ where: { id: created.orderId }, data: { confirmationEmailSentAt: new Date() } });
    const repeatMail = await sendPurchaseConfirmationIfNeeded(created.orderId);
    assert.equal(repeatMail.sent, false);

    delete process.env.MERCADO_PAGO_ENV;
    const { POST } = await import("../src/app/api/webhooks/mercado-pago/route");
    const missing = await POST(new Request("http://localhost/api/webhooks/mercado-pago", { method: "POST", body: "{}" }));
    assert.equal(missing.status, 503);
    process.env.MERCADO_PAGO_ENV = "test";
    process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "TEST-public";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST-token";
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "segredo-teste";
    const invalid = await POST(new Request("http://localhost/api/webhooks/mercado-pago", {
      method: "POST",
      headers: { "x-signature": "ts=1,v1=invalida", "x-request-id": "req" },
      body: JSON.stringify({ type: "payment", data: { id: "123" } }),
    }));
    assert.equal(invalid.status, 401);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await prisma.course.delete({ where: { id: courseRow.id } });
    if (previousCommerce == null) delete process.env.COMMERCE_ENABLED;
    else process.env.COMMERCE_ENABLED = previousCommerce;
    if (previousResend == null) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousResend;
    for (const [key, value] of Object.entries({
      MERCADO_PAGO_ENV: previousMp.env,
      NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: previousMp.key,
      MERCADO_PAGO_ACCESS_TOKEN: previousMp.token,
      MERCADO_PAGO_WEBHOOK_SECRET: previousMp.secret,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
