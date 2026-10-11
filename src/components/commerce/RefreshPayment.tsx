"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshOrderPaymentAction } from "@/lib/commerce/actions";
import { buttonClass } from "@/lib/button-styles";

export function RefreshPayment({ orderId, pending }: { orderId: string; pending: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingClick, setPendingClick] = useState(false);

  async function refresh() {
    setPendingClick(true);
    const result = await refreshOrderPaymentAction(orderId);
    setMessage(result.ok ? "Status atualizado." : result.message);
    setPendingClick(false);
    router.refresh();
  }

  useEffect(() => {
    if (!pending) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      if (count > 8) {
        window.clearInterval(timer);
        return;
      }
      void refreshOrderPaymentAction(orderId).then(() => router.refresh());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [orderId, pending, router]);

  if (!pending) return null;
  return (
    <div className="mt-4">
      <button className={buttonClass("secondary")} type="button" onClick={() => void refresh()} disabled={pendingClick}>
        Atualizar status
      </button>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
