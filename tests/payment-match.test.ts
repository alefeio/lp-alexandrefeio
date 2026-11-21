import assert from "node:assert/strict";
import test from "node:test";
import { selectPaymentForProviderView, type PaymentMatchRow } from "../src/lib/commerce/payment-match";
import type { ProviderPaymentView } from "../src/lib/commerce/reconcile";

function view(partial: Partial<ProviderPaymentView> & Pick<ProviderPaymentView, "id" | "externalReference">): ProviderPaymentView {
  return {
    status: "pending",
    statusDetail: null,
    amountCents: 1490,
    currency: "BRL",
    paymentTypeId: "bank_transfer",
    installments: 1,
    refundedCents: 0,
    ...partial,
  };
}

function row(partial: Partial<PaymentMatchRow> & Pick<PaymentMatchRow, "id">): PaymentMatchRow {
  return {
    orderId: "order-1",
    providerPaymentId: null,
    providerApiKind: "payments",
    status: "PENDING",
    amountCents: 1490,
    paymentMethodType: "PIX",
    providerStatus: "charge_dispatched",
    createdAt: new Date("2026-11-20T12:00:00Z"),
    ...partial,
  };
}

test("match: não associa webhook Payments a Orders rejeitada só por pedido+valor", () => {
  const rejectedOrders = row({
    id: "pay-old",
    providerPaymentId: null,
    providerApiKind: "orders",
    status: "REJECTED",
    providerStatus: "failed",
    createdAt: new Date("2026-11-20T10:00:00Z"),
  });
  const pendingPayments = row({
    id: "pay-new",
    providerApiKind: "payments",
    status: "PENDING",
    createdAt: new Date("2026-11-20T12:00:00Z"),
  });
  const selected = selectPaymentForProviderView({
    candidates: [rejectedOrders, pendingPayments],
    view: view({ id: "mp-pay-1", externalReference: "order-1" }),
    chargeApiKind: "payments",
  });
  assert.equal(selected.ok, true);
  if (selected.ok) {
    assert.equal(selected.paymentId, "pay-new");
    assert.equal(selected.binding, "race");
  }
});

test("match: webhook Payments antes da resposta HTTP vincula tentativa payments aberta", () => {
  const selected = selectPaymentForProviderView({
    candidates: [
      row({ id: "pay-race", providerPaymentId: null, providerApiKind: "payments" }),
    ],
    view: view({ id: "mp-new", externalReference: "order-1", status: "pending" }),
    chargeApiKind: "payments",
  });
  assert.equal(selected.ok, true);
  if (selected.ok) assert.equal(selected.paymentId, "pay-race");
});

test("match: webhook antigo com ID remoto exato não invade tentativa payments nova", () => {
  const oldOrders = row({
    id: "pay-old",
    providerPaymentId: "ORD-old",
    providerApiKind: "orders",
    status: "REJECTED",
  });
  const newPayments = row({
    id: "pay-new",
    providerPaymentId: null,
    providerApiKind: "payments",
    status: "PENDING",
  });
  const selected = selectPaymentForProviderView({
    candidates: [oldOrders, newPayments],
    view: view({
      id: "ORD-old",
      externalReference: "order-1",
      paymentTypeId: "bank_transfer",
      status: "rejected",
    }),
    chargeApiKind: "orders",
  });
  assert.equal(selected.ok, true);
  if (selected.ok) {
    assert.equal(selected.paymentId, "pay-old");
    assert.equal(selected.binding, "exact");
  }
});

test("match: evento duplicado com mesmo ID remoto reutiliza a mesma tentativa", () => {
  const selected = selectPaymentForProviderView({
    candidates: [
      row({
        id: "pay-1",
        providerPaymentId: "mp-1",
        providerApiKind: "payments",
        status: "PENDING",
      }),
    ],
    view: view({ id: "mp-1", externalReference: "order-1", status: "approved" }),
    chargeApiKind: "payments",
  });
  assert.equal(selected.ok, true);
  if (selected.ok) assert.equal(selected.paymentId, "pay-1");
});

test("match: corrida com métodos divergentes recusa; ID exato ainda associa para NEEDS_REVIEW", () => {
  const race = selectPaymentForProviderView({
    candidates: [
      row({
        id: "pay-pix",
        providerPaymentId: null,
        paymentMethodType: "PIX",
        providerApiKind: "payments",
      }),
    ],
    view: view({
      id: "mp-card",
      externalReference: "order-1",
      paymentTypeId: "credit_card",
    }),
    chargeApiKind: "payments",
  });
  assert.equal(race.ok, false);

  const exact = selectPaymentForProviderView({
    candidates: [
      row({
        id: "pay-bound",
        providerPaymentId: "mp-card",
        paymentMethodType: "PIX",
        providerApiKind: "payments",
      }),
    ],
    view: view({
      id: "mp-card",
      externalReference: "order-1",
      paymentTypeId: "credit_card",
      status: "approved",
    }),
    chargeApiKind: "payments",
  });
  assert.equal(exact.ok, true);
  if (exact.ok) assert.equal(exact.binding, "exact");
});

test("match: Payments não associa a legado null/orders aberto", () => {
  const selected = selectPaymentForProviderView({
    candidates: [
      row({
        id: "pay-legacy",
        providerPaymentId: null,
        providerApiKind: null,
        status: "PENDING",
      }),
      row({
        id: "pay-orders",
        providerPaymentId: null,
        providerApiKind: "orders",
        status: "PENDING",
      }),
    ],
    view: view({ id: "mp-x", externalReference: "order-1" }),
    chargeApiKind: "payments",
  });
  assert.equal(selected.ok, false);
});
