import { isUncertainProviderStatus } from "@/lib/commerce/payment-guards";

export type PurchasePaymentLike = {
  status: string;
  providerStatus: string | null;
  providerPaymentId: string | null;
  paymentMethodType: string | null;
};

export type PurchaseJourneyKind =
  | "paid_access"
  | "pix_pending"
  | "uncertain"
  | "rejected_retry"
  | "continue_payment"
  | "buy_again"
  | "needs_review"
  | "refunded"
  | "idle";

export type PurchaseJourneyState = {
  kind: PurchaseJourneyKind;
  headline: string;
  body: string;
  primaryCta: "continue_payment" | "buy_again" | "access_content" | "refresh_status" | "none";
  showCancelAbandoned: boolean;
  showRefreshStatus: boolean;
};

function openPayments(payments: ReadonlyArray<PurchasePaymentLike>) {
  return payments.filter((payment) => payment.status === "PENDING" || payment.status === "IN_PROCESS");
}

/**
 * Decide a UX financeira da página do pedido sem alterar status.
 * Prioridade: pago → revisão/reembolso → cancelado → incerto → Pix no provedor → rejeitado → continuar.
 */
export function decidePurchaseJourney(input: {
  orderStatus: string;
  payments: ReadonlyArray<PurchasePaymentLike>;
  abandonable: boolean;
}): PurchaseJourneyState {
  if (input.orderStatus === "PAID") {
    return {
      kind: "paid_access",
      headline: "Pagamento confirmado",
      body: "O acesso ao conteúdo já está liberado.",
      primaryCta: "access_content",
      showCancelAbandoned: false,
      showRefreshStatus: false,
    };
  }

  if (input.orderStatus === "NEEDS_REVIEW") {
    return {
      kind: "needs_review",
      headline: "Pedido em revisão",
      body: "Não inicie outra cobrança. Fale com o suporte se precisar de atualização.",
      primaryCta: "none",
      showCancelAbandoned: false,
      showRefreshStatus: true,
    };
  }

  if (input.orderStatus === "REFUNDED") {
    return {
      kind: "refunded",
      headline: "Pedido reembolsado",
      body: "Este pedido foi reembolsado. Se quiser o conteúdo de novo, inicie uma compra nova pelo catálogo.",
      primaryCta: "none",
      showCancelAbandoned: false,
      showRefreshStatus: false,
    };
  }

  if (input.orderStatus === "CANCELLED") {
    return {
      kind: "buy_again",
      headline: "Checkout cancelado",
      body: "Este pedido permanece cancelado. Você pode comprar novamente o mesmo conteúdo com um pedido novo.",
      primaryCta: "buy_again",
      showCancelAbandoned: false,
      showRefreshStatus: false,
    };
  }

  if (input.orderStatus !== "PENDING_PAYMENT") {
    return {
      kind: "idle",
      headline: "Pedido",
      body: "Acompanhe o status deste pedido.",
      primaryCta: "none",
      showCancelAbandoned: false,
      showRefreshStatus: false,
    };
  }

  const open = openPayments(input.payments);
  const uncertainOpen = open.some(
    (payment) => isUncertainProviderStatus(payment.providerStatus) || Boolean(payment.providerPaymentId && payment.paymentMethodType !== "PIX"),
  );
  const pixOpen = open.find((payment) => payment.paymentMethodType === "PIX" && Boolean(payment.providerPaymentId));

  if (uncertainOpen && !pixOpen) {
    return {
      kind: "uncertain",
      headline: "Cobrança em verificação",
      body: "Há uma tentativa em andamento no provedor. Não inicie outro pagamento agora. Atualize o status ou fale com o suporte.",
      primaryCta: "refresh_status",
      showCancelAbandoned: false,
      showRefreshStatus: true,
    };
  }

  if (pixOpen) {
    return {
      kind: "pix_pending",
      headline: "Pix aguardando pagamento",
      body: "Use o QR Code, o Pix Copia e Cola ou o link oficial. O acesso só libera depois da confirmação.",
      primaryCta: "refresh_status",
      showCancelAbandoned: false,
      showRefreshStatus: true,
    };
  }

  const hasRejected = input.payments.some((payment) => payment.status === "REJECTED");
  const chargeable =
    open.length === 0 ||
    open.every(
      (payment) => !payment.providerPaymentId && !isUncertainProviderStatus(payment.providerStatus),
    );

  if (hasRejected && chargeable) {
    return {
      kind: "rejected_retry",
      headline: "Pagamento não concluído",
      body: "A tentativa anterior não foi aceita pelo provedor. Você pode tentar de novo neste mesmo pedido, sem alterar o valor histórico.",
      primaryCta: "continue_payment",
      showCancelAbandoned: input.abandonable,
      showRefreshStatus: false,
    };
  }

  if (chargeable) {
    return {
      kind: "continue_payment",
      headline: "Pedido aguardando pagamento",
      body: "Nenhuma cobrança ativa no provedor. Continue o pagamento deste pedido ou cancele o checkout abandonado.",
      primaryCta: "continue_payment",
      showCancelAbandoned: input.abandonable,
      showRefreshStatus: false,
    };
  }

  return {
    kind: "idle",
    headline: "Aguardando pagamento",
    body: "Acompanhe o status deste pedido.",
    primaryCta: "refresh_status",
    showCancelAbandoned: input.abandonable,
    showRefreshStatus: true,
  };
}
