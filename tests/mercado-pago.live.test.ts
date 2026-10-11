import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import test from "node:test";

loadEnv({ path: ".env.local" });

const enabled = process.env.MP_LIVE_TEST === "1";

test("Checkout Transparente via Orders em credencial de teste", { skip: !enabled }, async () => {
  const previousResend = process.env.RESEND_API_KEY;
  const previousCommerce = process.env.COMMERCE_ENABLED;
  process.env.COMMERCE_ENABLED = "true";
  process.env.MERCADO_PAGO_ENV = "test";
  process.env.DATABASE_ENV = "development";
  delete process.env.VERCEL_ENV;
  delete process.env.RESEND_API_KEY;
  const { assertMigrationTargetAllowed } = await import("../src/lib/db/urls");
  assertMigrationTargetAllowed();
  const { mercadoPagoTestConfig } = await import("../src/lib/commerce/config");
  const config = mercadoPagoTestConfig();
  assert.ok(config);
  assert.equal(config.env, "test");
  const { getPrisma } = await import("../src/lib/db/prisma");
  const { createOrderForUser, preparePaymentAttempt } = await import("../src/lib/commerce/orders");
  const { createProviderCharge, fetchProviderPayment } = await import("../src/lib/commerce/provider");
  const { applyProviderView } = await import("../src/lib/commerce/apply");
  const { hasActiveEntitlement } = await import("../src/lib/commerce/access");
  const { POST } = await import("../src/app/api/webhooks/mercado-pago/route");
  const prisma = getPrisma();
  const stamp = Date.now();
  const userId = `mp-live-${stamp}`;
  await prisma.user.create({
    data: { id: userId, name: "Teste", email: `mp-live-${stamp}@example.com`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const course = await prisma.course.create({
    data: { slug: `mp-live-${stamp}`, title: "Fixture", description: "Teste", status: "PUBLISHED", commerceStatus: "AVAILABLE", bundlePriceCents: 1000, publishedAt: new Date() },
  });
  const moduleRow = await prisma.module.create({
    data: { courseId: course.id, slug: "pacote", title: "Pacote", description: "Teste", status: "PUBLISHED", commerceStatus: "AVAILABLE", bundlePriceCents: 1000 },
  });
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: moduleRow.id,
      slug: `mp-live-aula-${stamp}`,
      title: "Aula de teste",
      summary: "Resumo",
      status: "PUBLISHED",
      accessType: "PAID",
      commerceStatus: "AVAILABLE",
      priceCents: 1000,
      publishedAt: new Date(),
    },
  });

  try {
    const rejectedOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lesson.id }], randomUUID());
    assert.equal(rejectedOrder.ok && rejectedOrder.totalCents, 1000);
    if (!rejectedOrder.ok) return;
    const rejectedAttempt = await preparePaymentAttempt(userId, rejectedOrder.orderId);
    assert.equal(rejectedAttempt.ok, true);
    if (!rejectedAttempt.ok) return;
    const rejectedToken = await cardToken(config.publicKey, "OTHE");
    const rejected = await createProviderCharge({
      orderId: rejectedOrder.orderId,
      idempotencyKey: rejectedAttempt.idempotencyKey,
      amountCents: 1000,
      description: "Aula de teste",
      paymentMethodId: "master",
      token: rejectedToken,
      installments: 1,
      payerEmail: "ignorado@example.com",
      identificationType: "CPF",
      identificationNumber: "12345678909",
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.view?.status, "rejected");
    assert.ok(rejected.view?.id.startsWith("ORD"));
    if (rejected.view) await applyProviderView(rejectedAttempt.paymentId, rejected.view);
    assert.equal(await hasActiveEntitlement(userId, lesson.id), false);
    const rejectedPayment = await prisma.payment.findUnique({ where: { id: rejectedAttempt.paymentId } });
    assert.equal(rejectedPayment?.status, "REJECTED");

    await prisma.entitlement.deleteMany({ where: { userId } });
    await prisma.order.deleteMany({ where: { userId } });

    const approvedOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lesson.id }], randomUUID());
    assert.equal(approvedOrder.ok, true);
    if (!approvedOrder.ok) return;
    const approvedAttempt = await preparePaymentAttempt(userId, approvedOrder.orderId);
    assert.equal(approvedAttempt.ok, true);
    if (!approvedAttempt.ok) return;
    const approvedToken = await cardToken(config.publicKey, "APRO");
    const approved = await createProviderCharge({
      orderId: approvedOrder.orderId,
      idempotencyKey: approvedAttempt.idempotencyKey,
      amountCents: 1000,
      description: "Aula de teste",
      paymentMethodId: "master",
      token: approvedToken,
      installments: 1,
      payerEmail: "ignorado@example.com",
      identificationType: "CPF",
      identificationNumber: "12345678909",
    });
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    assert.equal(approved.view.status, "approved");
    assert.ok(approved.view.id.startsWith("ORD"));
    await applyProviderView(approvedAttempt.paymentId, approved.view);
    assert.equal(await hasActiveEntitlement(userId, lesson.id), true);
    const again = await fetchProviderPayment(approved.view.id);
    assert.equal(again?.status, "approved");
    await applyProviderView(approvedAttempt.paymentId, approved.view);
    assert.equal(await prisma.entitlement.count({ where: { userId, lessonId: lesson.id } }), 1);

    const repeated = await createProviderCharge({
      orderId: approvedOrder.orderId,
      idempotencyKey: approvedAttempt.idempotencyKey,
      amountCents: 1000,
      description: "Aula de teste",
      paymentMethodId: "master",
      token: approvedToken,
      installments: 1,
      payerEmail: "ignorado@example.com",
      identificationType: "CPF",
      identificationNumber: "12345678909",
    });
    assert.equal(repeated.ok && repeated.view.id, approved.view.id);

    await prisma.order.update({ where: { id: approvedOrder.orderId }, data: { status: "REFUNDED" } });
    await prisma.entitlement.updateMany({ where: { userId }, data: { status: "REVOKED", revokedAt: new Date() } });

    const pixOrder = await createOrderForUser(userId, [{ type: "LESSON", id: lesson.id }], randomUUID());
    assert.equal(pixOrder.ok, true);
    if (!pixOrder.ok) return;
    const pixAttempt = await preparePaymentAttempt(userId, pixOrder.orderId);
    assert.equal(pixAttempt.ok, true);
    if (!pixAttempt.ok) return;
    const pix = await createProviderCharge({
      orderId: pixOrder.orderId,
      idempotencyKey: pixAttempt.idempotencyKey,
      amountCents: 1000,
      description: "Aula de teste",
      paymentMethodId: "pix",
      payerEmail: "ignorado@example.com",
    });
    assert.equal(pix.ok, true);
    if (!pix.ok) return;
    assert.equal(pix.view.status, "pending");
    assert.ok(pix.pix && pix.pix.copy.length > 20 && pix.pix.image.length > 20);
    await applyProviderView(pixAttempt.paymentId, pix.view);
    assert.equal(await hasActiveEntitlement(userId, lesson.id), false);
    const samePix = await createProviderCharge({
      orderId: pixOrder.orderId,
      idempotencyKey: pixAttempt.idempotencyKey,
      amountCents: 1000,
      description: "Aula de teste",
      paymentMethodId: "pix",
      payerEmail: "ignorado@example.com",
    });
    assert.equal(samePix.ok && samePix.view.id, pix.view.id);

    const invalid = await POST(notification(config.webhookSecret, pix.view.id, "assinatura-invalida"));
    assert.equal(invalid.status, 401);
    const valid = await POST(notification(config.webhookSecret, pix.view.id));
    assert.equal(valid.status, 200);
    assert.equal(await hasActiveEntitlement(userId, lesson.id), false);
    const realLessons = await prisma.lesson.count({ where: { commerceStatus: "AVAILABLE", slug: { not: lesson.slug } } });
    assert.equal(realLessons, 0);
  } finally {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.course.delete({ where: { id: course.id } });
    if (previousCommerce == null) delete process.env.COMMERCE_ENABLED;
    else process.env.COMMERCE_ENABLED = previousCommerce;
    if (previousResend == null) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousResend;
  }
});

async function cardToken(publicKey: string, holder: string): Promise<string> {
  const response = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: "5480832801033311",
      expiration_month: 11,
      expiration_year: 2030,
      security_code: "123",
      cardholder: { name: holder, identification: { type: "CPF", number: "12345678909" } },
    }),
  });
  const payload = await response.json().catch(() => null);
  const id = payload && typeof payload === "object" && "id" in payload ? String((payload as { id?: unknown }).id ?? "") : "";
  if (!response.ok || !id) throw new Error(`card token status ${response.status}`);
  return id;
}

function notification(secret: string, dataId: string, signature?: string): Request {
  const requestId = "req-live";
  const ts = "1000";
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = signature ?? createHmac("sha256", secret).update(manifest).digest("hex");
  return new Request(`http://localhost/api/webhooks/mercado-pago?data.id=${dataId}&type=order`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
    body: JSON.stringify({ type: "order", live_mode: false, data: { id: dataId } }),
  });
}
