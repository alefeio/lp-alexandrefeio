/**
 * Associação segura de webhook/reconciliação à tentativa financeira correta.
 * Não vincula só por pedido+valor quando há tentativas anteriores rejeitadas.
 */
import {
  isChargeApiKind,
  type ChargeApiKind,
} from "@/lib/commerce/charge-api";
import { PROVIDER_STATUS_DISPATCHED } from "@/lib/commerce/provider";
import { methodFromPaymentTypeId, type ProviderPaymentView } from "@/lib/commerce/reconcile";

export type PaymentMatchRow = {
  id: string;
  orderId: string;
  providerPaymentId: string | null;
  providerApiKind: string | null;
  status: string;
  amountCents: number;
  paymentMethodType: string | null;
  providerStatus: string | null;
  createdAt: Date;
};

export type PaymentMatchResult =
  | { ok: true; paymentId: string; binding: "exact" | "race" }
  | { ok: false; reason: string };

const OPEN_STATUSES = new Set(["PENDING", "IN_PROCESS"]);

function kindCompatible(rowKind: string | null | undefined, chargeApiKind: ChargeApiKind): boolean {
  if (isChargeApiKind(rowKind)) return rowKind === chargeApiKind;
  // Legado sem providerApiKind: só Orders existia.
  return chargeApiKind === "orders";
}

function methodCompatible(
  localMethod: string | null | undefined,
  view: ProviderPaymentView,
): boolean {
  const remote = methodFromPaymentTypeId(view.paymentTypeId);
  if (!localMethod || !remote) return true;
  return localMethod === remote;
}

/**
 * Escolhe a tentativa local para um ProviderPaymentView já obtido via GET remoto.
 * Preferência: ID remoto exato → corrida (id nulo, tentativa aberta, kind/método/valor).
 */
export function selectPaymentForProviderView(input: {
  candidates: PaymentMatchRow[];
  view: ProviderPaymentView;
  chargeApiKind: ChargeApiKind;
}): PaymentMatchResult {
  const { candidates, view, chargeApiKind } = input;

  const exact = candidates.filter((row) => row.providerPaymentId === view.id);
  if (exact.length > 1) {
    return { ok: false, reason: "Mais de uma tentativa com o mesmo identificador remoto." };
  }
  if (exact.length === 1) {
    const row = exact[0];
    if (row.orderId !== view.externalReference) {
      return { ok: false, reason: "Identificador remoto não corresponde ao pedido." };
    }
    if (row.amountCents !== view.amountCents) {
      return { ok: false, reason: "Valor da tentativa não corresponde ao provedor." };
    }
    if (!kindCompatible(row.providerApiKind, chargeApiKind)) {
      return { ok: false, reason: "Mecanismo da tentativa não corresponde ao aviso." };
    }
    // Método divergente no ID exato ainda associa — applyProviderView marca NEEDS_REVIEW sem grant.
    return { ok: true, paymentId: row.id, binding: "exact" };
  }

  // Webhook antes da resposta HTTP: providerPaymentId ainda null, mas claim já gravou kind.
  const race = candidates
    .filter(
      (row) =>
        row.providerPaymentId === null &&
        row.orderId === view.externalReference &&
        row.amountCents === view.amountCents &&
        OPEN_STATUSES.has(row.status) &&
        kindCompatible(row.providerApiKind, chargeApiKind) &&
        methodCompatible(row.paymentMethodType, view),
    )
    .sort((a, b) => {
      const kindScore = (row: PaymentMatchRow) =>
        row.providerApiKind === chargeApiKind ? 2 : row.providerApiKind == null ? 1 : 0;
      const dispatchScore = (row: PaymentMatchRow) =>
        row.providerStatus === PROVIDER_STATUS_DISPATCHED ? 1 : 0;
      return (
        kindScore(b) - kindScore(a) ||
        dispatchScore(b) - dispatchScore(a) ||
        b.createdAt.getTime() - a.createdAt.getTime()
      );
    });

  if (race.length === 0) {
    return { ok: false, reason: "Nenhuma tentativa financeira ativa corresponde a este aviso." };
  }

  // Payments: exige kind persistido payments (claim). Não associa a legado null/orders.
  if (chargeApiKind === "payments") {
    const paymentsOnly = race.filter((row) => row.providerApiKind === "payments");
    if (paymentsOnly.length === 0) {
      return { ok: false, reason: "Aviso Payments sem tentativa payments aberta." };
    }
    return { ok: true, paymentId: paymentsOnly[0].id, binding: "race" };
  }

  return { ok: true, paymentId: race[0].id, binding: "race" };
}
