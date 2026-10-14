import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { setPurchaseEmailSenderForTests } from "../../src/lib/email/purchase-mail";

loadEnv({ path: ".env.local" });

test("pedido, acesso e webhook usam o banco de desenvolvimento", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const previousCommerce = process.env.COMMERCE_ENABLED;
  const previousResend = process.env.RESEND_API_KEY;
  const previousMp = {
    env: process.env.MERCADO_PAGO_ENV,
    key: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
    token: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    database: process.env.DATABASE_ENV,
    vercel: process.env.VERCEL_ENV,
  };
  const { isCommerceEnabled, mercadoPagoTestConfig } = await import("../../src/lib/commerce/config");
  process.env.DATABASE_ENV = "development";
  delete process.env.VERCEL_ENV;
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";
  assert.equal(isCommerceEnabled(), true);
  assert.equal(mercadoPagoTestConfig()?.env, "test");
  process.env.COMMERCE_ENABLED = "false";
  assert.equal(mercadoPagoTestConfig(), null);
  process.env.COMMERCE_ENABLED = "true";
  delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
  assert.equal(mercadoPagoTestConfig(), null);
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  delete process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
  assert.equal(mercadoPagoTestConfig(), null);
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "curto";
  assert.equal(mercadoPagoTestConfig(), null);
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";
  process.env.MERCADO_PAGO_ENV = "production";
  assert.equal(isCommerceEnabled(), false);
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.DATABASE_ENV = "production";
  assert.equal(isCommerceEnabled(), false);
  process.env.DATABASE_ENV = "development";
  process.env.VERCEL_ENV = "production";
  assert.equal(isCommerceEnabled(), false);
  delete process.env.VERCEL_ENV;
  delete process.env.RESEND_API_KEY;
  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createOrderForUser, getOrderForUser, preparePaymentAttempt, sendPurchaseConfirmationIfNeeded } = await import("../../src/lib/commerce/orders");
  const { applyProviderView } = await import("../../src/lib/commerce/apply");
  const { getPublicLesson, loadLessonBlocks } = await import("../../src/lib/learning/catalog");
  const { hasActiveEntitlement } = await import("../../src/lib/commerce/access");
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
    setPurchaseEmailSenderForTests(async () => {});
    const mockedMail = await sendPurchaseConfirmationIfNeeded(created.orderId);
    assert.equal(mockedMail.sent, true);
    setPurchaseEmailSenderForTests(null);
    await prisma.order.update({ where: { id: created.orderId }, data: { confirmationEmailSentAt: new Date() } });
    const repeatMail = await sendPurchaseConfirmationIfNeeded(created.orderId);
    assert.equal(repeatMail.sent, false);

    delete process.env.MERCADO_PAGO_ENV;
    const { POST } = await import("../../src/app/api/webhooks/mercado-pago/route");
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
    setPurchaseEmailSenderForTests(null);
    for (const [key, value] of Object.entries({
      MERCADO_PAGO_ENV: previousMp.env,
      NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: previousMp.key,
      MERCADO_PAGO_ACCESS_TOKEN: previousMp.token,
      MERCADO_PAGO_WEBHOOK_SECRET: previousMp.secret,
      DATABASE_ENV: previousMp.database,
      VERCEL_ENV: previousMp.vercel,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
