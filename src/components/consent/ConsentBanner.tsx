"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { cn } from "@/lib/cn";
import type { ConsentChoice } from "@/lib/consent";

export function ConsentBanner({
  initialChoice,
  showCustomize,
  onAcceptAll,
  onReject,
  onSave,
  onClose,
}: {
  initialChoice: ConsentChoice;
  showCustomize: boolean;
  onAcceptAll: () => void;
  onReject: () => void;
  onSave: (choice: ConsentChoice) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [customize, setCustomize] = useState(showCustomize);
  const [analytics, setAnalytics] = useState(initialChoice.analytics);
  const [marketing, setMarketing] = useState(initialChoice.marketing);

  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    const root = document.documentElement;
    const apply = () => {
      const height = Math.max(0, Math.round(node.getBoundingClientRect().height));
      root.style.setProperty("--consent-banner-offset", `${height}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--consent-banner-offset");
    };
  }, [customize]);

  useEffect(() => {
    const previous = document.activeElement;
    const primaryAction = panelRef.current?.querySelector<HTMLElement>('button[type="button"]');
    primaryAction?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && showCustomize) {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose, showCustomize]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 max-h-[min(70vh,40rem)] overflow-y-auto border-t border-border bg-surface/95 shadow-[0_-18px_40px_-24px_rgba(11,18,32,0.45)] backdrop-blur-sm",
        customize ? "p-3 sm:p-5" : "p-3 max-[380px]:p-2 sm:p-5",
      )}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      <div className={cn("mx-auto flex max-w-5xl flex-col gap-4", !customize && "max-[380px]:gap-2")}>
        <div>
          <p id={titleId} className={cn("text-sm font-semibold text-foreground", !customize && "max-[380px]:text-xs")}>
            Cookies e medição
          </p>
          <p className={cn("mt-2 max-w-3xl text-sm leading-relaxed text-muted", !customize && "max-[380px]:mt-1 max-[380px]:text-xs max-[380px]:leading-snug")}>
            Usamos cookies essenciais para o formulário funcionar. Com sua permissão, também medimos visitas, interações
            e campanhas para melhorar o site.{" "}
            <Link href="/privacidade" className="text-foreground underline underline-offset-4">
              Privacidade
            </Link>
            .
          </p>
        </div>

        {customize ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
              <input
                type="checkbox"
                checked
                disabled
                className="mt-1 size-4 accent-cta"
                aria-describedby="consent-necessary-desc"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Necessários</span>
                <span id="consent-necessary-desc" className="mt-1 block text-sm text-muted">
                  Sempre ativos para o site e o formulário.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1 size-4 accent-cta"
                aria-describedby="consent-analytics-desc"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Analytics</span>
                <span id="consent-analytics-desc" className="mt-1 block text-sm text-muted">
                  Medição de visitas, CTAs e envios do formulário.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 sm:col-span-2">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-1 size-4 accent-cta"
                aria-describedby="consent-marketing-desc"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Marketing</span>
                <span id="consent-marketing-desc" className="mt-1 block text-sm text-muted">
                  Permite tags de publicidade configuradas no Google Tag Manager.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", !customize && "max-[380px]:gap-1.5")}>
          <button
            type="button"
            className={buttonClass("primary", cn("w-full sm:w-auto", !customize && "max-[380px]:min-h-10 max-[380px]:px-3 max-[380px]:py-1.5 max-[380px]:text-xs"))}
            onClick={onAcceptAll}
          >
            Aceitar todos
          </button>
          <div className={cn(!customize && "contents max-[380px]:flex max-[380px]:items-center max-[380px]:gap-1.5")}>
            <button
              type="button"
              className={buttonClass("secondary", cn("w-full sm:w-auto", !customize && "max-[380px]:min-h-10 max-[380px]:flex-1 max-[380px]:px-3 max-[380px]:py-1.5 max-[380px]:text-xs"))}
              onClick={onReject}
            >
              Recusar não essenciais
            </button>
            {customize ? null : (
              <button
                type="button"
                className="inline-flex w-full min-h-10 shrink-0 items-center justify-center text-sm font-medium text-foreground underline underline-offset-4 max-[380px]:w-auto max-[380px]:px-1 max-[380px]:text-xs sm:w-auto"
                onClick={() => setCustomize(true)}
              >
                Personalizar
              </button>
            )}
          </div>
          {customize ? (
            <button
              type="button"
              className={cn(buttonClass("secondary", "w-full sm:w-auto"), "border-border")}
              onClick={() => onSave({ analytics, marketing })}
            >
              Salvar preferências
            </button>
          ) : null}
          {customize ? (
            <button
              type="button"
              className="w-full text-sm text-muted underline underline-offset-4 sm:ml-auto sm:w-auto"
              onClick={() => (showCustomize ? onClose() : setCustomize(false))}
            >
              Fechar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
