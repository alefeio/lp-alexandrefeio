import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { setPurchaseEmailSenderForTests } from "../../src/lib/email/purchase-mail";
import {
  assertIsolatedCommerceDatabaseLive,
  assertIsolatedCommerceLiveConnection,
} from "../../src/lib/db/urls";

loadEnv({ path: ".env.commerce-isolated.local", override: true });
delete process.env.VERCEL_ENV;
delete process.env.UNIT_TEST_ISOLATION;

async function requireIsolatedGate() {
  delete process.env.VERCEL_ENV;
  const declared = assertIsolatedCommerceDatabaseLive();
  const probed = await assertIsolatedCommerceLiveConnection();
  assert.equal(probed.live.database, declared.identity.database);
  assert.notEqual((process.env.MERCADO_PAGO_ENV ?? "").toLowerCase(), "production");
  return declared.identity;
}

test("recuperação: retomar, overlap, rejeição, incerteza, recompra, preço e concorrência", async () => {
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
  const {
    cancelAbandonedCheckoutForUser,
    createOrderForUser,
    getRepurchasePriceNoticeForUser,
    getResumeCheckoutForUser,
    preparePaymentAttempt,
    repurchaseCancelledOrderForUser,
  } = await import("../../src/lib/commerce/orders");
  const { applyProviderView, claimChargeDispatch, updateOpenPaymentMarkers } = await import("../../src/lib/commerce/apply");
  const {
    PROVIDER_STATUS_DISPATCHED,
    PROVIDER_STATUS_UNKNOWN,
    chargeFingerprint,
    encodeChargeFingerprint,
  } = await import("../../src/lib/commerce/provider");
  const { hasActiveEntitlement } = await import("../../src/lib/commerce/access");

  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `recov-iso-${stamp}`;
  let courseId = "";

  await prisma.user.create({
    data: {
      id: userId,
      name: "RecovIso",
      email: `recov-iso-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const course = await prisma.course.create({
    data: {
      slug: `recov-${stamp}`,
      title: "Recov",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 9990,
      publishedAt: new Date(),
    },
  });
  courseId = course.id;

  const moduleRow = await prisma.module.create({
    data: {
      courseId: course.id,
      slug: `recov-mod-${stamp}`,
      title: "Módulo",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 2690,
    },
  });
  const lessonA = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `recov-aula-a-${stamp}`,
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
      slug: `recov-aula-b-${stamp}`,
      title: "Aula B",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 1590,
      publishedAt: new Date(),
    },
  });

  try {
    // 1) Retomar pedido pendente sem cobrança (lessonA)
    const pending = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(pending.ok, true);
    if (!pending.ok) return;
    const resumePending = await getResumeCheckoutForUser(userId, pending.orderId);
    assert.equal(resumePending.ok, true);
    if (!resumePending.ok) return;
    assert.equal(resumePending.totalCents, 1490);
    assert.equal(resumePending.redirectPurchase, false);

    // 2) Após rejeição, permite nova tentativa no mesmo orderId
    const rejectedAttempt = await preparePaymentAttempt(userId, pending.orderId);
    assert.equal(rejectedAttempt.ok, true);
    if (!rejectedAttempt.ok) return;
    await updateOpenPaymentMarkers(rejectedAttempt.paymentId, {
      status: "REJECTED",
      providerStatus: "request_failed",
      providerStatusDetail: encodeChargeFingerprint(
        chargeFingerprint({ orderId: pending.orderId, amountCents: 1490, paymentMethodId: "pix", payerEmail: "a@test.com" }),
      ),
    });
    const afterReject = await preparePaymentAttempt(userId, pending.orderId);
    assert.equal(afterReject.ok, true);
    if (!afterReject.ok) return;
    assert.equal(afterReject.mode, "fresh");
    assert.notEqual(afterReject.paymentId, rejectedAttempt.paymentId);

    // 3) Negativo: overlap permanece ativo enquanto lessonA está PENDING_PAYMENT
    const blockedModule = await createOrderForUser(userId, [{ type: "MODULE", id: moduleRow.id }], randomUUID());
    assert.equal(blockedModule.ok, false);
    if (blockedModule.ok) return;
    assert.equal(blockedModule.code, "checkout_overlap");

    // 4) Incerteza em lessonB (fixture independente — sem overlap com A)
    const uncertainOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lessonB.id }], randomUUID());
    assert.equal(uncertainOrder.ok, true);
    if (!uncertainOrder.ok) return;
    const uncertainAttempt = await preparePaymentAttempt(userId, uncertainOrder.orderId);
    assert.equal(uncertainAttempt.ok, true);
    if (!uncertainAttempt.ok) return;
    await updateOpenPaymentMarkers(uncertainAttempt.paymentId, {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: encodeChargeFingerprint(
        chargeFingerprint({
          orderId: uncertainOrder.orderId,
          amountCents: uncertainOrder.totalCents,
          paymentMethodId: "pix",
          payerEmail: "a@test.com",
        }),
      ),
    });
    const resumeUncertain = await getResumeCheckoutForUser(userId, uncertainOrder.orderId);
    assert.equal(resumeUncertain.ok, false);
    if (resumeUncertain.ok) return;
    assert.equal(resumeUncertain.code, "payment_uncertain");
    const claimDenied = await claimChargeDispatch({
      paymentId: uncertainAttempt.paymentId,
      fingerprintDetail: encodeChargeFingerprint(
        chargeFingerprint({
          orderId: uncertainOrder.orderId,
          amountCents: uncertainOrder.totalCents,
          paymentMethodId: "master",
          installments: 1,
          payerEmail: "b@test.com",
        }),
      ),
      method: "CREDIT_CARD",
    });
    assert.equal(claimDenied.ok, false);
    const refuseCancel = await cancelAbandonedCheckoutForUser(userId, uncertainOrder.orderId);
    assert.equal(refuseCancel.ok, false);
    if (refuseCancel.ok) return;
    assert.equal(refuseCancel.code, "payment_uncertain");
    // Encerramento de fixture QA (não é cancelamento automático de produção)
    await prisma.payment.update({
      where: { id: uncertainAttempt.paymentId },
      data: { status: "REJECTED", providerStatus: "request_failed", providerPaymentId: null },
    });
    await prisma.order.update({ where: { id: uncertainOrder.orderId }, data: { status: "CANCELLED" } });

    // 5) Cancelar abandonado de lessonA → recompra com preço recalculado
    const cancelledPending = await cancelAbandonedCheckoutForUser(userId, pending.orderId);
    assert.equal(cancelledPending.ok, true);
    const cancelTarget = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(cancelTarget.ok, true);
    if (!cancelTarget.ok) return;
    const cancelled = await cancelAbandonedCheckoutForUser(userId, cancelTarget.orderId);
    assert.equal(cancelled.ok, true);
    const cancelledRow = await prisma.order.findUnique({ where: { id: cancelTarget.orderId } });
    assert.equal(cancelledRow?.status, "CANCELLED");

    await prisma.lesson.update({ where: { id: lessonA.id }, data: { priceCents: 1990 } });
    const repurchase = await repurchaseCancelledOrderForUser(userId, cancelTarget.orderId, randomUUID());
    assert.equal(repurchase.ok, true);
    if (!repurchase.ok) return;
    assert.notEqual(repurchase.orderId, cancelTarget.orderId);
    assert.equal(repurchase.totalCents, 1990);
    assert.equal(repurchase.priceChanged, true);
    const stillCancelled = await prisma.order.findUnique({ where: { id: cancelTarget.orderId } });
    assert.equal(stillCancelled?.status, "CANCELLED");

    const notice = await getRepurchasePriceNoticeForUser(userId, repurchase.orderId, cancelTarget.orderId);
    assert.deepEqual(notice, { previousCents: 1490, currentCents: 1990 });
    const forged = await getRepurchasePriceNoticeForUser(userId, repurchase.orderId, "nao-existe");
    assert.equal(forged, null);

    // 6) Dois cliques em Comprar novamente com a mesma checkoutKey
    await cancelAbandonedCheckoutForUser(userId, repurchase.orderId);
    const cancelled2 = await createOrderForUser(userId, [{ type: "COURSE", id: course.id }], randomUUID());
    assert.equal(cancelled2.ok, true);
    if (!cancelled2.ok) return;
    await cancelAbandonedCheckoutForUser(userId, cancelled2.orderId);
    const twinKey = randomUUID();
    const [a, b] = await Promise.all([
      repurchaseCancelledOrderForUser(userId, cancelled2.orderId, twinKey),
      repurchaseCancelledOrderForUser(userId, cancelled2.orderId, twinKey),
    ]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.equal(a.orderId, b.orderId);

    // 7) Webhook tardio sem duplicar entitlements (lessonA)
    await cancelAbandonedCheckoutForUser(userId, a.orderId);
    const paidOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lessonA.id }], randomUUID());
    assert.equal(paidOrder.ok, true);
    if (!paidOrder.ok) return;
    const payAttempt = await preparePaymentAttempt(userId, paidOrder.orderId);
    assert.equal(payAttempt.ok, true);
    if (!payAttempt.ok) return;
    const fp = encodeChargeFingerprint(
      chargeFingerprint({
        orderId: paidOrder.orderId,
        amountCents: paidOrder.totalCents,
        paymentMethodId: "pix",
        payerEmail: "a@test.com",
      }),
    );
    await updateOpenPaymentMarkers(payAttempt.paymentId, {
      providerStatus: PROVIDER_STATUS_DISPATCHED,
      providerStatusDetail: fp,
    });
    const approvedView = {
      id: `ORD-RECOV-${stamp}`,
      status: "approved",
      statusDetail: "accredited",
      amountCents: paidOrder.totalCents,
      currency: "BRL",
      externalReference: paidOrder.orderId,
      paymentTypeId: "bank_transfer",
      installments: null,
      refundedCents: 0,
    };
    await applyProviderView(payAttempt.paymentId, approvedView);
    await applyProviderView(payAttempt.paymentId, approvedView);
    const entitlements = await prisma.entitlement.count({
      where: { userId, lessonId: lessonA.id, status: "ACTIVE" },
    });
    assert.equal(entitlements, 1);
    assert.equal(await hasActiveEntitlement(userId, lessonA.id), true);
    const orderPaid = await prisma.order.findUnique({ where: { id: paidOrder.orderId } });
    assert.equal(orderPaid?.status, "PAID");
  } finally {
    setPurchaseEmailSenderForTests(null);
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    if (courseId) {
      await prisma.course.delete({ where: { id: courseId } }).catch(() => undefined);
    }
    if (previous.commerce === undefined) delete process.env.COMMERCE_ENABLED;
    else process.env.COMMERCE_ENABLED = previous.commerce;
    if (previous.mpEnv === undefined) delete process.env.MERCADO_PAGO_ENV;
    else process.env.MERCADO_PAGO_ENV = previous.mpEnv;
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;
    else process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = previous.key;
    if (previous.token === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    else process.env.MERCADO_PAGO_ACCESS_TOKEN = previous.token;
    if (previous.secret === undefined) delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    else process.env.MERCADO_PAGO_WEBHOOK_SECRET = previous.secret;
    if (previous.resend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous.resend;
  }
});
