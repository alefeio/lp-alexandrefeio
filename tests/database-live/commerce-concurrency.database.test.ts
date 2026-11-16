import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { setPurchaseEmailSenderForTests } from "../../src/lib/email/purchase-mail";
import { assertIsolatedCommerceDatabaseLive, evaluateIsolatedCommerceDatabaseLive } from "../../src/lib/db/urls";

/**
 * Concorrência financeira em PostgreSQL **fisicamente isolado**.
 * Recusa Production / Prisma compartilhado — ver assertIsolatedCommerceDatabaseLive.
 * Sem chamadas reais ao Mercado Pago (views sintéticas + tokens de teste).
 */
loadEnv({ path: ".env.local" });

function assertNoRealMercadoPago() {
  assert.notEqual((process.env.MERCADO_PAGO_ENV ?? "").toLowerCase(), "production");
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "";
  assert.equal(/APP_USR-example|TEST-|test/i.test(token) || token.length < 20, true, "token de MP deve ser sintético de teste");
}

test("concorrência isolada: overlap de aulas, checkoutKeys paralelos e ordenação webhook/timeout", async () => {
  const identity = assertIsolatedCommerceDatabaseLive();
  console.info("[commerce-concurrency-live]", identity.identity);
  assertNoRealMercadoPago();

  const previous = {
    commerce: process.env.COMMERCE_ENABLED,
    mpEnv: process.env.MERCADO_PAGO_ENV,
    key: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
    token: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    resend: process.env.RESEND_API_KEY,
  };

  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";
  delete process.env.RESEND_API_KEY;
  setPurchaseEmailSenderForTests(async () => {});

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createOrderForUser, preparePaymentAttempt } = await import("../../src/lib/commerce/orders");
  const { applyProviderView, updateOpenPaymentMarkers } = await import("../../src/lib/commerce/apply");
  const { PROVIDER_STATUS_UNKNOWN } = await import("../../src/lib/commerce/provider");

  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `conc-iso-${stamp}`;
  const createdIds = {
    userId,
    courseId: "",
    lessonIds: [] as string[],
    orderIds: [] as string[],
  };

  await prisma.user.create({
    data: {
      id: userId,
      name: "ConcIso",
      email: `conc-iso-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const course = await prisma.course.create({
    data: {
      slug: `conc-iso-course-${stamp}`,
      title: "ConcIso",
      description: "Teste isolado",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 9000,
      publishedAt: new Date(),
    },
  });
  createdIds.courseId = course.id;

  const moduleRow = await prisma.module.create({
    data: {
      courseId: course.id,
      slug: "conc-iso-mod",
      title: "Módulo",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 5000,
    },
  });

  const lessonA = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `conc-iso-a-${stamp}`,
      title: "Aula A",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 1490,
      publishedAt: new Date(),
    },
  });
  const lessonB = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `conc-iso-b-${stamp}`,
      title: "Aula B",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 1990,
      publishedAt: new Date(),
    },
  });
  createdIds.lessonIds = [lessonA.id, lessonB.id];

  try {
    // Aula A pendente → módulo que contém A (bloqueado)
    const orderLesson = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(orderLesson.ok, true);
    if (!orderLesson.ok) return;
    createdIds.orderIds.push(orderLesson.orderId);
    const prep = await preparePaymentAttempt(userId, orderLesson.orderId);
    assert.equal(prep.ok, true);
    if (!prep.ok) return;
    await updateOpenPaymentMarkers(prep.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:iso-a",
    });

    const blockedModule = await createOrderForUser(userId, [{ type: "MODULE", id: moduleRow.id }], randomUUID());
    assert.equal(blockedModule.ok, false);
    assert.equal(!blockedModule.ok && "code" in blockedModule ? blockedModule.code : null, "payment_uncertain");

    const blockedCourse = await createOrderForUser(userId, [{ type: "COURSE", id: course.id }], randomUUID());
    assert.equal(blockedCourse.ok, false);

    // Sem interseção: aula B permitida enquanto A está incerta
    const other = await createOrderForUser(userId, [{ type: "LESSON", id: lessonB.id }], randomUUID());
    assert.equal(other.ok, true);
    if (other.ok) createdIds.orderIds.push(other.orderId);

    // CheckoutKeys paralelos sobre o mesmo conteúdo → no máximo um sucesso
    await prisma.payment.update({
      where: { id: prep.paymentId },
      data: { status: "REJECTED", providerStatus: "request_failed" },
    });
    await prisma.order.update({ where: { id: orderLesson.orderId }, data: { status: "CANCELLED" } });
    if (other.ok) {
      await prisma.order.update({ where: { id: other.orderId }, data: { status: "CANCELLED" } });
    }

    const key1 = randomUUID();
    const key2 = randomUUID();
    const raced = await Promise.all([
      createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], key1),
      createOrderForUser(userId, [{ type: "MODULE", id: moduleRow.id }], key2),
    ]);
    const successes = raced.filter((row) => row.ok);
    const failures = raced.filter((row) => !row.ok);
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    for (const row of raced) {
      if (row.ok) createdIds.orderIds.push(row.orderId);
    }

    const winner = successes[0];
    assert.ok(winner && winner.ok);
    const winnerPrep = await preparePaymentAttempt(userId, winner.orderId);
    assert.equal(winnerPrep.ok, true);
    if (!winnerPrep.ok) return;

    await applyProviderView(winnerPrep.paymentId, {
      id: `mp-iso-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: winner.totalCents,
      currency: "BRL",
      externalReference: winner.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal((await prisma.payment.findUnique({ where: { id: winnerPrep.paymentId } }))?.status, "APPROVED");

    const lateTimeout = await updateOpenPaymentMarkers(winnerPrep.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:late",
    });
    assert.equal(lateTimeout.updated, false);
    assert.equal(lateTimeout.currentStatus, "APPROVED");

    await applyProviderView(winnerPrep.paymentId, {
      id: `mp-iso-${stamp}`,
      status: "rejected",
      statusDetail: "cc_rejected",
      amountCents: winner.totalCents,
      currency: "BRL",
      externalReference: winner.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal((await prisma.payment.findUnique({ where: { id: winnerPrep.paymentId } }))?.status, "APPROVED");
    assert.equal((await prisma.order.findUnique({ where: { id: winner.orderId } }))?.status, "PAID");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lessonA.id, status: "ACTIVE" } }), 1);

    await Promise.all([
      applyProviderView(winnerPrep.paymentId, {
        id: `mp-iso-${stamp}`,
        status: "approved",
        statusDetail: null,
        amountCents: winner.totalCents,
        currency: "BRL",
        externalReference: winner.orderId,
        paymentTypeId: "bank_transfer",
        installments: 1,
        refundedCents: 0,
      }),
      applyProviderView(winnerPrep.paymentId, {
        id: `mp-iso-${stamp}`,
        status: "approved",
        statusDetail: null,
        amountCents: winner.totalCents,
        currency: "BRL",
        externalReference: winner.orderId,
        paymentTypeId: "bank_transfer",
        installments: 1,
        refundedCents: 0,
      }),
    ]);
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lessonA.id } }), 1);
  } finally {
    setPurchaseEmailSenderForTests(null);
    await prisma.user.deleteMany({ where: { id: userId } });
    if (createdIds.courseId) await prisma.course.delete({ where: { id: createdIds.courseId } }).catch(() => {});
    for (const [key, value] of Object.entries({
      COMMERCE_ENABLED: previous.commerce,
      MERCADO_PAGO_ENV: previous.mpEnv,
      NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: previous.key,
      MERCADO_PAGO_ACCESS_TOKEN: previous.token,
      MERCADO_PAGO_WEBHOOK_SECRET: previous.secret,
      RESEND_API_KEY: previous.resend,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("gate: sem banco isolado o assert falha (não cai no compartilhado)", () => {
  const result = evaluateIsolatedCommerceDatabaseLive({
    DATABASE_ENV: "development",
    SHARED_DATABASE_TEST_CONFIRM: "true",
    RUNTIME_DATABASE_URL: "postgresql://u:p@db.prisma.io:5432/postgres",
    POSTGRES_URL: "postgresql://u:p@db.prisma.io:5432/postgres",
  });
  assert.equal(result.ok, false);
});
