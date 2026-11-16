import type { InternalPaymentStatus } from "@/lib/commerce/reconcile";
import { PROVIDER_STATUS_DISPATCHED, PROVIDER_STATUS_UNKNOWN } from "@/lib/commerce/provider";

export const OPEN_PAYMENT_STATUSES: InternalPaymentStatus[] = ["PENDING", "IN_PROCESS"];

const LOCKED_SUCCESS: ReadonlySet<InternalPaymentStatus> = new Set([
  "APPROVED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "CHARGED_BACK",
]);

/** Statuses que nunca podem regredir para PENDING/REJECTED via timeout ou HTTP tardio. */
export function isLockedPaymentStatus(status: InternalPaymentStatus): boolean {
  return LOCKED_SUCCESS.has(status);
}

/**
 * Impede regressão financeira: APPROVED só evolui para estorno/chargeback.
 * REJECTED/CANCELLED podem ser sobrescritos apenas por APPROVED (webhook tardio de sucesso
 * após falso negativo) — mas não por PENDING.
 */
export function mayOverwritePaymentStatus(current: InternalPaymentStatus, next: InternalPaymentStatus): boolean {
  if (current === next) return true;
  if (current === "APPROVED") {
    return next === "REFUNDED" || next === "PARTIALLY_REFUNDED" || next === "CHARGED_BACK";
  }
  if (current === "REFUNDED" || current === "PARTIALLY_REFUNDED" || current === "CHARGED_BACK") {
    return false;
  }
  return true;
}

export function shouldIgnoreStaleProviderStatus(
  currentPayment: InternalPaymentStatus,
  providerStatus: string,
): boolean {
  if (!isLockedPaymentStatus(currentPayment)) return false;
  if (currentPayment !== "APPROVED") return true;
  return (
    providerStatus === "pending" ||
    providerStatus === "in_process" ||
    providerStatus === "authorized" ||
    providerStatus === "rejected" ||
    providerStatus === "cancelled"
  );
}

export type PaymentRowLike = {
  id: string;
  status: InternalPaymentStatus;
  providerStatus: string | null;
  providerStatusDetail: string | null;
};

/** Aplica marcador de incerteza só se o pagamento ainda estiver aberto. */
export function planUnknownOutcomeUpdate(row: PaymentRowLike, fingerprintDetail: string): {
  apply: boolean;
  data: { providerStatus: string; providerStatusDetail: string };
} {
  if (!OPEN_PAYMENT_STATUSES.includes(row.status)) {
    return { apply: false, data: { providerStatus: PROVIDER_STATUS_UNKNOWN, providerStatusDetail: fingerprintDetail } };
  }
  return {
    apply: true,
    data: {
      providerStatus: PROVIDER_STATUS_UNKNOWN,
      providerStatusDetail: fingerprintDetail,
    },
  };
}

export function planRejectedIfOpen(row: PaymentRowLike, fingerprintDetail: string): {
  apply: boolean;
  data: { status: "REJECTED"; providerStatus: string; providerStatusDetail: string };
} {
  if (!OPEN_PAYMENT_STATUSES.includes(row.status)) {
    return {
      apply: false,
      data: { status: "REJECTED", providerStatus: "request_failed", providerStatusDetail: fingerprintDetail },
    };
  }
  return {
    apply: true,
    data: {
      status: "REJECTED",
      providerStatus: "request_failed",
      providerStatusDetail: fingerprintDetail,
    },
  };
}

export function planDispatchMarker(row: PaymentRowLike, fingerprintDetail: string): {
  apply: boolean;
  data: { providerStatus: string; providerStatusDetail: string };
} {
  if (!OPEN_PAYMENT_STATUSES.includes(row.status)) {
    return { apply: false, data: { providerStatus: PROVIDER_STATUS_DISPATCHED, providerStatusDetail: fingerprintDetail } };
  }
  return {
    apply: true,
    data: {
      providerStatus: PROVIDER_STATUS_DISPATCHED,
      providerStatusDetail: fingerprintDetail,
    },
  };
}

export function productKey(type: string, id: string): string {
  return `${type}:${id}`;
}

/** Detecta sobreposição de produtos entre um pedido incerto e um novo carrinho. */
export function cartOverlapsUncertainOrder(input: {
  cartKeys: string[];
  uncertainOrderKeys: string[];
}): boolean {
  const set = new Set(input.uncertainOrderKeys);
  return input.cartKeys.some((key) => set.has(key));
}

/** Sobreposição real por aulas incluídas (aula ↔ módulo ↔ curso). */
export function lessonSetsOverlap(left: readonly string[], right: readonly string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const set = new Set(left);
  return right.some((id) => set.has(id));
}

export function collectLessonIdsFromOrderItems(
  items: ReadonlyArray<{ lessonId?: string | null; lessons?: ReadonlyArray<{ lessonId: string }> }>,
): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (item.lessons && item.lessons.length > 0) {
      for (const row of item.lessons) ids.add(row.lessonId);
      continue;
    }
    if (item.lessonId) ids.add(item.lessonId);
  }
  return [...ids];
}

export function isUncertainProviderStatus(providerStatus: string | null | undefined): boolean {
  return providerStatus === PROVIDER_STATUS_UNKNOWN || providerStatus === PROVIDER_STATUS_DISPATCHED;
}

export type AbandonedPaymentLike = {
  status: string;
  providerStatus: string | null;
  providerPaymentId: string | null;
};

/**
 * Checkout abandonado = pedido ainda PENDING_PAYMENT sem despacho/incerteza
 * e sem pagamento do provedor. Nunca cancela charge_dispatched / outcome_unknown / provider id.
 */
export function canCancelAbandonedCheckout(input: {
  orderStatus: string;
  payments: ReadonlyArray<AbandonedPaymentLike>;
}): boolean {
  if (input.orderStatus !== "PENDING_PAYMENT") return false;
  for (const payment of input.payments) {
    if (payment.providerPaymentId) return false;
    if (isUncertainProviderStatus(payment.providerStatus)) return false;
    if (payment.status === "APPROVED" || payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED" || payment.status === "CHARGED_BACK") {
      return false;
    }
    if (payment.status !== "PENDING" && payment.status !== "IN_PROCESS" && payment.status !== "CANCELLED" && payment.status !== "REJECTED") {
      return false;
    }
  }
  return true;
}
