"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createOrderAction, resumeCheckoutAction } from "@/lib/commerce/actions";
import { checkoutDedupeKey, commerceAnalyticsPayload } from "@/lib/commerce/analytics";
import { useStoredCart, writeStoredCart } from "@/lib/commerce/cart";
import { trackEvent } from "@/lib/analytics";
import { formatPriceCents } from "@/lib/learning/money";
import { PriceChangeNotice } from "@/components/commerce/PurchaseJourneyActions";

const PaymentBrick = dynamic(() => import("@/components/commerce/PaymentBrick").then((mod) => mod.PaymentBrick), { ssr: false });

type CheckoutState =
  | { orderId: string; totalCents: number; status: string; itemType: "LESSON" | "MODULE" | "COURSE" }
  | { message: string };

export function CheckoutScreen({
  publicKey,
  payerEmail,
  resumeOrderId = null,
  priceChange = null,
}: {
  publicKey: string | null;
  payerEmail: string;
  resumeOrderId?: string | null;
  priceChange?: { previousCents: number; currentCents: number } | null;
}) {
  const router = useRouter();
  const lines = useStoredCart();
  const [state, setState] = useState<CheckoutState | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (resumeOrderId) {
      void resumeCheckoutAction(resumeOrderId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setState({ message: result.message });
          return;
        }
        if (result.redirectPaid) {
          writeStoredCart([]);
          router.push(`/app/compras/${result.orderId}`);
          return;
        }
        if ("redirectPurchase" in result && result.redirectPurchase) {
          router.push(`/app/compras/${result.orderId}`);
          return;
        }
        setState({
          orderId: result.orderId,
          totalCents: result.totalCents,
          status: result.status,
          itemType: result.itemType,
        });
      });
      return () => {
        cancelled = true;
      };
    }

    if (lines.length === 0) return;
    const signature = lines.map((line) => `${line.type}:${line.id}`).join("|");
    const storedSignature = window.sessionStorage.getItem("af_checkout_sig");
    let checkoutKey = window.sessionStorage.getItem("af_checkout_key");
    if (!checkoutKey || storedSignature !== signature) {
      checkoutKey = window.crypto.randomUUID();
      window.sessionStorage.setItem("af_checkout_key", checkoutKey);
      window.sessionStorage.setItem("af_checkout_sig", signature);
    }
    void createOrderAction(lines, checkoutKey).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setState({ message: result.message });
        return;
      }
      const itemType = lines.length === 1 ? lines[0]?.type ?? "LESSON" : "LESSON";
      setState({ orderId: result.orderId, totalCents: result.totalCents, status: result.status, itemType });
      if (result.status === "PAID") {
        writeStoredCart([]);
        router.push(`/app/compras/${result.orderId}`);
        return;
      }
      const key = checkoutDedupeKey(result.orderId);
      if (!window.sessionStorage.getItem(key)) {
        trackEvent("checkout_started", commerceAnalyticsPayload({ totalCents: result.totalCents, orderId: result.orderId, itemType }));
        window.sessionStorage.setItem(key, "1");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [lines, resumeOrderId, router]);

  if (!resumeOrderId && lines.length === 0 && !state) return <p className="mt-6 text-base">O carrinho está vazio.</p>;
  if (!state) return <p className="mt-6 text-sm text-muted">Calculando o pedido.</p>;
  if ("message" in state) return <p className="mt-6 text-base" role="alert">{state.message}</p>;
  if (state.status === "PAID") return <p className="mt-6 text-base">Compra confirmada. Abrindo o histórico.</p>;
  if (!publicKey) return <p className="mt-6 text-base">O pagamento não está configurado. O pedido ficou em aberto, sem cobrança.</p>;

  return (
    <div className="mt-8">
      {resumeOrderId ? (
        <p className="mb-3 text-sm text-muted">Continuando o pagamento do pedido já aberto. O valor cobrado é o deste pedido.</p>
      ) : null}
      {priceChange ? <PriceChangeNotice previousCents={priceChange.previousCents} currentCents={priceChange.currentCents} /> : null}
      <p className="text-base">
        Próximo passo: pagar <strong>{formatPriceCents(state.totalCents)}</strong>
      </p>
      <p className="mt-2 text-sm text-muted">
        Escolha Pix ou cartão abaixo. O valor cobrado é o deste pedido. A confirmação do Pix e a liberação do acesso acontecem
        depois que o provedor aprovar o pagamento — não há conclusão automática só por enviar o formulário. Se o formulário falhar
        ao carregar, use “Recarregar formulário” (só visual) e não feche a página para gerar outra cobrança.
      </p>
      <div className="mt-6">
        <PaymentBrick publicKey={publicKey} orderId={state.orderId} amountCents={state.totalCents} payerEmail={payerEmail} />
      </div>
    </div>
  );
}
