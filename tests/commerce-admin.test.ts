import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ABANDONED_AFTER_MS,
  approvedRevenueCents,
  classifyAttention,
  computeCommerceMetrics,
  filterOrdersByAccountScope,
  parseAccountScope,
  providerRefusalMessage,
  type CommerceOrderSnap,
} from "../src/lib/admin/commerce";
import { classifyDeviceCategory } from "../src/lib/commerce/payment-origin";

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
  assert.deepEqual(
    filterOrdersByAccountScope(rows, "tests").map((o) => o.id),
    ["b"],
  );
  assert.equal(filterOrdersByAccountScope(rows, "all").length, 2);
});

test("métricas não somam tentativas recusadas nem duplicam receita", () => {
  const rows = [
    order({
      id: "paid",
      status: "PAID",
      payments: [
        payment({ id: "r1", status: "REJECTED", amountCents: 3990 }),
        payment({
          id: "a1",
          status: "APPROVED",
          amountCents: 3990,
          refundedAmountCents: 0,
        }),
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
  assert.equal(metrics.approvedRevenueCents, 3990);
  assert.equal(metrics.pendingOrdersCents, 5000);
  assert.equal(metrics.paidOrders, 1);
  assert.equal(metrics.ordersWithRejectedAttempts, 2);
  assert.equal(metrics.totalOrders, 2);
  assert.equal(metrics.conversionRate, 0.5);
  assert.equal(
    approvedRevenueCents([
      { status: "REJECTED", amountCents: 3990, refundedAmountCents: 0 },
      { status: "APPROVED", amountCents: 3990, refundedAmountCents: 500 },
    ]),
    3490,
  );
});

test("atenção distingue pix aguardando de abandono", () => {
  const now = new Date("2026-01-10T12:00:00.000Z");
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
    payments: [payment({ id: "r", status: "REJECTED", updatedAt: new Date(now.getTime() - ABANDONED_AFTER_MS - 1000) })],
  });
  assert.equal(classifyAttention(abandoned, now), "payment_rejected");

  const staleOpen = order({
    id: "stale",
    updatedAt: new Date(now.getTime() - ABANDONED_AFTER_MS - 1000),
    payments: [],
  });
  assert.equal(classifyAttention(staleOpen, now), "abandoned");

  assert.equal(classifyAttention(order({ id: "paid", status: "PAID" }), now), null);
  assert.equal(classifyAttention(order({ id: "rev", status: "NEEDS_REVIEW" }), now), "needs_review");
  assert.equal(
    classifyAttention(
      order({
        id: "unk",
        payments: [payment({ id: "u", providerStatus: "outcome_unknown" })],
      }),
      now,
    ),
    "outcome_unknown",
  );
});

test("recusa traduz código conhecido preservando técnico", () => {
  const high = providerRefusalMessage("cc_rejected_high_risk");
  assert.match(high.message, /risco/i);
  assert.equal(high.code, "cc_rejected_high_risk");
});

test("dispositivo e origem não inventam sessão", () => {
  assert.equal(classifyDeviceCategory("Mozilla/5.0 (iPhone)"), "mobile");
  assert.equal(classifyDeviceCategory("Mozilla/5.0 (Windows NT 10.0) Chrome/120"), "desktop");
  assert.equal(classifyDeviceCategory(null), "unknown");
});

test("ações admin não forçam PAID e separam inspect de reconcile", () => {
  const actions = readFileSync(new URL("../src/lib/admin/commerce-actions.ts", import.meta.url), "utf8");
  assert.match(actions, /inspectMercadoPagoPaymentAction/);
  assert.match(actions, /reconcileAdminPaymentAction/);
  assert.match(actions, /confirm/);
  assert.match(actions, /applyProviderView/);
  assert.equal(actions.includes('status: "PAID"'), false);
  assert.equal(actions.includes("createProviderCharge"), false);
  assert.match(actions, /test_account_set/);
});

test("migration COM-AUDIT-1 é aditiva", () => {
  const sql = readFileSync(
    new URL("../prisma/migrations/20261126010000_com_audit_1_commercial_ops/migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /isTestAccount/);
  assert.match(sql, /admin_audit_log/);
  assert.match(sql, /originChannel/);
  assert.equal(sql.toLowerCase().includes("drop "), false);
});
