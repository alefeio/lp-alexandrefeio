import assert from "node:assert/strict";
import test from "node:test";
import { resolveChargeApiKindForMethod, resolvePixChargeApiKind } from "../src/lib/commerce/charge-api";
import {
  readPixFromPayments,
  readProviderPaymentFromPayments,
  resolvePaymentsPaymentTypeId,
} from "../src/lib/commerce/payments-api";
import { hasPresentablePix } from "../src/lib/commerce/provider";
import { reconcileDecision } from "../src/lib/commerce/reconcile";
import {
  resolveMercadoPagoTestAccessToken,
  TEST_CREDENTIAL_SOURCE_CONFIRMATION,
} from "../src/lib/commerce/sandbox-credentials";
import { readFileSync } from "node:fs";

test("Pix charge API: default orders; payments só com env explícita; cartão sempre orders", () => {
  assert.equal(resolvePixChargeApiKind({}), "orders");
  assert.equal(resolvePixChargeApiKind({ MERCADO_PAGO_PIX_CHARGE_API: "orders" }), "orders");
  assert.equal(resolvePixChargeApiKind({ MERCADO_PAGO_PIX_CHARGE_API: "payments" }), "payments");
  assert.equal(resolvePixChargeApiKind({ MERCADO_PAGO_PIX_CHARGE_API: "weird" }), "orders");
  assert.equal(resolveChargeApiKindForMethod("CREDIT_CARD", { MERCADO_PAGO_PIX_CHARGE_API: "payments" }), "orders");
  assert.equal(resolveChargeApiKindForMethod("PIX", { MERCADO_PAGO_PIX_CHARGE_API: "payments" }), "payments");
});

test("Payments API: lê Pix de point_of_interaction e normaliza view pendente/aprovada", () => {
  const pending = {
    id: 5466310457,
    status: "pending",
    status_detail: "pending_waiting_transfer",
    transaction_amount: 14.9,
    currency_id: "BRL",
    external_reference: "order-abc",
    payment_type_id: "bank_transfer",
    installments: 1,
    transaction_amount_refunded: 0,
    point_of_interaction: {
      type: "PIX",
      transaction_data: {
        qr_code: "00020126580014br.gov.bcb.pix0136abcdef",
        qr_code_base64: "",
        ticket_url: "https://www.mercadopago.com.br/payments/5466310457/ticket?caller_id=1&hash=abc",
      },
    },
  };
  const view = readProviderPaymentFromPayments(pending);
  assert.ok(view);
  assert.equal(view.id, "5466310457");
  assert.equal(view.status, "pending");
  assert.equal(view.amountCents, 1490);
  assert.equal(view.externalReference, "order-abc");
  assert.equal(view.currency, "BRL");
  assert.equal(view.paymentTypeId, "bank_transfer");

  const pix = readPixFromPayments(pending);
  assert.ok(hasPresentablePix(pix));
  assert.ok(pix?.copy?.startsWith("000201"));
  assert.equal(pix?.image, null);
  assert.ok(pix?.ticketUrl?.includes("mercadopago.com.br"));

  const approved = {
    ...pending,
    status: "approved",
    status_detail: "accredited",
  };
  const approvedView = readProviderPaymentFromPayments(approved);
  assert.ok(approvedView);
  const decision = reconcileDecision({
    orderId: "order-abc",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 1490,
    paymentStatus: "PENDING",
    paymentAmountCents: 1490,
    provider: approvedView,
    alreadyGranted: false,
  });
  assert.equal(decision.paymentStatus, "APPROVED");
  assert.equal(decision.orderStatus, "PAID");
  assert.equal(decision.grant, true);
});

test("Payments API: rejeição e reembolso mapeiam para a regra única", () => {
  const rejected = readProviderPaymentFromPayments({
    id: 1,
    status: "rejected",
    status_detail: "high_risk",
    transaction_amount: 10,
    currency_id: "BRL",
    external_reference: "o1",
    payment_type_id: "bank_transfer",
    installments: 1,
    transaction_amount_refunded: 0,
  });
  assert.ok(rejected);
  assert.equal(
    reconcileDecision({
      orderId: "o1",
      orderStatus: "PENDING_PAYMENT",
      orderTotalCents: 1000,
      paymentStatus: "PENDING",
      paymentAmountCents: 1000,
      provider: rejected,
      alreadyGranted: false,
    }).paymentStatus,
    "REJECTED",
  );

  const refunded = readProviderPaymentFromPayments({
    id: 2,
    status: "refunded",
    status_detail: "refunded",
    transaction_amount: 10,
    currency_id: "BRL",
    external_reference: "o2",
    payment_type_id: "bank_transfer",
    installments: 1,
    transaction_amount_refunded: 10,
  });
  assert.ok(refunded);
  const d = reconcileDecision({
    orderId: "o2",
    orderStatus: "PAID",
    orderTotalCents: 1000,
    paymentStatus: "APPROVED",
    paymentAmountCents: 1000,
    provider: refunded,
    alreadyGranted: true,
  });
  assert.equal(d.paymentStatus, "REFUNDED");
  assert.equal(d.revoke, true);
});

