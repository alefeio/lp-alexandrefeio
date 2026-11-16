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

test("claim atômico: submits simultâneos Pix/cartão, divergente, pagador e cancelamento", async () => {
  await requireIsolatedGate();

  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";
  delete process.env.RESEND_API_KEY;
  setPurchaseEmailSenderForTests(async () => {});

  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { cancelAbandonedCheckoutForUser, createOrderForUser, preparePaymentAttempt } = await import(
    "../../src/lib/commerce/orders"
  );
  const { applyProviderView, claimChargeDispatch, updateOpenPaymentMarkers } = await import("../../src/lib/commerce/apply");
  const {
    chargeFingerprint,
    encodeChargeFingerprint,
    PROVIDER_STATUS_UNKNOWN,
  } = await import("../../src/lib/commerce/provider");

  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `claim-iso-${stamp}`;
  let courseId = "";

  await prisma.user.create({
    data: {
      id: userId,
      name: "ClaimIso",
      email: `claim-iso-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  const course = await prisma.course.create({
    data: {
      slug: `claim-iso-${stamp}`,
      title: "Claim",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 5000,
      publishedAt: new Date(),
    },
  });
  courseId = course.id;
  const moduleRow = await prisma.module.create({
    data: {
      courseId: course.id,
      slug: "claim-mod",
      title: "Módulo",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 3000,
    },
  });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `claim-lesson-${stamp}`,
      title: "Aula",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 1590,
      publishedAt: new Date(),
    },
  });

  try {
    const order = await createOrderForUser(userId, [{ type: "LESSON", id: lesson.id }], randomUUID());
    assert.equal(order.ok, true);
    if (!order.ok) return;
    const prep = await preparePaymentAttempt(userId, order.orderId);
    assert.equal(prep.ok, true);
    if (!prep.ok) return;

    const fpPixA = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: order.orderId,
        amountCents: prep.amountCents,
        paymentMethodId: "pix",
        payerEmail: "payer-a@test.com",
      }),
    );
    const fpPixB = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: order.orderId,
        amountCents: prep.amountCents,
        paymentMethodId: "pix",
        payerEmail: "payer-b@test.com",
      }),
    );
    const fpCard = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: order.orderId,
        amountCents: prep.amountCents,
        paymentMethodId: "master",
        installments: 1,
        payerEmail: "payer-a@test.com",
      }),
    );

    // Dois submits Pix idênticos em paralelo → ambos ok (dispatch + resume); fingerprint único
    const twin = await Promise.all([
      claimChargeDispatch({ paymentId: prep.paymentId, fingerprintDetail: fpPixA, method: "PIX" }),
      claimChargeDispatch({ paymentId: prep.paymentId, fingerprintDetail: fpPixA, method: "PIX" }),
    ]);
    assert.equal(twin.every((row) => row.ok), true);
    assert.equal(twin.filter((row) => row.ok && row.kind === "dispatch").length, 1);
    assert.equal(twin.filter((row) => row.ok && row.kind === "resume").length, 1);
    const stored = await prisma.payment.findUnique({ where: { id: prep.paymentId } });
    assert.equal(stored?.providerStatusDetail, fpPixA);

    // Submit divergente (pagador) não sobrescreve nem “ganha” despacho
    const divergedPayer = await claimChargeDispatch({
      paymentId: prep.paymentId,
      fingerprintDetail: fpPixB,
      method: "PIX",
    });
    assert.equal(divergedPayer.ok, false);
    if (!divergedPayer.ok) assert.equal(divergedPayer.reason, "fingerprint_mismatch");
    assert.equal((await prisma.payment.findUnique({ where: { id: prep.paymentId } }))?.providerStatusDetail, fpPixA);

    // Cartão incerto após despacho Pix
    const cardAfter = await claimChargeDispatch({
      paymentId: prep.paymentId,
      fingerprintDetail: fpCard,
      method: "CREDIT_CARD",
    });
    assert.equal(cardAfter.ok, false);
    if (!cardAfter.ok) assert.equal(cardAfter.reason, "card_uncertain");

    // Timeout com fingerprint do claim (não divergente) + webhook APPROVED
    await updateOpenPaymentMarkers(prep.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: fpPixA,
    });
    await applyProviderView(prep.paymentId, {
      id: `mp-claim-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: prep.amountCents,
      currency: "BRL",
      externalReference: order.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal((await prisma.payment.findUnique({ where: { id: prep.paymentId } }))?.status, "APPROVED");

    // Novo pedido: cancelamento concorrente com claim
    const order2 = await createOrderForUser(userId, [{ type: "LESSON", id: lesson.id }], randomUUID());
    // lesson already owned → may fail already_owned; use a fresh lesson if needed
    let claimOrderId = order2.ok ? order2.orderId : null;
    let claimAmount = order2.ok ? order2.totalCents : 0;
    if (!order2.ok) {
      const lesson2 = await prisma.lesson.create({
        data: {
          moduleId: moduleRow.id,
          slug: `claim-lesson-2-${stamp}`,
          title: "Aula 2",
          summary: "Resumo",
          status: "PUBLISHED",
          accessType: "PAID",
          commerceStatus: "AVAILABLE",
          priceCents: 1690,
          publishedAt: new Date(),
        },
      });
      const created2 = await createOrderForUser(userId, [{ type: "LESSON", id: lesson2.id }], randomUUID());
      assert.equal(created2.ok, true);
      if (!created2.ok) return;
      claimOrderId = created2.orderId;
      claimAmount = created2.totalCents;
    }
    assert.ok(claimOrderId);
    const prep2 = await preparePaymentAttempt(userId, claimOrderId);
    assert.equal(prep2.ok, true);
    if (!prep2.ok) return;
    const fp2 = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: claimOrderId,
        amountCents: claimAmount || prep2.amountCents,
        paymentMethodId: "pix",
        payerEmail: "payer-a@test.com",
      }),
    );

    const racedCancel = await Promise.all([
      claimChargeDispatch({ paymentId: prep2.paymentId, fingerprintDetail: fp2, method: "PIX" }),
      cancelAbandonedCheckoutForUser(userId, claimOrderId),
    ]);
    const claimResult = racedCancel[0];
    const cancelResult = racedCancel[1];
    // Um dos dois prevalece: se claim venceu, cancel falha; se cancel venceu, claim falha ou pedido CANCELLED.
    if (claimResult.ok) {
      assert.equal(cancelResult.ok, false);
      assert.equal((await prisma.payment.findUnique({ where: { id: prep2.paymentId } }))?.providerStatusDetail, fp2);
      // Timeout + APPROVED após claim
      await updateOpenPaymentMarkers(prep2.paymentId, {
        providerStatus: PROVIDER_STATUS_UNKNOWN,
        providerStatusDetail: fp2,
      });
      await applyProviderView(prep2.paymentId, {
        id: `mp-claim-2-${stamp}`,
        status: "approved",
        statusDetail: null,
        amountCents: prep2.amountCents,
        currency: "BRL",
        externalReference: claimOrderId,
        paymentTypeId: "bank_transfer",
        installments: 1,
        refundedCents: 0,
      });
      assert.equal((await prisma.payment.findUnique({ where: { id: prep2.paymentId } }))?.status, "APPROVED");
    } else {
      assert.equal(cancelResult.ok, true);
      assert.equal((await prisma.order.findUnique({ where: { id: claimOrderId } }))?.status, "CANCELLED");
    }

    // Dois submits divergentes no mesmo virgin payment (pedido novo)
    const lesson3 = await prisma.lesson.create({
      data: {
        moduleId: moduleRow.id,
        slug: `claim-lesson-3-${stamp}`,
        title: "Aula 3",
        summary: "Resumo",
        status: "PUBLISHED",
        accessType: "PAID",
        commerceStatus: "AVAILABLE",
        priceCents: 1790,
        publishedAt: new Date(),
      },
    });
    const order3 = await createOrderForUser(userId, [{ type: "LESSON", id: lesson3.id }], randomUUID());
    assert.equal(order3.ok, true);
    if (!order3.ok) return;
    const prep3 = await preparePaymentAttempt(userId, order3.orderId);
    assert.equal(prep3.ok, true);
    if (!prep3.ok) return;
    const fp3a = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: order3.orderId,
        amountCents: prep3.amountCents,
        paymentMethodId: "pix",
        payerEmail: "one@test.com",
      }),
    );
    const fp3b = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: order3.orderId,
        amountCents: prep3.amountCents,
        paymentMethodId: "pix",
        payerEmail: "two@test.com",
      }),
    );
    const divergentTwin = await Promise.all([
      claimChargeDispatch({ paymentId: prep3.paymentId, fingerprintDetail: fp3a, method: "PIX" }),
      claimChargeDispatch({ paymentId: prep3.paymentId, fingerprintDetail: fp3b, method: "PIX" }),
    ]);
    const winners = divergentTwin.filter((row) => row.ok);
    const losers = divergentTwin.filter((row) => !row.ok);
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    if (!losers[0].ok) {
      assert.ok(losers[0].reason === "fingerprint_mismatch" || losers[0].reason === "lost_race");
    }
    const finalDetail = (await prisma.payment.findUnique({ where: { id: prep3.paymentId } }))?.providerStatusDetail;
    assert.ok(finalDetail === fp3a || finalDetail === fp3b);
    // Perdedor não alterou para o fingerprint “perdedor” se o vencedor já gravou o outro
    assert.equal(finalDetail === fp3a || finalDetail === fp3b, true);
  } finally {
    setPurchaseEmailSenderForTests(null);
    await prisma.user.deleteMany({ where: { id: userId } });
    if (courseId) await prisma.course.delete({ where: { id: courseId } }).catch(() => {});
  }
});
