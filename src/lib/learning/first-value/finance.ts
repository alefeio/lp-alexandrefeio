import type { FirstValueConfirmedAtSource, FirstValueOrderStatus } from "@/lib/learning/first-value/types";

export type FirstValuePaymentRecord = {
  status: string;
  approvedAt: Date | null;
  amountCents: number;
};

export type FirstValueOrderFinanceRecord = {
  status: FirstValueOrderStatus | string;
  zeroValueUpgrade: boolean;
  totalCents: number;
  createdAt: Date;
  payments: FirstValuePaymentRecord[];
};

export type PurchaseConfirmation = {
  confirmedAt: Date | null;
  confirmedAtSource: FirstValueConfirmedAtSource;
};

/**
 * Confirmação financeira comprovável para o loader.
 * Nunca usa Order.updatedAt. NEEDS_REVIEW / CANCELLED / REFUNDED / PENDING não confirmam.
 */
export function resolvePurchaseConfirmation(order: FirstValueOrderFinanceRecord): PurchaseConfirmation {
  if (order.status !== "PAID") {
    return { confirmedAt: null, confirmedAtSource: null };
  }

  if (order.zeroValueUpgrade) {
    if (order.totalCents !== 0) {
      return { confirmedAt: null, confirmedAtSource: "unknown" };
    }
    return { confirmedAt: order.createdAt, confirmedAtSource: "zero_upgrade_created_at" };
  }

  const approved = order.payments
    .filter((row) => row.status === "APPROVED" && row.approvedAt instanceof Date && !Number.isNaN(row.approvedAt.getTime()))
    .slice()
    .sort((a, b) => a.approvedAt!.getTime() - b.approvedAt!.getTime());

  if (approved[0]?.approvedAt) {
    return { confirmedAt: approved[0].approvedAt, confirmedAtSource: "payment_approved_at" };
  }

  // PAID sem Payment.approvedAt verificável — conservador.
  return { confirmedAt: null, confirmedAtSource: "unknown" };
}
