import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { setPurchaseEmailSenderForTests } from "../../src/lib/email/purchase-mail";

loadEnv({ path: ".env.local" });

test("concorrência: ordenação webhook/timeout e novo checkoutKey com tentativa incerta", async () => {
  const previous = {
    commerce: process.env.COMMERCE_ENABLED,
    mpEnv: process.env.MERCADO_PAGO_ENV,
    key: process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY,
    token: process.env.MERCADO_PAGO_ACCESS_TOKEN,
    secret: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    database: process.env.DATABASE_ENV,
    vercel: process.env.VERCEL_ENV,
    resend: process.env.RESEND_API_KEY,
  };

  process.env.DATABASE_ENV = "development";
  delete process.env.VERCEL_ENV;
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";
  delete process.env.RESEND_API_KEY;
  setPurchaseEmailSenderForTests(async () => {});

  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createOrderForUser, preparePaymentAttempt } = await import("../../src/lib/commerce/orders");
  const { applyProviderView, updateOpenPaymentMarkers } = await import("../../src/lib/commerce/apply");
  const { PROVIDER_STATUS_DISPATCHED, PROVIDER_STATUS_UNKNOWN } = await import("../../src/lib/commerce/provider");

  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `conc-user-${stamp}`;
  await prisma.user.create({
    data: {
      id: userId,
      name: "Conc",
      email: `conc-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const course = await prisma.course.create({
    data: {
      slug: `conc-course-${stamp}`,
      title: "Conc",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 9000,
      publishedAt: new Date(),
    },
  });
  const moduleRow = await prisma.module.create({
    data: {
      courseId: course.id,
      slug: "conc-mod",
      title: "Módulo",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 5000,
    },
  });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `conc-lesson-${stamp}`,
      title: "Aula",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 1490,
      publishedAt: new Date(),
    },
  });

  const uuidTail = String(stamp).padStart(12, "0").slice(-12);

  try {
    // --- Cenário A: webhook APPROVED chega antes do timeout ---
    const orderA = await createOrderForUser(userId, [{ type: "LESSON", id: lesson.id }], `aaaaaaaa-aaaa-4aaa-8aaa-${uuidTail}`);
    assert.equal(orderA.ok, true);
    if (!orderA.ok) return;
    const prepA = await preparePaymentAttempt(userId, orderA.orderId);
    assert.equal(prepA.ok, true);
    if (!prepA.ok) return;

    await applyProviderView(prepA.paymentId, {
      id: `mp-a-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: 1490,
      currency: "BRL",
      externalReference: orderA.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    });

    const afterWebhook = await prisma.payment.findUnique({ where: { id: prepA.paymentId } });
    assert.equal(afterWebhook?.status, "APPROVED");
    assert.equal((await prisma.order.findUnique({ where: { id: orderA.orderId } }))?.status, "PAID");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id, status: "ACTIVE" } }), 1);

    const timeoutAfterApprove = await updateOpenPaymentMarkers(prepA.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:timeout-late",
    });
    assert.equal(timeoutAfterApprove.updated, false);
    assert.equal(timeoutAfterApprove.currentStatus, "APPROVED");

    const staleReject = await updateOpenPaymentMarkers(prepA.paymentId, {
      status: "REJECTED",
      providerStatus: "request_failed",
      providerStatusDetail: "fp:http-late",
    });
    assert.equal(staleReject.updated, false);

    await applyProviderView(prepA.paymentId, {
      id: `mp-a-${stamp}`,
      status: "pending",
      statusDetail: "waiting_transfer",
      amountCents: 1490,
      currency: "BRL",
      externalReference: orderA.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    });
    await applyProviderView(prepA.paymentId, {
      id: `mp-a-${stamp}`,
      status: "rejected",
      statusDetail: "cc_rejected",
      amountCents: 1490,
      currency: "BRL",
      externalReference: orderA.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });

    const stillApproved = await prisma.payment.findUnique({ where: { id: prepA.paymentId } });
    assert.equal(stillApproved?.status, "APPROVED");
    assert.equal((await prisma.order.findUnique({ where: { id: orderA.orderId } }))?.status, "PAID");
    assert.notEqual((await prisma.order.findUnique({ where: { id: orderA.orderId } }))?.status, "NEEDS_REVIEW");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id, status: "ACTIVE" } }), 1);

    // Webhook repetido não duplica entitlement
    await applyProviderView(prepA.paymentId, {
      id: `mp-a-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: 1490,
      currency: "BRL",
      externalReference: orderA.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id } }), 1);

    // --- Cenário B: timeout chega antes do webhook APPROVED ---
    const lessonB = await prisma.lesson.create({
      data: {
        moduleId: moduleRow.id,
        slug: `conc-lesson-b-${stamp}`,
        title: "Aula B",
        summary: "Resumo",
        status: "PUBLISHED",
        accessType: "PAID",
        commerceStatus: "AVAILABLE",
        priceCents: 1990,
        publishedAt: new Date(),
      },
    });
    const orderB = await createOrderForUser(userId, [{ type: "LESSON", id: lessonB.id }], `bbbbbbbb-bbbb-4bbb-8bbb-${uuidTail}`);
    assert.equal(orderB.ok, true);
    if (!orderB.ok) return;
    const prepB = await preparePaymentAttempt(userId, orderB.orderId);
    assert.equal(prepB.ok, true);
    if (!prepB.ok) return;

    const dispatch = await updateOpenPaymentMarkers(prepB.paymentId, {
      providerStatus: PROVIDER_STATUS_DISPATCHED,
      providerStatusDetail: "fp:pix-b",
    });
    assert.equal(dispatch.updated, true);

    const unknownFirst = await updateOpenPaymentMarkers(prepB.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:pix-b",
    });
    assert.equal(unknownFirst.updated, true);
    const mid = await prisma.payment.findUnique({ where: { id: prepB.paymentId } });
    assert.equal(mid?.status, "PENDING");
    assert.equal(mid?.providerStatus, PROVIDER_STATUS_UNKNOWN);

    // Novo checkoutKey com overlap incerto deve falhar
    const blockedCheckout = await createOrderForUser(
      userId,
      [{ type: "LESSON", id: lessonB.id }],
      `cccccccc-cccc-4ccc-8ccc-${uuidTail}`,
    );
    assert.equal(blockedCheckout.ok, false);
    assert.equal(!blockedCheckout.ok && "code" in blockedCheckout ? blockedCheckout.code : null, "payment_uncertain");

    // Tentativa no mesmo pedido permanece resume_idempotent (sem nova chave)
    const resume = await preparePaymentAttempt(userId, orderB.orderId);
    assert.equal(resume.ok, true);
    if (resume.ok) {
      assert.equal(resume.paymentId, prepB.paymentId);
      assert.equal(resume.idempotencyKey, prepB.idempotencyKey);
      assert.equal(resume.mode, "resume_idempotent");
    }

    // Reconciliações concorrentes: dois applyProviderView em paralelo
    const approvedView = {
      id: `mp-b-${stamp}`,
      status: "approved" as const,
      statusDetail: null,
      amountCents: 1990,
      currency: "BRL",
      externalReference: orderB.orderId,
      paymentTypeId: "bank_transfer",
      installments: 1,
      refundedCents: 0,
    };
    await Promise.all([applyProviderView(prepB.paymentId, approvedView), applyProviderView(prepB.paymentId, approvedView)]);
    assert.equal((await prisma.payment.findUnique({ where: { id: prepB.paymentId } }))?.status, "APPROVED");
    assert.equal((await prisma.order.findUnique({ where: { id: orderB.orderId } }))?.status, "PAID");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lessonB.id, status: "ACTIVE" } }), 1);

    // Timeout tardio após aprovação
    const lateTimeout = await updateOpenPaymentMarkers(prepB.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: "fp:pix-b",
    });
    assert.equal(lateTimeout.updated, false);
    assert.equal(lateTimeout.currentStatus, "APPROVED");

    // Após aprovação, novo checkout do mesmo produto (já owned) não abre cobrança concorrente
    const afterPaid = await createOrderForUser(userId, [{ type: "LESSON", id: lessonB.id }], `dddddddd-dddd-4ddd-8ddd-${uuidTail}`);
    // already_owned ou zero — não deve criar PENDING_PAYMENT paralelo com cobrança
    if (afterPaid.ok) {
      const row = await prisma.order.findUnique({ where: { id: afterPaid.orderId } });
      assert.notEqual(row?.status, "PENDING_PAYMENT");
    }

    // --- Cenário C: HTTP rejected depois de APPROVED (pedido limpo) ---
    const lessonC = await prisma.lesson.create({
      data: {
        moduleId: moduleRow.id,
        slug: `conc-lesson-c-${stamp}`,
        title: "Aula C",
        summary: "Resumo",
        status: "PUBLISHED",
        accessType: "PAID",
        commerceStatus: "AVAILABLE",
        priceCents: 2490,
        publishedAt: new Date(),
      },
    });
    const orderC = await createOrderForUser(userId, [{ type: "LESSON", id: lessonC.id }], `eeeeeeee-eeee-4eee-8eee-${uuidTail}`);
    assert.equal(orderC.ok, true);
    if (!orderC.ok) return;
    const prepC = await preparePaymentAttempt(userId, orderC.orderId);
    assert.equal(prepC.ok, true);
    if (!prepC.ok) return;

    await applyProviderView(prepC.paymentId, {
      id: `mp-c-${stamp}`,
      status: "approved",
      statusDetail: null,
      amountCents: 2490,
      currency: "BRL",
      externalReference: orderC.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });
    await applyProviderView(prepC.paymentId, {
      id: `mp-c-late-${stamp}`,
      status: "rejected",
      statusDetail: "cc_rejected_other_reason",
      amountCents: 2490,
      currency: "BRL",
      externalReference: orderC.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });
    assert.equal((await prisma.payment.findUnique({ where: { id: prepC.paymentId } }))?.status, "APPROVED");
    assert.equal((await prisma.order.findUnique({ where: { id: orderC.orderId } }))?.status, "PAID");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lessonC.id, status: "ACTIVE" } }), 1);

    // Fingerprint divergente: prepare resume_idempotent com status unknown em pedido novo
    const lessonD = await prisma.lesson.create({
      data: {
        moduleId: moduleRow.id,
        slug: `conc-lesson-d-${stamp}`,
        title: "Aula D",
        summary: "Resumo",
        status: "PUBLISHED",
        accessType: "PAID",
        commerceStatus: "AVAILABLE",
        priceCents: 1190,
        publishedAt: new Date(),
      },
    });
    const orderD = await createOrderForUser(userId, [{ type: "LESSON", id: lessonD.id }], `ffffffff-ffff-4fff-8fff-${uuidTail}`);
    assert.equal(orderD.ok, true);
    if (!orderD.ok) return;
    const prepD = await preparePaymentAttempt(userId, orderD.orderId);
    assert.equal(prepD.ok, true);
    if (!prepD.ok) return;
    await prisma.payment.update({
      where: { id: prepD.paymentId },
      data: { providerStatus: PROVIDER_STATUS_UNKNOWN, providerStatusDetail: "fp:original" },
    });
    const sameKey = await preparePaymentAttempt(userId, orderD.orderId);
    assert.equal(sameKey.ok && sameKey.idempotencyKey, prepD.idempotencyKey);
    assert.equal(sameKey.ok && sameKey.mode, "resume_idempotent");
    // checkoutKey novo ainda bloqueado
    const blockedD = await createOrderForUser(userId, [{ type: "LESSON", id: lessonD.id }], randomUUID());
    assert.equal(blockedD.ok, false);
  } finally {
    setPurchaseEmailSenderForTests(null);
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.course.delete({ where: { id: course.id } });
    for (const [key, value] of Object.entries({
      COMMERCE_ENABLED: previous.commerce,
      MERCADO_PAGO_ENV: previous.mpEnv,
      NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY: previous.key,
      MERCADO_PAGO_ACCESS_TOKEN: previous.token,
      MERCADO_PAGO_WEBHOOK_SECRET: previous.secret,
      DATABASE_ENV: previous.database,
      VERCEL_ENV: previous.vercel,
      RESEND_API_KEY: previous.resend,
    })) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
