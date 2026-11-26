import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import type { ProviderPaymentView } from "../../src/lib/commerce/reconcile";

loadEnv({ path: ".env.commerce-isolated.local" });
loadEnv({ path: ".env.local" });

test("COM-AUDIT-1.1: ações admin atômicas, método divergente e anti-duplicação", async () => {
  const { assertIsolatedCommerceLiveConnection, evaluateIsolatedCommerceDatabaseLive } = await import(
    "../../src/lib/db/urls"
  );
  const isolated = evaluateIsolatedCommerceDatabaseLive(process.env);
  assert.equal(isolated.ok, true, isolated.ok ? "" : isolated.message);
  await assertIsolatedCommerceLiveConnection(process.env);

  process.env.DATABASE_ENV = "test";
  delete process.env.VERCEL_ENV;
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createOrderForUser, preparePaymentAttempt } = await import("../../src/lib/commerce/orders");
  const {
    reconcileAdminPaymentService,
    setUserTestAccountAtomic,
  } = await import("../../src/lib/admin/commerce-reconcile");

  const prisma = getPrisma();
  const stamp = Date.now();
  const adminId = `com-audit-admin-${stamp}`;
  const commercialId = `com-audit-c-${stamp}`;
  const commonId = `com-audit-u-${stamp}`;

  await prisma.user.create({
    data: {
      id: adminId,
      name: "Admin",
      email: `com-audit-admin-${stamp}@example.com`,
      emailVerified: true,
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      id: commercialId,
      name: "Comercial",
      email: `com-audit-c-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      id: commonId,
      name: "Comum",
      email: `com-audit-u-${stamp}@example.com`,
      emailVerified: true,
      role: "USER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const course = await prisma.course.create({
    data: {
      slug: `com-audit-${stamp}`,
      title: "Fixture",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 5000,
      publishedAt: new Date(),
    },
  });
  const moduleRow = await prisma.module.create({
    data: {
      courseId: course.id,
      slug: "pacote",
      title: "Pacote",
      description: "Teste",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 3990,
    },
  });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `com-audit-l-${stamp}`,
      title: "Aula",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 3990,
      publishedAt: new Date(),
    },
  });

  try {
    const invalidFlag = await setUserTestAccountAtomic({
      actorUserId: adminId,
      userId: commercialId,
      isTestAccountRaw: "yes",
    });
    assert.equal(invalidFlag.ok, false);

    const marked = await setUserTestAccountAtomic({
      actorUserId: adminId,
      userId: commercialId,
      isTestAccountRaw: "1",
    });
    assert.equal(marked.ok, true);
    if (marked.ok) assert.equal(marked.changed, true);

    const userAfter = await prisma.user.findUnique({ where: { id: commercialId } });
    assert.equal(userAfter?.isTestAccount, true);
    const auditAfterSet = await prisma.adminAuditLog.count({
      where: { targetId: commercialId, action: "test_account_set" },
    });
    assert.equal(auditAfterSet, 1);

    const cleared = await setUserTestAccountAtomic({
      actorUserId: adminId,
      userId: commercialId,
      isTestAccountRaw: "0",
    });
    assert.equal(cleared.ok, true);

    const created = await createOrderForUser(
      commercialId,
      [{ type: "LESSON", id: lesson.id }],
      `aaaaaaaa-aaaa-4aaa-8aaa-${String(stamp).padStart(12, "0").slice(-12)}`,
    );
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const prepared = await preparePaymentAttempt(commercialId, created.orderId, {
      channel: "checkout",
      correlationId: randomUUID(),
      deviceCategory: "desktop",
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;

    const providerId = `mp-com-audit-${stamp}`;
    await prisma.payment.update({
      where: { id: prepared.paymentId },
      data: {
        providerPaymentId: providerId,
        paymentMethodType: "PIX",
        amountCents: 3990,
      },
    });

    const mismatchView: ProviderPaymentView = {
      id: providerId,
      status: "approved",
      statusDetail: "accredited",
      amountCents: 3990,
      currency: "BRL",
      externalReference: created.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    };

    const mismatch = await reconcileAdminPaymentService({
      actorUserId: adminId,
      paymentId: prepared.paymentId,
      confirmed: true,
      fetchView: async () => mismatchView,
    });
    assert.equal(mismatch.outcome, "needs_review");

    const paymentAfterMismatch = await prisma.payment.findUnique({ where: { id: prepared.paymentId } });
    assert.equal(paymentAfterMismatch?.paymentMethodType, "PIX");
    assert.match(paymentAfterMismatch?.providerStatusDetail ?? "", /method_mismatch/);

    const orderAfterMismatch = await prisma.order.findUnique({ where: { id: created.orderId } });
    assert.equal(orderAfterMismatch?.status, "NEEDS_REVIEW");

    const repeat = await reconcileAdminPaymentService({
      actorUserId: adminId,
      paymentId: prepared.paymentId,
      confirmed: true,
      fetchView: async () => ({ ...mismatchView, paymentTypeId: "pix" }),
    });
    assert.equal(repeat.outcome, "needs_review");
    assert.match(repeat.reason, /previamente/i);

    const remoteMismatch = await reconcileAdminPaymentService({
      actorUserId: adminId,
      paymentId: prepared.paymentId,
      confirmed: true,
      fetchView: async () => ({ ...mismatchView, id: "other-id", paymentTypeId: "pix" }),
    });
    assert.equal(remoteMismatch.outcome, "rejected");

    // Limpa divergência para testar apply + entitlement idempotente.
    await prisma.payment.update({
      where: { id: prepared.paymentId },
      data: { providerStatusDetail: null, paymentMethodType: "PIX" },
    });
    await prisma.order.update({
      where: { id: created.orderId },
      data: { status: "PENDING_PAYMENT" },
    });

    const okView: ProviderPaymentView = {
      id: providerId,
      status: "approved",
      statusDetail: "accredited",
      amountCents: 3990,
      currency: "BRL",
      externalReference: created.orderId,
      paymentTypeId: "pix",
      installments: null,
      refundedCents: 0,
    };

    const applied = await reconcileAdminPaymentService({
      actorUserId: adminId,
      paymentId: prepared.paymentId,
      confirmed: true,
      fetchView: async () => okView,
    });
    assert.equal(applied.outcome, "applied");

    const entitlements1 = await prisma.entitlement.count({
      where: { userId: commercialId, status: "ACTIVE" },
    });
    assert.ok(entitlements1 >= 1);

    const again = await reconcileAdminPaymentService({
      actorUserId: adminId,
      paymentId: prepared.paymentId,
      confirmed: true,
      fetchView: async () => okView,
    });
    assert.ok(again.outcome === "applied" || again.outcome === "ignored");

    const entitlements2 = await prisma.entitlement.count({
      where: { userId: commercialId, status: "ACTIVE" },
    });
    assert.equal(entitlements2, entitlements1);

    const methodStillPix = await prisma.payment.findUnique({ where: { id: prepared.paymentId } });
    assert.equal(methodStillPix?.paymentMethodType, "PIX");
  } finally {
    await prisma.adminAuditLog.deleteMany({
      where: { actorUserId: adminId },
    });
    await prisma.entitlement.deleteMany({ where: { userId: { in: [commercialId, commonId] } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: [commercialId, commonId] } } } });
    await prisma.orderItemLesson.deleteMany({
      where: { orderItem: { order: { userId: { in: [commercialId, commonId] } } } },
    });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [commercialId, commonId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [commercialId, commonId] } } });
    await prisma.lesson.deleteMany({ where: { moduleId: moduleRow.id } });
    await prisma.module.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, commercialId, commonId] } } });
  }
});
