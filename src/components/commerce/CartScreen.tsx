"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { quoteCartAction } from "@/lib/commerce/actions";
import { useStoredCart, writeStoredCart } from "@/lib/commerce/cart";
import { buttonClass } from "@/lib/button-styles";
import { formatPriceCents } from "@/lib/learning/money";

export function CartScreen() {
  const lines = useStoredCart();
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof quoteCartAction>> | null>(null);

  useEffect(() => {
    if (lines.length === 0) return;
    let cancelled = false;
    void quoteCartAction(lines).then((result) => {
      if (!cancelled) setQuote(result);
    });
    return () => {
      cancelled = true;
    };
  }, [lines]);

  function remove(index: number) {
    const next = lines.filter((_, item) => item !== index);
    writeStoredCart(next);
    if (next.length === 0) setQuote(null);
  }

  const shown = lines.length === 0 ? null : quote;
  if (lines.length === 0) return <p className="mt-6 text-base">O carrinho está vazio.</p>;

  return (
    <div className="mt-8">
      <ul className="space-y-3">
        {lines.map((line, index) => (
          <li key={`${line.type}:${line.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
            <span className="text-sm">{line.type === "LESSON" ? "Aula" : line.type === "MODULE" ? "Módulo" : "Curso"}</span>
            <button className="text-sm underline underline-offset-4" type="button" onClick={() => remove(index)}>
              Tirar
            </button>
          </li>
        ))}
      </ul>
      {shown && !shown.ok ? <p className="mt-4 text-sm" role="alert">{shown.message}</p> : null}
      {shown && shown.ok ? (
        <div className="mt-6 space-y-2 text-base">
          {shown.items.map((item) => (
            <p key={item.productId}>
              <strong>{item.title}. </strong>
              Preço {formatPriceCents(item.listPriceCents)}
              {item.creditAppliedCents > 0 ? `. Crédito já adquirido ${formatPriceCents(item.creditAppliedCents)}` : ""}.
            </p>
          ))}
          <p>Preço atual {formatPriceCents(shown.subtotalCents)}.</p>
          <p>Crédito por compras anteriores {formatPriceCents(shown.creditCents)}.</p>
          <p><strong>Total final {formatPriceCents(shown.totalCents)}.</strong></p>
          <Link className={`${buttonClass("primary")} mt-4`} href="/app/checkout">Continuar para o pagamento</Link>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Calculando o preço.</p>
      )}
    </div>
  );
}
