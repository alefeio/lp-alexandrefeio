import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ABANDONED_AFTER_MS,
  COMMERCE_PAGE_SIZE,
  approvedRevenueCents,
  classifyAttention,
  computeCommerceMetrics,
  filterOrdersByAccountScope,
  isInconclusivePayment,
  parseAccountScope,
  parseOrderStatusFilter,
  parsePaymentMethodFilter,
  providerRefusalMessage,
  type CommerceOrderSnap,
} from "../src/lib/admin/commerce";
import {
  hasOpenMethodDivergence,
  providerMethodOf,
  validateAdminReconcile,
} from "../src/lib/admin/commerce-reconcile";
import { classifyDeviceCategory } from "../src/lib/commerce/payment-origin";
import type { ProviderPaymentView } from "../src/lib/commerce/reconcile";

function order(patch: Partial<CommerceOrderSnap> & { id: string }): CommerceOrderSnap {
  return {
    status: "PENDING_PAYMENT",
    totalCents: 3990,
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    userId: "u1",
    isTestAccount: false,
    productTitles: ["Aula"],
    payments: [],
    ...patch,
  };
}

function payment(
  patch: Partial<CommerceOrderSnap["payments"][number]> & { id: string },
): CommerceOrderSnap["payments"][number] {
  return {
    status: "PENDING",
    amountCents: 3990,
    refundedAmountCents: 0,
    paymentMethodType: null,
    providerPaymentId: null,
    providerStatus: null,
    providerStatusDetail: null,
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-01-01T12:00:00.000Z"),
    ...patch,
  };
}

function view(patch: Partial<ProviderPaymentView> = {}): ProviderPaymentView {
  return {
    id: "mp-1",
    status: "approved",
    statusDetail: "accredited",
    amountCents: 3990,
    currency: "BRL",
    externalReference: "ord-1",
    paymentTypeId: "credit_card",
    installments: 1,
    refundedCents: 0,
    ...patch,
  };
}

test("escopo comercial exclui contas de teste por padrão", () => {
  assert.equal(parseAccountScope(undefined), "commercial");
  const rows = [
    order({ id: "a", isTestAccount: false, status: "PAID" }),
    order({ id: "b", isTestAccount: true, status: "PAID" }),
  ];
  assert.deepEqual(
    filterOrdersByAccountScope(rows, "commercial").map((o) => o.id),
    ["a"],
  );
});

test("métricas sinalizam aprovações múltiplas anômalas sem confundir com vendas distintas", () => {
  const rows = [
    order({
      id: "anom",
      status: "PAID",
      payments: [
        payment({ id: "a1", status: "APPROVED", amountCents: 3990 }),
        payment({ id: "a2", status: "APPROVED", amountCents: 3990 }),
      ],
    }),
    order({
      id: "pending",
      status: "PENDING_PAYMENT",
      totalCents: 5000,
      payments: [payment({ id: "r2", status: "REJECTED" })],
    }),
  ];
  const metrics = computeCommerceMetrics(rows);
  assert.equal(metrics.approvedRevenueCents, 7980);
  assert.equal(metrics.anomalousMultiApprovedOrders, 1);
  assert.equal(metrics.paidOrders, 1);
  assert.equal(metrics.conversionRate, 0.5);
  assert.equal(COMMERCE_PAGE_SIZE, 50);
});

test("agregação com mais de 500 pedidos sintéticos não trunca o universo", () => {
  const rows = Array.from({ length: 520 }, (_, i) =>
    order({
      id: `o-${i}`,
      status: i % 4 === 0 ? "PAID" : "PENDING_PAYMENT",
      totalCents: 1000,
      payments:
        i % 4 === 0
          ? [payment({ id: `p-${i}`, status: "APPROVED", amountCents: 1000 })]
          : [payment({ id: `p-${i}`, status: "REJECTED", amountCents: 1000 })],
    }),
  );
  const metrics = computeCommerceMetrics(rows);
  assert.equal(metrics.totalOrders, 520);
  assert.equal(metrics.paidOrders, 130);
  assert.equal(metrics.approvedRevenueCents, 130_000);
  assert.ok(metrics.conversionRate != null && Math.abs(metrics.conversionRate - 130 / 520) < 1e-9);
});

test("filtros inválidos de status/método são rejeitados", () => {
  assert.equal(parseOrderStatusFilter("PAID"), "PAID");
  assert.equal(parseOrderStatusFilter("HACK"), null);
  assert.equal(parsePaymentMethodFilter("PIX"), "PIX");
  assert.equal(parsePaymentMethodFilter("boleto"), null);
});

