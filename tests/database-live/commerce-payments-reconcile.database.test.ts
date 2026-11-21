import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { setPurchaseEmailSenderForTests } from "../../src/lib/email/purchase-mail";
import {
  assertIsolatedCommerceDatabaseLive,
  assertIsolatedCommerceLiveConnection,
} from "../../src/lib/db/urls";
import type { ProviderPaymentView } from "../../src/lib/commerce/reconcile";

loadEnv({ path: ".env.commerce-isolated.local", override: true });
delete process.env.VERCEL_ENV;
delete process.env.UNIT_TEST_ISOLATION;

async function requireIsolatedGate() {
  delete process.env.VERCEL_ENV;
  const declared = assertIsolatedCommerceDatabaseLive();
  const probed = await assertIsolatedCommerceLiveConnection();
  assert.equal(probed.declared.database, declared.identity.database);
  assert.notEqual((process.env.MERCADO_PAGO_ENV ?? "").toLowerCase(), "production");
  return declared.identity;
}

function pixView(
  partial: Partial<ProviderPaymentView> & Pick<ProviderPaymentView, "id" | "externalReference" | "amountCents">,
): ProviderPaymentView {
  return {
    status: "pending",
    statusDetail: "pending_waiting_transfer",
    currency: "BRL",
    paymentTypeId: "bank_transfer",
    installments: 1,
    refundedCents: 0,
    ...partial,
  };
}

