import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import type { ProviderPaymentView } from "../../src/lib/commerce/reconcile";

loadEnv({ path: ".env.commerce-isolated.local" });
loadEnv({ path: ".env.local" });

function view(patch: Partial<ProviderPaymentView> & { id: string; externalReference: string }): ProviderPaymentView {
  return {
    status: "approved",
    statusDetail: "accredited",
    amountCents: 3990,
    currency: "BRL",
    paymentTypeId: "pix",
    installments: null,
    refundedCents: 0,
    ...patch,
  };
}

test("COM-AUDIT-1.2: proteção compartilhada webhook/admin (7 cenários)", async () => {
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
  const { applyProviderView } = await import("../../src/lib/commerce/apply");
  const { reconcileAdminPaymentService } = await import("../../src/lib/admin/commerce-reconcile");

  const prisma = getPrisma();
  const stamp = Date.now();
  const adminId = `prot-admin-${stamp}`;
  const userId = `prot-user-${stamp}`;

  await prisma.user.create({
    data: {
      id: adminId,
      name: "Admin",
      email: `prot-admin-${stamp}@example.com`,
      emailVerified: true,
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      id: userId,
      name: "User",
      email: `prot-user-${stamp}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const course = await prisma.course.create({
    data: {
      slug: `prot-${stamp}`,
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
      slug: `prot-l-${stamp}`,
      title: "Aula",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 3990,
      publishedAt: new Date(),
    },
  });

  async function freshPayment(label: string) {
    const created = await createOrderForUser(
      userId,
      [{ type: "LESSON", id: lesson.id }],
      randomUUID(),
    );
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("order");
    const prepared = await preparePaymentAttempt(userId, created.orderId, {
      channel: "checkout",
      correlationId: randomUUID(),
      deviceCategory: "desktop",
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) throw new Error("payment");
    const remoteId = `mp-${label}-${stamp}`;
    await prisma.payment.update({
      where: { id: prepared.paymentId },
      data: { providerPaymentId: remoteId, paymentMethodType: "PIX", amountCents: 3990 },
    });
    return { orderId: created.orderId, paymentId: prepared.paymentId, remoteId };
  }

  try {
    // 1) Admin detecta método divergente
    const s1 = await freshPayment("admin-mismatch");
    const adminMismatch = await reconcileAdminPaymentService({
      actorUserId: adminId,
      paymentId: s1.paymentId,
      confirmed: true,
      fetchView: async () =>
        view({ id: s1.remoteId, externalReference: s1.orderId, paymentTypeId: "credit_card" }),
    });
    assert.equal(adminMismatch.outcome, "needs_review");
    const p1 = await prisma.payment.findUnique({ where: { id: s1.paymentId } });
    assert.equal(p1?.paymentMethodType, "PIX");
    assert.match(p1?.providerStatusDetail ?? "", /method_mismatch/);
    assert.equal((await prisma.entitlement.count({ where: { userId, status: "ACTIVE" } })), 0);

    // 2) Webhook posterior com o mesmo pagamento divergente
    const wh2 = await applyProviderView(
      s1.paymentId,
      view({ id: s1.remoteId, externalReference: s1.orderId, paymentTypeId: "credit_card" }),
    );
    assert.equal(wh2.outcome, "needs_review");
    const p2 = await prisma.payment.findUnique({ where: { id: s1.paymentId } });
    assert.equal(p2?.paymentMethodType, "PIX");
    assert.match(p2?.providerStatusDetail ?? "", /method_mismatch/);
    assert.equal((await prisma.order.findUnique({ where: { id: s1.orderId } }))?.status, "NEEDS_REVIEW");

    // 3) Webhook com método aparentemente compatível, divergência anterior permanece
    const wh3 = await applyProviderView(
      s1.paymentId,
      view({ id: s1.remoteId, externalReference: s1.orderId, paymentTypeId: "pix", status: "approved" }),
    );
    assert.equal(wh3.outcome, "needs_review");
    const p3 = await prisma.payment.findUnique({ where: { id: s1.paymentId } });
    assert.match(p3?.providerStatusDetail ?? "", /method_mismatch/);
    assert.notEqual(p3?.status, "APPROVED");
    assert.equal((await prisma.entitlement.count({ where: { userId, status: "ACTIVE" } })), 0);

    // 4) Dois IDs remotos concorrentes
    const s4 = await freshPayment("race-id");
    const first = await applyProviderView(
      s4.paymentId,
      view({ id: s4.remoteId, externalReference: s4.orderId, paymentTypeId: "pix" }),
    );
    assert.equal(first.outcome, "applied");
    const secondId = await applyProviderView(
      s4.paymentId,
      view({ id: `mp-other-${stamp}`, externalReference: s4.orderId, paymentTypeId: "pix" }),
    );
    assert.ok(secondId.outcome === "rejected" || secondId.outcome === "ignored");
    const p4 = await prisma.payment.findUnique({ where: { id: s4.paymentId } });
    assert.equal(p4?.providerPaymentId, s4.remoteId);

    // 5) Aprovação válida repetida sem duplicar entitlement
    const entsBefore = await prisma.entitlement.count({ where: { userId, status: "ACTIVE" } });
    const again = await applyProviderView(
      s4.paymentId,
      view({ id: s4.remoteId, externalReference: s4.orderId, paymentTypeId: "pix" }),
    );
    assert.ok(again.outcome === "applied" || again.outcome === "ignored");
    const entsAfter = await prisma.entitlement.count({ where: { userId, status: "ACTIVE" } });
    assert.equal(entsAfter, entsBefore);

    // 6) Reembolso legítimo
    const refund = await applyProviderView(
      s4.paymentId,
      view({
        id: s4.remoteId,
        externalReference: s4.orderId,
        paymentTypeId: "pix",
        status: "refunded",
        refundedCents: 3990,
      }),
    );
    assert.equal(refund.outcome, "applied");
    const p6 = await prisma.payment.findUnique({ where: { id: s4.paymentId } });
    assert.equal(p6?.status, "REFUNDED");
    const o6 = await prisma.order.findUnique({ where: { id: s4.orderId } });
    assert.equal(o6?.status, "REFUNDED");
    assert.equal(
      await prisma.entitlement.count({ where: { userId, status: "ACTIVE", orderItem: { orderId: s4.orderId } } }),
      0,
    );

    // 7) Falha de auditoria com rollback da alteração financeira
    const s7 = await freshPayment("audit-fail");
    const before7 = await prisma.payment.findUnique({ where: { id: s7.paymentId } });
    await assert.rejects(
      () =>
        applyProviderView(
          s7.paymentId,
          view({ id: s7.remoteId, externalReference: s7.orderId, paymentTypeId: "pix" }),
          {
            audit: {
              actorUserId: adminId,
              action: "payment_reconcile",
              targetType: "payment",
              targetId: s7.paymentId,
              summary: "__force_audit_fail__",
            },
          },
        ),
      /audit_write_failed/,
    );
    const after7 = await prisma.payment.findUnique({ where: { id: s7.paymentId } });
    assert.equal(after7?.status, before7?.status);
    assert.equal(after7?.status, "PENDING");
    assert.equal(
      await prisma.entitlement.count({ where: { orderItem: { orderId: s7.orderId }, status: "ACTIVE" } }),
      0,
    );
  } finally {
    await prisma.adminAuditLog.deleteMany({ where: { actorUserId: adminId } });
    await prisma.entitlement.deleteMany({ where: { userId } });
    await prisma.payment.deleteMany({ where: { order: { userId } } });
    await prisma.orderItemLesson.deleteMany({ where: { orderItem: { order: { userId } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId } } });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.lesson.deleteMany({ where: { moduleId: moduleRow.id } });
    await prisma.module.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, userId] } } });
  }
});
