"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CancelAbandonedCheckout } from "@/components/commerce/CancelAbandonedCheckout";
import { RefreshPayment } from "@/components/commerce/RefreshPayment";
import { repurchaseCancelledOrderAction } from "@/lib/commerce/actions";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import type { PurchaseJourneyState } from "@/lib/commerce/purchase-journey";
import { formatPriceCents } from "@/lib/learning/money";

export function PurchaseJourneyActions({
  orderId,
  journey,
  accessHref,
  accessCta,
}: {
  orderId: string;
  journey: PurchaseJourneyState;
  accessHref?: string | null;
  accessCta?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function buyAgain() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      window.sessionStorage.removeItem("af_checkout_key");
      window.sessionStorage.removeItem("af_checkout_sig");
      const checkoutKey = window.crypto.randomUUID();
      const result = await repurchaseCancelledOrderAction(orderId, checkoutKey);
      if (!result.ok) {
        setMessage(result.message);
        if ("orderId" in result && result.orderId) {
          router.push(`/app/compras/${result.orderId}`);
        }
        return;
      }
      if (result.status === "PAID") {
        router.push(`/app/compras/${result.orderId}`);
        return;
      }
      const priceNote = result.priceChanged
        ? `?priceChanged=1&previous=${result.previousTotalCents}&current=${result.totalCents}`
        : "";
      router.push(`/app/checkout?orderId=${encodeURIComponent(result.orderId)}${priceNote}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <p className="text-base font-medium">{journey.headline}</p>
        <p className="mt-2 text-sm text-muted">{journey.body}</p>
      </div>

      {journey.primaryCta === "continue_payment" ? (
        <Link className={buttonClass("primary")} href={`/app/checkout?orderId=${encodeURIComponent(orderId)}`}>
          Continuar pagamento
        </Link>
      ) : null}

      {journey.primaryCta === "buy_again" ? (
        <button className={buttonClass("primary")} type="button" onClick={() => void buyAgain()} disabled={busy}>
          {busy ? "Preparando…" : "Comprar novamente"}
        </button>
      ) : null}

      {journey.primaryCta === "access_content" && accessHref && accessCta ? (
        <div className="flex flex-col items-start gap-3">
          <Link className={buttonClass("primary")} href={accessHref}>
            {accessCta}
          </Link>
          <Link className={navigationLinkClass()} href="/app/aprendizado">
            Ver meu aprendizado
          </Link>
        </div>
      ) : null}

      {journey.showRefreshStatus ? <RefreshPayment orderId={orderId} pending emphasis={journey.primaryCta === "refresh_status"} /> : null}

      {journey.showCancelAbandoned ? (
        <div className="pt-1">
          <CancelAbandonedCheckout orderId={orderId} />
        </div>
      ) : null}

      {message ? <p className="text-sm text-muted" role="alert">{message}</p> : null}
    </div>
  );
}

export function PriceChangeNotice({ previousCents, currentCents }: { previousCents: number; currentCents: number }) {
  if (previousCents === currentCents) return null;
  return (
    <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm" role="status">
      O preço atual é {formatPriceCents(currentCents)}. No pedido cancelado era {formatPriceCents(previousCents)}.
    </p>
  );
}
