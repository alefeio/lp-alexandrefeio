"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/lib/commerce/actions";
import { checkoutDedupeKey, commerceAnalyticsPayload } from "@/lib/commerce/analytics";
import { useStoredCart, writeStoredCart } from "@/lib/commerce/cart";
import { trackEvent } from "@/lib/analytics";
import { formatPriceCents } from "@/lib/learning/money";

const PaymentBrick = dynamic(() => import("@/components/commerce/PaymentBrick").then((mod) => mod.PaymentBrick), { ssr: false });

export function CheckoutScreen({ publicKey, payerEmail }: { publicKey: string | null; payerEmail: string }) {
  const router = useRouter();
  const lines = useStoredCart();
  const [state, setState] = useState<{ orderId: string; totalCents: number; status: string; itemType: "LESSON" | "MODULE" | "COURSE" } | { message: string } | null>(null);

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
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
  }, [lines, router]);

  if (lines.length === 0 && !state) return <p className="mt-6 text-base">O carrinho está vazio.</p>;
  if (!state) return <p className="mt-6 text-sm text-muted">Calculando o pedido.</p>;
  if ("message" in state) return <p className="mt-6 text-base" role="alert">{state.message}</p>;
  if (state.status === "PAID") return <p className="mt-6 text-base">Compra confirmada. Abrindo o histórico.</p>;
  if (!publicKey) return <p className="mt-6 text-base">O pagamento não está configurado. O pedido ficou em aberto, sem cobrança.</p>;

  return (
    <div className="mt-8">
      <p className="text-base">Total a pagar: <strong>{formatPriceCents(state.totalCents)}</strong></p>
      <p className="mt-2 text-sm text-muted">Pix ou cartão de crédito, em até 3 parcelas quando o Mercado Pago oferecer. O valor cobrado é o deste pedido.</p>
      <div className="mt-6">
        <PaymentBrick publicKey={publicKey} orderId={state.orderId} amountCents={state.totalCents} payerEmail={payerEmail} />
      </div>
    </div>
  );
}
