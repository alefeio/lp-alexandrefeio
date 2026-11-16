import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { setPurchaseEmailSenderForTests } from "../../src/lib/email/purchase-mail";
import {
  assertIsolatedCommerceDatabaseLive,
  assertIsolatedCommerceLiveConnection,
  evaluateIsolatedCommerceDatabaseLive,
} from "../../src/lib/db/urls";

/**
 * Concorrência financeira em PostgreSQL local isolado.
 * Impede contorno: exige gate URL + probe vivo antes de qualquer write.
 */
// Não carregar .env.local compartilhado — ele injeta VERCEL_ENV=production / URLs Prisma.
loadEnv({ path: ".env.commerce-isolated.local", override: true });
delete process.env.VERCEL_ENV;
delete process.env.UNIT_TEST_ISOLATION;

async function requireIsolatedGate() {
  delete process.env.VERCEL_ENV;
  const declared = assertIsolatedCommerceDatabaseLive();
  const probed = await assertIsolatedCommerceLiveConnection();
  assert.equal(probed.declared.database, declared.identity.database);
  assert.equal(probed.live.database, declared.identity.database);
  assert.notEqual((process.env.MERCADO_PAGO_ENV ?? "").toLowerCase(), "production");
  console.info("[commerce-concurrency-live]", {
    host: declared.identity.host,
    port: declared.identity.port,
    database: declared.identity.database,
    valueHash12: declared.identity.valueHash12,
    liveVersion: probed.live.version,
    liveUser: probed.live.dbUser,
  });
  return declared.identity;
}

test("gate: Prisma compartilhado / Production são recusados", () => {
  const result = evaluateIsolatedCommerceDatabaseLive({
    ISOLATED_COMMERCE_DATABASE_TEST: "1",
    DATABASE_ENV: "test",
    MERCADO_PAGO_ENV: "test",
    ISOLATED_COMMERCE_DATABASE_URL: "postgresql://u:p@db.prisma.io:5432/postgres",
    RUNTIME_DATABASE_URL: "postgresql://u:p@db.prisma.io:5432/postgres",
    POSTGRES_URL: "postgresql://u:p@db.prisma.io:5432/postgres",
  });
  assert.equal(result.ok, false);
});