test("atenção: charge_dispatched e outcome_unknown não são abandono", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");
  const dispatched = order({
    id: "d",
    updatedAt: new Date(now.getTime() - ABANDONED_AFTER_MS - 1000),
    payments: [
      payment({
        id: "p",
        status: "PENDING",
        providerStatus: "charge_dispatched",
        providerStatusDetail: "fp:abc",
        updatedAt: new Date(now.getTime() - ABANDONED_AFTER_MS - 1000),
      }),
    ],
  });
  assert.equal(classifyAttention(dispatched, now), "outcome_unknown");
  assert.equal(isInconclusivePayment(dispatched.payments[0]!), true);

  const unknown = order({
    id: "u",
    payments: [payment({ id: "u1", providerStatus: "outcome_unknown", status: "PENDING" })],
  });
  assert.equal(classifyAttention(unknown, now), "outcome_unknown");

  const pix = order({
    id: "pix",
    payments: [
      payment({
        id: "p1",
        status: "PENDING",
        paymentMethodType: "PIX",
        providerPaymentId: "ord_1",
        updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      }),
    ],
  });
  assert.equal(classifyAttention(pix, now), "pix_waiting");

  const abandoned = order({
    id: "abd",
    updatedAt: new Date(now.getTime() - ABANDONED_AFTER_MS - 1000),
    payments: [],
  });
  assert.equal(classifyAttention(abandoned, now), "abandoned");
});

test("reconciliação admin valida id remoto, valor, método e divergência prévia", () => {
  const baseLocal = {
    orderId: "ord-1",
    orderTotalCents: 3990,
    orderStatus: "PENDING_PAYMENT",
    amountCents: 3990,
    providerPaymentId: "mp-1",
    paymentMethodType: "PIX" as string | null,
    providerStatusDetail: null as string | null,
  };
  assert.equal(providerMethodOf("pix"), "PIX");
  assert.equal(
    validateAdminReconcile({
      confirmed: true,
      queriedProviderPaymentId: "mp-1",
      local: baseLocal,
      view: view({ paymentTypeId: "credit_card" }),
    }).outcome,
    "needs_review",
  );
  assert.equal(
    validateAdminReconcile({
      confirmed: true,
      queriedProviderPaymentId: "mp-1",
      local: baseLocal,
      view: view({ id: "mp-OTHER", paymentTypeId: "pix" }),
    }).outcome,
    "rejected",
  );
  assert.equal(
    validateAdminReconcile({
      confirmed: true,
      queriedProviderPaymentId: "mp-1",
      local: { ...baseLocal, paymentMethodType: "PIX", orderStatus: "NEEDS_REVIEW", providerStatusDetail: "method_mismatch:CREDIT_CARD" },
      view: view({ paymentTypeId: "pix" }),
    }).mayApply,
    false,
  );
  assert.equal(
    hasOpenMethodDivergence({ orderStatus: "NEEDS_REVIEW", providerStatusDetail: "method_mismatch:x" }),
    true,
  );
  assert.equal(
    validateAdminReconcile({
      confirmed: true,
      queriedProviderPaymentId: "mp-1",
      local: { ...baseLocal, paymentMethodType: "CREDIT_CARD" },
      view: view({ paymentTypeId: "credit_card" }),
    }).outcome,
    "applied",
  );
  assert.equal(
    validateAdminReconcile({
      confirmed: false,
      queriedProviderPaymentId: "mp-1",
      local: baseLocal,
      view: view({ paymentTypeId: "pix" }),
    }).outcome,
    "rejected",
  );
});

test("recusa traduz código conhecido preservando técnico", () => {
  const high = providerRefusalMessage("cc_rejected_high_risk");
  assert.match(high.message, /risco/i);
  assert.equal(high.code, "cc_rejected_high_risk");
});

test("dispositivo e origem não inventam sessão", () => {
  assert.equal(classifyDeviceCategory("Mozilla/5.0 (iPhone)"), "mobile");
  assert.equal(classifyDeviceCategory(null), "unknown");
});

test("ações admin usam serviços transacionais e não forçam PAID", () => {
  const actions = readFileSync(new URL("../src/lib/admin/commerce-actions.ts", import.meta.url), "utf8");
  const reconcile = readFileSync(new URL("../src/lib/admin/commerce-reconcile.ts", import.meta.url), "utf8");
  assert.match(actions, /setUserTestAccountAtomic/);
  assert.match(actions, /reconcileAdminPaymentService/);
  assert.match(actions, /inspectMercadoPagoPaymentService/);
  assert.match(reconcile, /preserveLocalMethod/);
  assert.match(reconcile, /\$transaction/);
  assert.equal(actions.includes("createProviderCharge"), false);
  assert.equal(reconcile.includes("payments-api"), false);
});

test("loader documenta método e remove take 500 antes da agregação", () => {
  const loader = readFileSync(new URL("../src/lib/admin/commerce-load.ts", import.meta.url), "utf8");
  assert.match(loader, /COMMERCE_PAGE_SIZE/);
  assert.match(loader, /accountScopeWhere/);
  assert.equal(loader.includes("take: 500"), false);
  assert.match(loader, /METHOD_FILTER_NOTE/);
});

test("receita líquida ≠ conversão por pedido", () => {
  assert.equal(
    approvedRevenueCents([{ status: "APPROVED", amountCents: 1000, refundedAmountCents: 200 }]),
    800,
  );
});