test("Payments API: sem payment_type_id não presume bank_transfer; sem evidência Pix não concede", () => {
  const bare = {
    id: 99,
    status: "approved",
    transaction_amount: 10,
    currency_id: "BRL",
    external_reference: "order-bare",
    installments: 1,
    transaction_amount_refunded: 0,
  };
  assert.equal(resolvePaymentsPaymentTypeId(bare), "");
  const view = readProviderPaymentFromPayments(bare);
  assert.ok(view);
  assert.equal(view.paymentTypeId, "");
  const decision = reconcileDecision({
    orderId: "order-bare",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 1000,
    paymentStatus: "PENDING",
    paymentAmountCents: 1000,
    provider: view,
    alreadyGranted: false,
    expectedMethod: "PIX",
  });
  assert.equal(decision.needsReview, true);
  assert.equal(decision.grant, false);

  assert.equal(
    resolvePaymentsPaymentTypeId({
      ...bare,
      payment_method_id: "pix",
    }),
    "pix",
  );
  assert.equal(
    resolvePaymentsPaymentTypeId({
      ...bare,
      point_of_interaction: { type: "PIX", transaction_data: { qr_code: "000201" } },
    }),
    "pix",
  );
});

test("sandbox credentials: exige token de teste exclusivo sem fallback Production", () => {
  assert.equal(
    resolveMercadoPagoTestAccessToken({
      MERCADO_PAGO_ENV: "test",
      MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-live-token",
      MERCADO_PAGO_TEST_ACCESS_TOKEN: "",
      MERCADO_PAGO_TEST_CREDENTIAL_SOURCE: TEST_CREDENTIAL_SOURCE_CONFIRMATION,
    }).ok,
    false,
  );
  assert.equal(
    resolveMercadoPagoTestAccessToken({
      MERCADO_PAGO_ENV: "test",
      MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-same",
      MERCADO_PAGO_TEST_ACCESS_TOKEN: "APP_USR-same",
      MERCADO_PAGO_TEST_CREDENTIAL_SOURCE: TEST_CREDENTIAL_SOURCE_CONFIRMATION,
    }).ok,
    false,
  );
  assert.equal(
    resolveMercadoPagoTestAccessToken({
      MERCADO_PAGO_ENV: "test",
      MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-live",
      MERCADO_PAGO_TEST_ACCESS_TOKEN: "APP_USR-test-only",
      MERCADO_PAGO_TEST_CREDENTIAL_SOURCE: "wrong",
    }).ok,
    false,
  );
  const ok = resolveMercadoPagoTestAccessToken({
    MERCADO_PAGO_ENV: "test",
    MERCADO_PAGO_ACCESS_TOKEN: "APP_USR-live",
    MERCADO_PAGO_TEST_ACCESS_TOKEN: "APP_USR-test-only",
    MERCADO_PAGO_TEST_CREDENTIAL_SOURCE: TEST_CREDENTIAL_SOURCE_CONFIRMATION,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.token, "APP_USR-test-only");
});

test("reconcile: método local PIX vs provedor cartão não concede entitlement e preserva PIX na decisão", () => {
  const decision = reconcileDecision({
    orderId: "o1",
    orderStatus: "PENDING_PAYMENT",
    orderTotalCents: 1000,
    paymentStatus: "PENDING",
    paymentAmountCents: 1000,
    alreadyGranted: false,
    expectedMethod: "PIX",
    provider: {
      id: "1",
      status: "approved",
      statusDetail: null,
      amountCents: 1000,
      currency: "BRL",
      externalReference: "o1",
      paymentTypeId: "credit_card",
      installments: 1,
      refundedCents: 0,
    },
  });
  assert.equal(decision.needsReview, true);
  assert.equal(decision.grant, false);
  assert.equal(decision.method, "PIX");
});

test("arquitetura: Pix payments isolado; webhook aceita payment; cartão Orders preservado", () => {
  const provider = readFileSync("src/lib/commerce/provider.ts", "utf8");
  const payments = readFileSync("src/lib/commerce/payments-api.ts", "utf8");
  const webhook = readFileSync("src/app/api/webhooks/mercado-pago/route.ts", "utf8");
  const apply = readFileSync("src/lib/commerce/apply.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(payments, /\/v1\/payments/);
  assert.match(payments, /point_of_interaction/);
  assert.match(provider, /chargeApiKind === "payments"/);
  assert.match(provider, /v1\/orders/);
  assert.match(webhook, /type === "payment"/);
  assert.match(webhook, /type === "order"/);
  assert.match(apply, /providerApiKind/);
  assert.match(apply, /api_kind_mismatch/);
  assert.match(schema, /providerApiKind/);
});
