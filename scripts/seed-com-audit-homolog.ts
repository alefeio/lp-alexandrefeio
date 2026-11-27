/**
 * Fixtures fictícias COM-AUDIT-1.2 para homologação isolada.
 * Não copia Production. Não cria cobrança real. Não envia e-mail real.
 *
 * Uso (somente após probe de isolamento):
 *   npx tsx scripts/seed-com-audit-homolog.ts
 * Exige .env.commerce-isolated.local + ISOLATED_COMMERCE_DATABASE_TEST=1
 */
import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { assertIsolatedCommerceLiveConnection } from "../src/lib/db/urls";

loadEnv({ path: ".env.commerce-isolated.local", override: true });

const PREFIX = "com-audit-homolog";

async function main() {
  process.env.DATABASE_ENV = "test";
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.COMMERCE_ENABLED = "true";
  delete process.env.VERCEL_ENV;

  await assertIsolatedCommerceLiveConnection(process.env);

  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;
  const { getPrisma } = await import("../src/lib/db/prisma");
  const prisma = getPrisma();
  const now = new Date();
  const stale = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  const adminId = `${PREFIX}-admin`;
  const commercialId = `${PREFIX}-commercial`;
  const testId = `${PREFIX}-test`;

  const { hashPassword } = await import("better-auth/crypto");
  // Senha só para homologação local isolada — nunca Production.
  const homologPassword = process.env.HOMOLOG_ADMIN_PASSWORD?.trim() || "Homolog-Audit-1.2!";
  const passwordHash = await hashPassword(homologPassword);

  for (const row of [
    { id: adminId, name: "Admin Homolog", email: "com-audit-admin@example.com", role: "ADMIN", isTestAccount: false },
    { id: commercialId, name: "Comercial Homolog", email: "com-audit-commercial@example.com", role: "USER", isTestAccount: false },
    { id: testId, name: "Teste Homolog", email: "com-audit-test@example.com", role: "USER", isTestAccount: true },
  ]) {
    await prisma.user.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: true,
        role: row.role,
        isTestAccount: row.isTestAccount,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        name: row.name,
        email: row.email,
        role: row.role,
        isTestAccount: row.isTestAccount,
        emailVerified: true,
        updatedAt: now,
      },
    });
  }

  await prisma.account.upsert({
    where: { id: `${adminId}-credential` },
    create: {
      id: `${adminId}-credential`,
      accountId: adminId,
      providerId: "credential",
      userId: adminId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    },
    update: { password: passwordHash, updatedAt: now },
  });

  // Catálogo mínimo fictício
  const course = await prisma.course.upsert({
    where: { slug: `${PREFIX}-course` },
    create: {
      slug: `${PREFIX}-course`,
      title: "Curso Homologação",
      description: "Fixture",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 9900,
      publishedAt: now,
    },
    update: { title: "Curso Homologação", updatedAt: now },
  });
  const moduleRow = await prisma.module.upsert({
    where: { courseId_slug: { courseId: course.id, slug: `${PREFIX}-mod` } },
    create: {
      courseId: course.id,
      slug: `${PREFIX}-mod`,
      title: "Módulo Homolog",
      description: "Fixture",
      status: "PUBLISHED",
      commerceStatus: "AVAILABLE",
      bundlePriceCents: 3990,
    },
    update: { title: "Módulo Homolog" },
  });
  const lesson = await prisma.lesson.upsert({
    where: { slug: `${PREFIX}-lesson` },
    create: {
      moduleId: moduleRow.id,
      slug: `${PREFIX}-lesson`,
      title: "Aula Homolog",
      summary: "Fixture",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 3990,
      publishedAt: now,
    },
    update: { title: "Aula Homolog", priceCents: 3990 },
  });

  async function orderWith(input: {
    id: string;
    userId: string;
    status: "PENDING_PAYMENT" | "PAID" | "REFUNDED" | "NEEDS_REVIEW";
    payments: Array<{
      id: string;
      status: string;
      method?: "PIX" | "CREDIT_CARD" | null;
      providerStatus?: string | null;
      providerStatusDetail?: string | null;
      providerPaymentId?: string | null;
      refundedAmountCents?: number;
      createdAt?: Date;
    }>;
  }) {
    await prisma.entitlement.deleteMany({ where: { orderItem: { orderId: input.id } } }).catch(() => undefined);
    await prisma.payment.deleteMany({ where: { orderId: input.id } }).catch(() => undefined);
    await prisma.orderItemLesson.deleteMany({ where: { orderItem: { orderId: input.id } } }).catch(() => undefined);
    await prisma.orderItem.deleteMany({ where: { orderId: input.id } }).catch(() => undefined);
    await prisma.order.deleteMany({ where: { id: input.id } }).catch(() => undefined);
    const order = await prisma.order.create({
      data: {
        id: input.id,
        userId: input.userId,
        status: input.status,
        currency: "BRL",
        subtotalCents: 3990,
        creditCents: 0,
        totalCents: 3990,
        checkoutKey: randomUUID(),
        createdAt: input.payments[0]?.createdAt ?? now,
        updatedAt: now,
        items: {
          create: {
            id: `${input.id}-item`,
            productType: "LESSON",
            titleSnapshot: "Aula Homolog",
            listPriceCents: 3990,
            creditAppliedCents: 0,
            finalPriceCents: 3990,
            lessonId: lesson.id,
            lessons: { create: { lessonId: lesson.id } },
          },
        },
      },
    });
    for (const p of input.payments) {
      await prisma.payment.create({
        data: {
          id: p.id,
          orderId: order.id,
          provider: "MERCADO_PAGO",
          providerPaymentId: p.providerPaymentId ?? null,
          idempotencyKey: `${p.id}-idem`,
          status: p.status as never,
          amountCents: 3990,
          refundedAmountCents: p.refundedAmountCents ?? 0,
          paymentMethodType: p.method ?? null,
          providerStatus: p.providerStatus ?? null,
          providerStatusDetail: p.providerStatusDetail ?? null,
          approvedAt: p.status === "APPROVED" ? now : null,
          createdAt: p.createdAt ?? now,
          updatedAt: now,
          originChannel: "checkout",
          originCorrelationId: randomUUID(),
          originDeviceCategory: "desktop",
        },
      });
    }
    if (input.status === "PAID") {
      await prisma.entitlement.upsert({
        where: { orderItemId_lessonId: { orderItemId: `${input.id}-item`, lessonId: lesson.id } },
        create: {
          userId: input.userId,
          lessonId: lesson.id,
          orderItemId: `${input.id}-item`,
          status: "ACTIVE",
          grantedAt: now,
        },
        update: { status: "ACTIVE", revokedAt: null },
      });
    }
    return order.id;
  }

  await orderWith({
    id: `${PREFIX}-paid`,
    userId: commercialId,
    status: "PAID",
    payments: [{ id: `${PREFIX}-pay-paid`, status: "APPROVED", method: "PIX", providerPaymentId: "mp-homolog-paid", providerStatus: "approved" }],
  });
  await orderWith({
    id: `${PREFIX}-pending`,
    userId: commercialId,
    status: "PENDING_PAYMENT",
    payments: [],
  });
  await orderWith({
    id: `${PREFIX}-pix`,
    userId: commercialId,
    status: "PENDING_PAYMENT",
    payments: [
      {
        id: `${PREFIX}-pay-pix`,
        status: "PENDING",
        method: "PIX",
        providerPaymentId: "mp-homolog-pix",
        providerStatus: "pending",
      },
    ],
  });
  await orderWith({
    id: `${PREFIX}-rejected`,
    userId: commercialId,
    status: "PENDING_PAYMENT",
    payments: [
      {
        id: `${PREFIX}-pay-rej`,
        status: "REJECTED",
        method: "CREDIT_CARD",
        providerStatus: "rejected",
        providerStatusDetail: "cc_rejected_high_risk",
        createdAt: stale,
      },
    ],
  });
  await orderWith({
    id: `${PREFIX}-unknown`,
    userId: commercialId,
    status: "PENDING_PAYMENT",
    payments: [
      {
        id: `${PREFIX}-pay-unk`,
        status: "PENDING",
        method: "PIX",
        providerStatus: "outcome_unknown",
        providerStatusDetail: "timeout",
      },
    ],
  });
  await orderWith({
    id: `${PREFIX}-review`,
    userId: commercialId,
    status: "NEEDS_REVIEW",
    payments: [
      {
        id: `${PREFIX}-pay-rev`,
        status: "PENDING",
        method: "PIX",
        providerPaymentId: "mp-homolog-review",
        providerStatusDetail: "method_mismatch:CREDIT_CARD",
      },
    ],
  });
  await orderWith({
    id: `${PREFIX}-refund`,
    userId: commercialId,
    status: "REFUNDED",
    payments: [
      {
        id: `${PREFIX}-pay-ref`,
        status: "REFUNDED",
        method: "PIX",
        providerPaymentId: "mp-homolog-refund",
        providerStatus: "refunded",
        refundedAmountCents: 3990,
      },
    ],
  });
  await orderWith({
    id: `${PREFIX}-test-paid`,
    userId: testId,
    status: "PAID",
    payments: [{ id: `${PREFIX}-pay-test`, status: "APPROVED", method: "PIX", providerPaymentId: "mp-homolog-test" }],
  });

  await prisma.adminAuditLog.create({
    data: {
      actorUserId: adminId,
      action: "test_account_set",
      targetType: "user",
      targetId: testId,
      summary: "Fixture homologação: conta marcada como teste.",
    },
  });

  console.info("[seed-com-audit-homolog] ok", {
    adminId,
    commercialId,
    testId,
    adminEmail: "com-audit-admin@example.com",
    passwordSource: process.env.HOMOLOG_ADMIN_PASSWORD?.trim() ? "HOMOLOG_ADMIN_PASSWORD" : "default-local-only",
    note: "Login local apenas em commerce_qa. Não usar em Production. Preview Vercel sem banco dedicado permanece HOLD.",
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
