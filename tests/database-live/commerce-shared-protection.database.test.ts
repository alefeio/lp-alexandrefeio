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

test("COM-AUDIT-1.2: proteção compartilhada webhook/admin (fechamento segurança)", async () => {
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

  async function freshPayment(label: string, opts?: { bindRemote?: boolean }) {
    // Libera sobreposição / entitlement entre cenários do mesmo fixture.
    await prisma.entitlement.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await prisma.payment.updateMany({
      where: { order: { userId }, status: { in: ["PENDING", "IN_PROCESS"] } },
      data: { status: "CANCELLED", providerStatus: "test_cleanup", providerStatusDetail: "scenario" },
    });
    await prisma.order.updateMany({
      where: { userId, status: { in: ["PENDING_PAYMENT", "NEEDS_REVIEW", "PAID"] } },
      data: { status: "CANCELLED" },
    });

    const created = await createOrderForUser(
      userId,
      [{ type: "LESSON", id: lesson.id }],
      randomUUID(),
    );
    assert.equal(created.ok, true, created.ok ? "" : created.message);
    if (!created.ok) throw new Error("order");
    const prepared = await preparePaymentAttempt(userId, created.orderId, {
      channel: "checkout",
      correlationId: randomUUID(),
      deviceCategory: "desktop",
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) throw new Error("payment");
    const remoteId = `mp-${label}-${stamp}`;
    const bindRemote = opts?.bindRemote !== false;
    await prisma.payment.update({
      where: { id: prepared.paymentId },
      data: {
        providerPaymentId: bindRemote ? remoteId : null,
        paymentMethodType: "PIX",
        amountCents: 3990,
      },
    });
    return { orderId: created.orderId, paymentId: prepared.paymentId, remoteId };
  }

  async function snapshot(paymentId: string, orderId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const ents = await prisma.entitlement.findMany({
      where: { orderItem: { orderId } },
      select: { status: true },
    });
    return {
      paymentStatus: payment?.status ?? null,
      providerPaymentId: payment?.providerPaymentId ?? null,
      paymentMethodType: payment?.paymentMethodType ?? null,
      providerStatusDetail: payment?.providerStatusDetail ?? null,
      refundedAmountCents: payment?.refundedAmountCents ?? null,
      orderStatus: order?.status ?? null,
      entitlements: ents.map((e) => e.status).sort(),
    };
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

    // 4) Dois IDs remotos efetivamente concorrentes — só um vínculo
    const s4 = await freshPayment("race-id", { bindRemote: false });
    const idA = `mp-race-a-${stamp}`;
    const idB = `mp-race-b-${stamp}`;
    const [rA, rB] = await Promise.all([
      applyProviderView(s4.paymentId, view({ id: idA, externalReference: s4.orderId, paymentTypeId: "pix" })),
      applyProviderView(s4.paymentId, view({ id: idB, externalReference: s4.orderId, paymentTypeId: "pix" })),
    ]);
    const outcomes = [rA.outcome, rB.outcome];
    assert.equal(outcomes.filter((o) => o === "applied").length, 1, `esperado 1 applied, got ${outcomes.join(",")}`);
    assert.equal(
      outcomes.filter((o) => o === "rejected" || o === "ignored").length,
      1,
      `esperado 1 rejected/ignored, got ${outcomes.join(",")}`,
    );
    const p4 = await prisma.payment.findUnique({ where: { id: s4.paymentId } });
    assert.ok(p4?.providerPaymentId === idA || p4?.providerPaymentId === idB);
    assert.equal(p4?.status, "APPROVED");
    const winnerId = p4!.providerPaymentId!;

    // 5) Aprovação válida repetida sem duplicar entitlement
    const entsBefore = await prisma.entitlement.count({ where: { userId, status: "ACTIVE" } });
    const again = await applyProviderView(
      s4.paymentId,
      view({ id: winnerId, externalReference: s4.orderId, paymentTypeId: "pix" }),
    );
    assert.ok(again.outcome === "applied" || again.outcome === "ignored");
    const entsAfter = await prisma.entitlement.count({ where: { userId, status: "ACTIVE" } });
    assert.equal(entsAfter, entsBefore);

    // 6) Reembolso legítimo (identidade ok)
    const refund = await applyProviderView(
      s4.paymentId,
      view({
        id: winnerId,
        externalReference: s4.orderId,
        paymentTypeId: "pix",
        status: "refunded",
        refundedCents: 3990,
      }),
      {
        audit: {
          actorUserId: adminId,
          action: "payment_reconcile",
          targetType: "payment",
          targetId: s4.paymentId,
          summary: "Reembolso legítimo fixture",
        },
      },
    );
    assert.equal(refund.outcome, "applied");
    assert.equal(refund.audited, true);
    const snap6 = await snapshot(s4.paymentId, s4.orderId);
    assert.equal(snap6.paymentStatus, "REFUNDED");
    assert.equal(snap6.orderStatus, "REFUNDED");
    assert.deepEqual(snap6.entitlements, ["REVOKED"]);
    assert.equal(snap6.providerPaymentId, winnerId);

    // 7) Falha de auditoria com rollback da alteração financeira
    const s7 = await freshPayment("audit-fail");
    const before7 = await snapshot(s7.paymentId, s7.orderId);
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
    const after7 = await snapshot(s7.paymentId, s7.orderId);
    assert.deepEqual(after7, before7);
    assert.equal(after7.paymentStatus, "PENDING");

    // 8) Reembolsos negativos — identidade divergente não altera registros
    const s8 = await freshPayment("refund-neg");
    await applyProviderView(
      s8.paymentId,
      view({ id: s8.remoteId, externalReference: s8.orderId, paymentTypeId: "pix" }),
    );
    const beforeNeg = await snapshot(s8.paymentId, s8.orderId);
    assert.equal(beforeNeg.paymentStatus, "APPROVED");
    assert.equal(beforeNeg.orderStatus, "PAID");
    assert.deepEqual(beforeNeg.entitlements, ["ACTIVE"]);

    const negCases: Array<{ label: string; patch: Partial<ProviderPaymentView> }> = [
      { label: "wrong-id", patch: { id: `mp-wrong-${stamp}` } },
      { label: "wrong-ref", patch: { externalReference: "other-order" } },
      { label: "wrong-currency", patch: { currency: "USD" } },
      { label: "wrong-amount", patch: { amountCents: 1 } },
    ];

    for (const neg of negCases) {
      const result = await applyProviderView(
        s8.paymentId,
        view({
          id: s8.remoteId,
          externalReference: s8.orderId,
          paymentTypeId: "pix",
          status: "refunded",
          refundedCents: 3990,
          ...neg.patch,
        }),
        {
          audit: {
            actorUserId: adminId,
            action: "payment_reconcile",
            targetType: "payment",
            targetId: s8.paymentId,
            summary: `Negativo ${neg.label}`,
          },
        },
      );
      assert.equal(result.outcome, "rejected", neg.label);
      const after = await snapshot(s8.paymentId, s8.orderId);
      assert.equal(after.paymentStatus, beforeNeg.paymentStatus, neg.label);
      assert.equal(after.orderStatus, beforeNeg.orderStatus, neg.label);
      assert.equal(after.providerPaymentId, beforeNeg.providerPaymentId, neg.label);
      assert.deepEqual(after.entitlements, beforeNeg.entitlements, neg.label);
    }

    // 9) Reembolso com método divergente mas identidade ok — consistente e auditado
    const s9 = await freshPayment("refund-method");
    await applyProviderView(
      s9.paymentId,
      view({ id: s9.remoteId, externalReference: s9.orderId, paymentTypeId: "pix" }),
    );
    const refundMethod = await applyProviderView(
      s9.paymentId,
      view({
        id: s9.remoteId,
        externalReference: s9.orderId,
        paymentTypeId: "credit_card",
        status: "refunded",
        refundedCents: 3990,
      }),
      {
        audit: {
          actorUserId: adminId,
          action: "payment_reconcile",
          targetType: "payment",
          targetId: s9.paymentId,
          summary: "Reembolso com tipo remoto divergente",
        },
      },
    );
    assert.equal(refundMethod.outcome, "applied");
    assert.equal(refundMethod.audited, true);
    const snap9 = await snapshot(s9.paymentId, s9.orderId);
    assert.equal(snap9.paymentStatus, "REFUNDED");
    assert.equal(snap9.orderStatus, "REFUNDED");
    assert.deepEqual(snap9.entitlements, ["REVOKED"]);
    assert.equal(snap9.paymentMethodType, "PIX");
    assert.equal(snap9.providerPaymentId, s9.remoteId);
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
