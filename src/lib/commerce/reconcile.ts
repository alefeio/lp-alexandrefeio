export type InternalPaymentStatus =
  | "PENDING"
  | "IN_PROCESS"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "CHARGED_BACK";

export type OrderStatusName = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "REFUNDED" | "NEEDS_REVIEW";

export type ProviderPaymentView = {
  id: string;
  status: string;
  statusDetail: string | null;
  amountCents: number;
  currency: string;
  externalReference: string;
  paymentTypeId: string;
  installments: number | null;
  refundedCents: number;
};

export type ReconcileDecision = {
  paymentStatus: InternalPaymentStatus;
  orderStatus: OrderStatusName;
  grant: boolean;
  revoke: boolean;
  needsReview: boolean;
  refundedAmountCents: number;
  approvedAt: boolean;
  ignore: boolean;
  method: "PIX" | "CREDIT_CARD" | null;
};

const KNOWN = new Set([
  "pending",
  "approved",
  "authorized",
  "in_process",
  "in_mediation",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
  "partially_refunded",
]);

/** Uma regra só, usada pelo webhook e pelo botão de atualizar status. */
export function reconcileDecision(input: {
  orderId: string;
  orderStatus: OrderStatusName;
  orderTotalCents: number;
  paymentStatus: InternalPaymentStatus;
  paymentAmountCents: number;
  provider: ProviderPaymentView;
  alreadyGranted: boolean;
}): ReconcileDecision {
  const method = methodOf(input.provider.paymentTypeId);
  const base = {
    paymentStatus: input.paymentStatus,
    orderStatus: input.orderStatus,
    grant: false,
    revoke: false,
    needsReview: false,
    refundedAmountCents: Math.max(0, input.provider.refundedCents),
    approvedAt: false,
    ignore: false,
    method,
  };

  const matches =
    input.provider.externalReference === input.orderId &&
    input.provider.currency === "BRL" &&
    input.provider.amountCents === input.paymentAmountCents &&
    input.provider.amountCents === input.orderTotalCents;

  if (!matches || !KNOWN.has(input.provider.status) || !method) {
    return { ...base, paymentStatus: input.paymentStatus === "APPROVED" ? "APPROVED" : "PENDING", orderStatus: "NEEDS_REVIEW", needsReview: true };
  }

  if (input.provider.status === "partially_refunded" || (input.provider.refundedCents > 0 && input.provider.refundedCents < input.provider.amountCents)) {
    return { ...base, paymentStatus: "PARTIALLY_REFUNDED", orderStatus: "NEEDS_REVIEW", needsReview: true };
  }

  if (input.provider.status === "charged_back") {
    return { ...base, paymentStatus: "CHARGED_BACK", orderStatus: "REFUNDED", revoke: true };
  }

  if (input.provider.status === "refunded" || input.provider.refundedCents >= input.provider.amountCents) {
    return { ...base, paymentStatus: "REFUNDED", orderStatus: "REFUNDED", refundedAmountCents: input.provider.amountCents, revoke: true };
  }

  if (input.provider.status === "approved") {
    if (input.orderStatus === "PAID" && input.paymentStatus === "APPROVED") {
      return { ...base, paymentStatus: "APPROVED", orderStatus: "PAID", ignore: true };
    }
    if (input.orderStatus === "PAID" && input.paymentStatus !== "APPROVED") {
      return { ...base, paymentStatus: "APPROVED", orderStatus: "NEEDS_REVIEW", needsReview: true };
    }
    return {
      ...base,
      paymentStatus: "APPROVED",
      orderStatus: "PAID",
      grant: !input.alreadyGranted,
      approvedAt: input.paymentStatus !== "APPROVED",
    };
  }

  if (input.provider.status === "rejected") return { ...base, paymentStatus: "REJECTED", orderStatus: input.orderStatus === "PAID" ? "PAID" : "PENDING_PAYMENT" };
  if (input.provider.status === "cancelled") return { ...base, paymentStatus: "CANCELLED", orderStatus: input.orderStatus === "PAID" ? "PAID" : "PENDING_PAYMENT" };
  if (input.provider.status === "in_process" || input.provider.status === "authorized" || input.provider.status === "in_mediation") {
    return { ...base, paymentStatus: "IN_PROCESS", orderStatus: input.orderStatus === "PAID" ? "PAID" : "PENDING_PAYMENT" };
  }
  return { ...base, paymentStatus: "PENDING", orderStatus: input.orderStatus === "PAID" ? "PAID" : "PENDING_PAYMENT" };
}

function methodOf(paymentTypeId: string): "PIX" | "CREDIT_CARD" | null {
  if (paymentTypeId === "bank_transfer" || paymentTypeId === "pix") return "PIX";
  if (paymentTypeId === "credit_card") return "CREDIT_CARD";
  return null;
}