test("concorrência isolada: overlap, checkoutKeys, abandonado, webhook/timeout", async () => {
  await requireIsolatedGate();

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

  // Limpa cache do Prisma se algum teste anterior apontou para outro URL.
  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const {
    cancelAbandonedCheckoutForUser,
    createOrderForUser,
    preparePaymentAttempt,
  } = await import("../../src/lib/commerce/orders");
  const { applyProviderView, updateOpenPaymentMarkers } = await import("../../src/lib/commerce/apply");
  const { PROVIDER_STATUS_UNKNOWN } = await import("../../src/lib/commerce/provider");
  const { canCancelAbandonedCheckout } = await import("../../src/lib/commerce/payment-guards");

  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `conc-iso-${stamp}`;
  let courseId = "";

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
  courseId = course.id;

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

  try {
    // Checkout abandonado (virginal) → cancelável → libera novo checkout
    const abandoned = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(abandoned.ok, true);
    if (!abandoned.ok) return;
    const abandonedPrep = await preparePaymentAttempt(userId, abandoned.orderId);
    assert.equal(abandonedPrep.ok, true);
    if (!abandonedPrep.ok) return;
    assert.equal(
      canCancelAbandonedCheckout({
        orderStatus: "PENDING_PAYMENT",
        payments: [{ status: "PENDING", providerStatus: null, providerPaymentId: null }],
      }),
      true,
    );
    const cancelled = await cancelAbandonedCheckoutForUser(userId, abandoned.orderId);
    assert.equal(cancelled.ok, true);
    assert.equal((await prisma.order.findUnique({ where: { id: abandoned.orderId } }))?.status, "CANCELLED");

    // Retomada: mesmo pedido/idempotency após prepare sem cancel
    const resumeOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(resumeOrder.ok, true);
    if (!resumeOrder.ok) return;
    const firstPrep = await preparePaymentAttempt(userId, resumeOrder.orderId);
    assert.equal(firstPrep.ok, true);
    if (!firstPrep.ok) return;
    const secondPrep = await preparePaymentAttempt(userId, resumeOrder.orderId);
    assert.equal(secondPrep.ok, true);
    if (!secondPrep.ok) return;
    assert.equal(secondPrep.idempotencyKey, firstPrep.idempotencyKey);
    assert.equal(secondPrep.paymentId, firstPrep.paymentId);

    // Sem despacho ainda: cancelável
    const cancelResume = await cancelAbandonedCheckoutForUser(userId, resumeOrder.orderId);
    assert.equal(cancelResume.ok, true);

    // Incerto NÃO cancela
    const uncertainOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(uncertainOrder.ok, true);
    if (!uncertainOrder.ok) return;
    const uncertainPrep = await preparePaymentAttempt(userId, uncertainOrder.orderId);
    assert.equal(uncertainPrep.ok, true);
    if (!uncertainPrep.ok) return;
    await updateOpenPaymentMarkers(uncertainPrep.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:iso-a",
    });
    const refuseCancel = await cancelAbandonedCheckoutForUser(userId, uncertainOrder.orderId);
    assert.equal(refuseCancel.ok, false);
    assert.equal(!refuseCancel.ok && "code" in refuseCancel ? refuseCancel.code : null, "payment_uncertain");

    // Overlap aula → módulo / curso
    const blockedModule = await createOrderForUser(userId, [{ type: "MODULE", id: moduleRow.id }], randomUUID());
    assert.equal(blockedModule.ok, false);
    const blockedCourse = await createOrderForUser(userId, [{ type: "COURSE", id: course.id }], randomUUID());
    assert.equal(blockedCourse.ok, false);

    // Sem interseção
    const other = await createOrderForUser(userId, [{ type: "LESSON", id: lessonB.id }], randomUUID());
    assert.equal(other.ok, true);
    if (other.ok) {
      await cancelAbandonedCheckoutForUser(userId, other.orderId);
    }

    // Limpa incerto para corrida de checkoutKeys (rejeita pagamento, cancela pedido)
    await prisma.payment.update({
      where: { id: uncertainPrep.paymentId },
      data: { status: "REJECTED", providerStatus: "request_failed", providerPaymentId: null },
    });
    await prisma.order.update({ where: { id: uncertainOrder.orderId }, data: { status: "CANCELLED" } });

    const raced = await Promise.all([
      createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID()),
      createOrderForUser(userId, [{ type: "MODULE", id: moduleRow.id }], randomUUID()),
    ]);
    const successes = raced.filter((row) => row.ok);
    const failures = raced.filter((row) => !row.ok);
    assert.equal(successes.length, 1, "apenas um pedido elegível para cobrança");
    assert.equal(failures.length, 1);

    const winner = successes[0];
    assert.ok(winner && winner.ok);
    const winnerPrep = await preparePaymentAttempt(userId, winner.orderId);
    assert.equal(winnerPrep.ok, true);
    if (!winnerPrep.ok) return;

    // Timeout antes do webhook
    await updateOpenPaymentMarkers(winnerPrep.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:race",
    });
    assert.equal((await prisma.payment.findUnique({ where: { id: winnerPrep.paymentId } }))?.status, "PENDING");

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

    // Timeout tardio / HTTP rejected após APPROVED
    assert.equal(
      (
        await updateOpenPaymentMarkers(winnerPrep.paymentId, {
          providerStatus: PROVIDER_STATUS_UNKNOWN,
          providerStatusDetail: "fp:late",
        })
      ).updated,
      false,
    );
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

    // Reconciliações concorrentes + entitlements únicos
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
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lessonA.id, status: "ACTIVE" } }), 1);
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lessonA.id } }), 1);

    // Webhook APPROVED antes do timeout (pedido B limpo)
    const orderBeforeTimeout = await createOrderForUser(userId, [{ type: "LESSON", id: lessonB.id }], randomUUID());
    assert.equal(orderBeforeTimeout.ok, true);
    if (!orderBeforeTimeout.ok) return;
    const prepB = await preparePaymentAttempt(userId, orderBeforeTimeout.orderId);
    assert.equal(prepB.ok, true);
    if (!prepB.ok) return;
    await applyProviderView(prepB.paymentId, {
      id: `mp-iso-b-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: orderBeforeTimeout.totalCents,
      currency: "BRL",
      externalReference: orderBeforeTimeout.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    });
    const late = await updateOpenPaymentMarkers(prepB.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:b-late",
    });
    assert.equal(late.updated, false);
    assert.equal(late.currentStatus, "APPROVED");
  } finally {
    setPurchaseEmailSenderForTests(null);
    await prisma.user.deleteMany({ where: { id: userId } });
    if (courseId) await prisma.course.delete({ where: { id: courseId } }).catch(() => {});
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
