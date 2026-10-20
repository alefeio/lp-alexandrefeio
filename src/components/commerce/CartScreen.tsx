"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { quoteCartAction } from "@/lib/commerce/actions";
import { useStoredCart, writeStoredCart } from "@/lib/commerce/cart";
import { buttonClass } from "@/lib/button-styles";
import { formatPriceCents } from "@/lib/learning/money";

type QuoteResult = Awaited<ReturnType<typeof quoteCartAction>>;

const QUOTE_TIMEOUT_MS = 12_000;

function typeLabel(type: "LESSON" | "MODULE" | "COURSE", lessonCount: number): string {
  if (type === "COURSE") return `Curso completo · ${lessonCount} aulas`;
  if (type === "MODULE") return `Módulo · ${lessonCount} aulas`;
  return "Aula individual";
}

export function CartScreen() {
  const lines = useStoredCart();
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [, startTransition] = useTransition();
  const statusId = useId();
  const requestId = useRef(0);
  const linesKey = lines.map((line) => `${line.type}:${line.id}`).join("|");

  useEffect(() => {
    if (!linesKey) return;

    let cancelled = false;
    const id = ++requestId.current;
    const currentLines = linesKey.split("|").map((key) => {
      const [type, idValue] = key.split(":");
      return { type: type as "LESSON" | "MODULE" | "COURSE", id: idValue ?? "" };
    });

    queueMicrotask(() => {
      if (cancelled || requestId.current !== id) return;
      setLoading(true);
      setTimedOut(false);
      setQuote(null);
    });

    const timer = window.setTimeout(() => {
      if (!cancelled && requestId.current === id) {
        setTimedOut(true);
        setLoading(false);
      }
    }, QUOTE_TIMEOUT_MS);

    void quoteCartAction(currentLines).then((result) => {
      if (cancelled || requestId.current !== id) return;
      window.clearTimeout(timer);
      setLoading(false);
      setTimedOut(false);
      setQuote(result);
      if (result.ok && result.lines) {
        const same =
          result.lines.length === currentLines.length &&
          result.lines.every((line, index) => line.type === currentLines[index]?.type && line.id === currentLines[index]?.id);
        if (!same) {
          startTransition(() => writeStoredCart(result.lines));
        }
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [linesKey, retryKey, startTransition]);

  function remove(productId: string, productType: "LESSON" | "MODULE" | "COURSE") {
    writeStoredCart(lines.filter((line) => !(line.type === productType && line.id === productId)));
  }

  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        <p className="text-base text-foreground">Seu carrinho está vazio.</p>
        <p className="mt-2 text-sm text-muted">Escolha o curso completo ou uma aula para continuar.</p>
        <p className="mt-5">
          <Link className={buttonClass("primary")} href="/cursos/trafego-pago-na-pratica">
            Ver curso
          </Link>
        </p>
      </div>
    );
  }

  if (quote && !quote.ok && quote.code === "already_owned") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface p-6" role="status">
        <p className="text-lg font-medium text-foreground">Você já tem este conteúdo.</p>
        <p className="mt-2 text-sm text-muted">Não é necessário comprar de novo. Seu acesso continua disponível.</p>
        <p className="mt-5">
          <Link className={buttonClass("primary")} href="/app/aprendizado">
            Acessar meu aprendizado
          </Link>
        </p>
      </div>
    );
  }

  const items = quote && quote.ok ? quote.items : [];
  const showCredit = Boolean(quote && quote.ok && quote.creditCents > 0);
  const showProgressNote = Boolean(quote && quote.ok && quote.creditCents > 0);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.9fr)] lg:items-start">
      <section aria-labelledby="cart-products-heading" className="space-y-3">
        <h2 id="cart-products-heading" className="text-sm font-medium text-foreground">
          Produto
        </h2>
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.productId} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm text-muted">{typeLabel(item.productType, item.displayLessonCount)}</p>
                    {item.productType === "COURSE" ? (
                      <p className="mt-3 text-sm text-muted">
                        {item.displayLessonCount} aulas · Ferramentas práticas · Diagnóstico e plano de ação
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-cta underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                    onClick={() => remove(item.productId, item.productType)}
                    aria-label={`Remover ${item.title}`}
                  >
                    Remover
                  </button>
                </div>
                <p className="mt-4 text-sm text-muted">Valor: {formatPriceCents(item.listPriceCents)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={`${line.type}:${line.id}`} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-border" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-border" />
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-cta underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta"
                    onClick={() => remove(line.id, line.type)}
                    aria-label="Remover item"
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {showProgressNote ? <p className="text-sm text-muted">Seu progresso atual será mantido.</p> : null}
      </section>

      <aside aria-labelledby="cart-summary-heading" className="rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-24">
        <h2 id="cart-summary-heading" className="text-sm font-medium text-foreground">
          Resumo
        </h2>
        <div id={statusId} className="mt-4 space-y-3" aria-live="polite">
          {loading ? (
            <div className="space-y-3" role="status">
              <div className="h-4 w-full animate-pulse rounded bg-border" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-border" />
              <p className="text-sm text-muted">Calculando seu valor...</p>
            </div>
          ) : null}

          {timedOut || (quote && !quote.ok && quote.code !== "already_owned") ? (
            <div role="alert">
              <p className="text-sm text-foreground">
                {timedOut
                  ? "Não conseguimos calcular o valor agora."
                  : quote && !quote.ok
                    ? quote.message
                    : "Não conseguimos calcular o valor agora."}
              </p>
              <button
                type="button"
                className={`${buttonClass("secondary")} mt-4 w-full`}
                onClick={() => setRetryKey((value) => value + 1)}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}

          {quote && quote.ok ? (
            <>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{quote.itemType === "COURSE" ? "Valor do curso" : "Valor"}</span>
                <span className="text-foreground">{formatPriceCents(quote.subtotalCents)}</span>
              </div>
              {showCredit ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">Crédito de conteúdos já adquiridos</span>
                  <span className="text-foreground">− {formatPriceCents(quote.creditCents)}</span>
                </div>
              ) : null}
              <div className="border-t border-border pt-3">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm font-medium text-foreground">Total a pagar</span>
                  <span className="text-2xl font-semibold tracking-tight text-foreground">{formatPriceCents(quote.totalCents)}</span>
                </div>
              </div>
              <Link className={`${buttonClass("primary")} mt-2 w-full`} href="/app/checkout">
                {`Pagar ${formatPriceCents(quote.totalCents)}`}
              </Link>
              <p className="text-center text-xs text-muted">Pagamento processado com segurança.</p>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
