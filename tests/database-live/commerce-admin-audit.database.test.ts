import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";

loadEnv({ path: ".env.local" });

test("COM-AUDIT-1: classificação de teste, métricas e reconciliação sem entitlement duplicado", async () => {
  const { assertMigrationTargetAllowed } = await import("../../src/lib/db/urls");
  assertMigrationTargetAllowed();

  process.env.DATABASE_ENV = "development";
  delete process.env.VERCEL_ENV;
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY = "APP_USR-example-public";
  process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-example-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "example-webhook-secret";

  const { getPrisma } = await import("../../src/lib/db/prisma");
  const { createOrderForUser, preparePaymentAttempt } = await import("../../src/lib/commerce/orders");
  const { applyProviderView } = await import("../../src/lib/commerce/apply");
  const { computeCommerceMetrics, filterOrdersByAccountScope } = await import("../../src/lib/admin/commerce");
  const { writeAdminAuditLog } = await import("../../src/lib/admin/commerce-audit");

  const prisma = getPrisma();
  const stamp = Date.now();
  const adminId = `com-audit-admin-${stamp}`;
  const commercialId = `com-audit-c-${stamp}`;
  const testId = `com-audit-t-${stamp}`;

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
      id: testId,
      name: "Teste",
      email: `com-audit-t-${stamp}@example.com`,
      emailVerified: true,
      isTestAccount: true,
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
    const commercialOrder = await createOrderForUser(
      commercialId,
      [{ type: "LESSON", id: lesson.id }],
      `aaaaaaaa-aaaa-4aaa-8aaa-${String(stamp).padStart(12, "0").slice(-12)}`,
    );
    assert.equal(commercialOrder.ok, true);
    if (!commercialOrder.ok) return;

    const testOrder = await createOrderForUser(
      testId,
      [{ type: "LESSON", id: lesson.id }],
      `bbbbbbbb-bbbb-4bbb-8bbb-${String(stamp).padStart(12, "0").slice(-12)}`,
    );
    assert.equal(testOrder.ok, true);
    if (!testOrder.ok) return;

    const prepared = await preparePaymentAttempt(commercialId, commercialOrder.orderId, {
      channel: "checkout",
      correlationId: randomUUID(),
      deviceCategory: "desktop",
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;

    const paymentRow = await prisma.payment.findUnique({ where: { id: prepared.paymentId } });
    assert.equal(paymentRow?.originChannel, "checkout");
    assert.ok(paymentRow?.originCorrelationId);
    assert.equal(paymentRow?.originDeviceCategory, "desktop");

    const providerId = `mp-com-audit-${stamp}`;
    await prisma.payment.update({
      where: { id: prepared.paymentId },
      data: { providerPaymentId: providerId },
    });

    await applyProviderView(prepared.paymentId, {
      id: providerId,
      status: "approved",
      statusDetail: "accredited",
      amountCents: 3990,
      currency: "BRL",
      externalReference: commercialOrder.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });

    const entitlementsAfterFirst = await prisma.entitlement.count({
      where: { userId: commercialId, status: "ACTIVE" },
    });
    assert.ok(entitlementsAfterFirst >= 1);

    await applyProviderView(prepared.paymentId, {
      id: providerId,
      status: "approved",
      statusDetail: "accredited",
      amountCents: 3990,
      currency: "BRL",
      externalReference: commercialOrder.orderId,
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    });

    const entitlementsAfterSecond = await prisma.entitlement.count({
      where: { userId: commercialId, status: "ACTIVE" },
    });
    assert.equal(entitlementsAfterSecond, entitlementsAfterFirst);

    await writeAdminAuditLog({
      actorUserId: adminId,
      action: "test_account_set",
      targetType: "user",
      targetId: testId,
      summary: "Fixture: confirma classificação de teste.",
    });
    const auditCount = await prisma.adminAuditLog.count({ where: { targetId: testId } });
    assert.equal(auditCount, 1);

    const orders = await prisma.order.findMany({
      where: { id: { in: [commercialOrder.orderId, testOrder.orderId] } },
      include: {
        user: { select: { isTestAccount: true } },
        items: { select: { titleSnapshot: true } },
        payments: true,
      },
    });
    const snaps = orders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      userId: o.userId,
      isTestAccount: o.user.isTestAccount,
      productTitles: o.items.map((i) => i.titleSnapshot),
      payments: o.payments.map((p) => ({
        id: p.id,
        status: p.status,
        amountCents: p.amountCents,
        refundedAmountCents: p.refundedAmountCents,
        paymentMethodType: p.paymentMethodType,
        providerPaymentId: p.providerPaymentId,
        providerStatus: p.providerStatus,
        providerStatusDetail: p.providerStatusDetail,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    }));

    const commercialOnly = filterOrdersByAccountScope(snaps, "commercial");
    assert.equal(commercialOnly.length, 1);
    assert.equal(commercialOnly[0]?.id, commercialOrder.orderId);
    const metrics = computeCommerceMetrics(commercialOnly);
    assert.equal(metrics.paidOrders, 1);
    assert.equal(metrics.approvedRevenueCents, 3990);
  } finally {
    await prisma.adminAuditLog.deleteMany({ where: { actorUserId: adminId } });
    await prisma.entitlement.deleteMany({ where: { userId: { in: [commercialId, testId] } } });
    await prisma.payment.deleteMany({
      where: { order: { userId: { in: [commercialId, testId] } } },
    });
    await prisma.orderItemLesson.deleteMany({
      where: { orderItem: { order: { userId: { in: [commercialId, testId] } } } },
    });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [commercialId, testId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [commercialId, testId] } } });
    await prisma.lesson.deleteMany({ where: { moduleId: moduleRow.id } });
    await prisma.module.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, commercialId, testId] } } });
  }
});