test("payments reconcile isolado: tentativa correta, webhook payment, entitlement único, reembolso", async () => {
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

  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { reconcileFetchedProviderView, applyProviderView } = await import("../../src/lib/commerce/apply");
  const { webhookLiveModeAllowed } = await import("../../src/lib/commerce/config");
  const { verifyMercadoPagoSignature } = await import("../../src/lib/commerce/signature");

  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `pay-rec-${stamp}`;
  const secret = "example-webhook-secret";
  let courseId = "";

  try {
    await prisma.user.create({
      data: {
        id: userId,
        name: "PayRec",
        email: `pay-rec-${stamp}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const course = await prisma.course.create({
      data: {
        slug: `pay-rec-course-${stamp}`,
        title: "PayRec",
        description: "Isolado",
        status: "PUBLISHED",
        commerceStatus: "AVAILABLE",
        bundlePriceCents: 1490,
        publishedAt: new Date(),
      },
    });
    courseId = course.id;

    const moduleRow = await prisma.module.create({
      data: {
        courseId: course.id,
        slug: `pay-rec-mod-${stamp}`,
        title: "Módulo",
        description: "Isolado",
        status: "PUBLISHED",
        commerceStatus: "AVAILABLE",
        bundlePriceCents: 1490,
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: moduleRow.id,
        slug: `pay-rec-lesson-${stamp}`,
        title: "Aula",
        summary: "Resumo",
        status: "PUBLISHED",
        accessType: "PAID",
        commerceStatus: "AVAILABLE",
        priceCents: 1490,
        publishedAt: new Date(),
      },
    });

    const order = await prisma.order.create({
      data: {
        userId,
        status: "PENDING_PAYMENT",
        currency: "BRL",
        subtotalCents: 1490,
        creditCents: 0,
        totalCents: 1490,
        checkoutKey: `pay-rec-ck-${stamp}`,
        items: {
          create: {
            productType: "LESSON",
            lessonId: lesson.id,
            titleSnapshot: "Aula",
            listPriceCents: 1490,
            creditAppliedCents: 0,
            finalPriceCents: 1490,
            lessons: { create: { lessonId: lesson.id } },
          },
        },
      },
    });

    const rejectedOrders = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "MERCADO_PAGO",
        providerPaymentId: `ORD-old-${stamp}`,
        providerApiKind: "orders",
        idempotencyKey: `idem-old-${stamp}`,
        status: "REJECTED",
        amountCents: 1490,
        paymentMethodType: "PIX",
        providerStatus: "failed",
        providerStatusDetail: "processing_error",
      },
    });

    const pendingPayments = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "MERCADO_PAGO",
        providerPaymentId: null,
        providerApiKind: "payments",
        idempotencyKey: `idem-new-${stamp}`,
        status: "PENDING",
        amountCents: 1490,
        paymentMethodType: "PIX",
        providerStatus: "charge_dispatched",
        providerStatusDetail: "fp-payments",
      },
    });

    const race = await reconcileFetchedProviderView(
      pixView({
        id: `mp-pay-${stamp}`,
        externalReference: order.id,
        amountCents: 1490,
        status: "pending",
      }),
      "payments",
    );
    assert.equal(race.ok, true);
    assert.equal(
      (await prisma.payment.findUnique({ where: { id: pendingPayments.id } }))?.providerPaymentId,
      `mp-pay-${stamp}`,
    );
    assert.equal(
      (await prisma.payment.findUnique({ where: { id: rejectedOrders.id } }))?.providerPaymentId,
      `ORD-old-${stamp}`,
    );

    const approved = await reconcileFetchedProviderView(
      pixView({
        id: `mp-pay-${stamp}`,
        externalReference: order.id,
        amountCents: 1490,
        status: "approved",
        statusDetail: "accredited",
      }),
      "payments",
    );
    assert.equal(approved.ok, true);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } }))?.status, "PAID");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id, status: "ACTIVE" } }), 1);

    await reconcileFetchedProviderView(
      pixView({
        id: `mp-pay-${stamp}`,
        externalReference: order.id,
        amountCents: 1490,
        status: "approved",
        statusDetail: "accredited",
      }),
      "payments",
    );
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id, status: "ACTIVE" } }), 1);

    const stale = await reconcileFetchedProviderView(
      pixView({
        id: `ORD-old-${stamp}`,
        externalReference: order.id,
        amountCents: 1490,
        status: "rejected",
        statusDetail: "processing_error",
      }),
      "orders",
    );
    assert.equal(stale.ok, true);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } }))?.status, "PAID");
    assert.equal((await prisma.payment.findUnique({ where: { id: pendingPayments.id } }))?.status, "APPROVED");

    const otherOrder = await prisma.order.create({
      data: {
        userId,
        status: "PENDING_PAYMENT",
        currency: "BRL",
        subtotalCents: 1490,
        creditCents: 0,
        totalCents: 1490,
        checkoutKey: `pay-rec-ck-div-${stamp}`,
        items: {
          create: {
            productType: "LESSON",
            lessonId: lesson.id,
            titleSnapshot: "Aula",
            listPriceCents: 1490,
            creditAppliedCents: 0,
            finalPriceCents: 1490,
            lessons: { create: { lessonId: lesson.id } },
          },
        },
        payments: {
          create: {
            provider: "MERCADO_PAGO",
            providerPaymentId: `mp-card-${stamp}`,
            providerApiKind: "payments",
            idempotencyKey: `idem-div-${stamp}`,
            status: "PENDING",
            amountCents: 1490,
            paymentMethodType: "PIX",
            providerStatus: "pending",
          },
        },
      },
    });
    // Corrida com cartão remoto em tentativa PIX aberta sem ID → recusa associação.
    const raceDivergent = await reconcileFetchedProviderView(
      pixView({
        id: `mp-card-race-${stamp}`,
        externalReference: otherOrder.id,
        amountCents: 1490,
        status: "approved",
        paymentTypeId: "credit_card",
      }),
      "payments",
    );
    assert.equal(raceDivergent.ok, false);

    // ID já vinculado + método divergente (2×) → NEEDS_REVIEW, método PIX preservado, zero entitlements.
    const divergentView = pixView({
      id: `mp-card-${stamp}`,
      externalReference: otherOrder.id,
      amountCents: 1490,
      status: "approved",
      paymentTypeId: "credit_card",
    });
    const divergent1 = await reconcileFetchedProviderView(divergentView, "payments");
    const divergent2 = await reconcileFetchedProviderView(divergentView, "payments");
    assert.equal(divergent1.ok, true);
    assert.equal(divergent2.ok, true);
    assert.equal((await prisma.order.findUnique({ where: { id: otherOrder.id } }))?.status, "NEEDS_REVIEW");
    const divergentPayment = await prisma.payment.findFirst({
      where: { orderId: otherOrder.id, providerPaymentId: `mp-card-${stamp}` },
    });
    assert.equal(divergentPayment?.paymentMethodType, "PIX");
    assert.equal(
      await prisma.entitlement.count({ where: { orderItem: { orderId: otherOrder.id }, status: "ACTIVE" } }),
      0,
    );

    // Dois IDs remotos distintos na mesma tentativa aberta — só um vincula.
    const raceOrder = await prisma.order.create({
      data: {
        userId,
        status: "PENDING_PAYMENT",
        currency: "BRL",
        subtotalCents: 1490,
        creditCents: 0,
        totalCents: 1490,
        checkoutKey: `pay-rec-ck-race-${stamp}`,
        items: {
          create: {
            productType: "LESSON",
            lessonId: lesson.id,
            titleSnapshot: "Aula",
            listPriceCents: 1490,
            creditAppliedCents: 0,
            finalPriceCents: 1490,
            lessons: { create: { lessonId: lesson.id } },
          },
        },
        payments: {
          create: {
            provider: "MERCADO_PAGO",
            providerPaymentId: null,
            providerApiKind: "payments",
            idempotencyKey: `idem-race-${stamp}`,
            status: "PENDING",
            amountCents: 1490,
            paymentMethodType: "PIX",
            providerStatus: "charge_dispatched",
          },
        },
      },
      include: { payments: true },
    });
    const racePaymentId = raceOrder.payments[0].id;
    const [remoteA, remoteB] = await Promise.all([
      reconcileFetchedProviderView(
        pixView({
          id: `mp-race-a-${stamp}`,
          externalReference: raceOrder.id,
          amountCents: 1490,
          status: "approved",
        }),
        "payments",
      ),
      reconcileFetchedProviderView(
        pixView({
          id: `mp-race-b-${stamp}`,
          externalReference: raceOrder.id,
          amountCents: 1490,
          status: "approved",
        }),
        "payments",
      ),
    ]);
    assert.equal([remoteA.ok, remoteB.ok].filter(Boolean).length, 1);
    const raced = await prisma.payment.findUnique({ where: { id: racePaymentId } });
    assert.ok(raced?.providerPaymentId === `mp-race-a-${stamp}` || raced?.providerPaymentId === `mp-race-b-${stamp}`);
    assert.equal(raced?.paymentMethodType, "PIX");
    assert.equal(
      await prisma.entitlement.count({ where: { orderItem: { orderId: raceOrder.id }, status: "ACTIVE" } }),
      1,
    );

    await applyProviderView(
      pendingPayments.id,
      pixView({
        id: `mp-pay-${stamp}`,
        externalReference: order.id,
        amountCents: 1490,
        status: "refunded",
        refundedCents: 1490,
      }),
    );
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } }))?.status, "REFUNDED");
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id, status: "ACTIVE" } }), 0);

    assert.equal(webhookLiveModeAllowed("test", false), true);
    assert.equal(webhookLiveModeAllowed("test", true), false);
    const dataId = `mp-pay-${stamp}`;
    const requestId = randomUUID();
    const ts = String(Math.floor(Date.now() / 1000));
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
    assert.equal(
      verifyMercadoPagoSignature({
        secret,
        xSignature: `ts=${ts},v1=${v1}`,
        xRequestId: requestId,
        dataId,
      }),
      true,
    );
    assert.equal(
      verifyMercadoPagoSignature({
        secret,
        xSignature: `ts=${ts},v1=deadbeef`,
        xRequestId: requestId,
        dataId,
      }),
      false,
    );

    const { POST } = await import("../../src/app/api/webhooks/mercado-pago/route");
    const invalid = await POST(
      new Request(`http://localhost/api/webhooks/mercado-pago?data.id=${dataId}&type=payment`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": `ts=${ts},v1=invalida`,
          "x-request-id": requestId,
        },
        body: JSON.stringify({
          type: "payment",
          action: "payment.updated",
          data: { id: dataId },
          live_mode: false,
        }),
      }),
    );
    assert.equal(invalid.status, 401);
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    if (courseId) await prisma.course.delete({ where: { id: courseId } }).catch(() => undefined);
    setPurchaseEmailSenderForTests(null);
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
