"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelAbandonedCheckoutAction } from "@/lib/commerce/actions";
import { buttonClass } from "@/lib/button-styles";

export function CancelAbandonedCheckout({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onCancel() {
    setBusy(true);
    setMessage(null);
    const result = await cancelAbandonedCheckoutAction(orderId);
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage("Checkout cancelado. Você pode iniciar uma nova compra deste conteúdo.");
    router.refresh();
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted">
        Se você ainda não concluiu o pagamento, pode cancelar este checkout e começar de novo com segurança.
      </p>
      <button className={`${buttonClass("secondary")} mt-3`} type="button" onClick={() => void onCancel()} disabled={busy} aria-busy={busy}>
        {busy ? "Cancelando…" : "Cancelar checkout abandonado"}
      </button>
      {message ? (
        <p className="mt-2 text-sm text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
