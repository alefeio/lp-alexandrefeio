"use client";

import { useId, useState } from "react";
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
  const [customize, setCustomize] = useState(showCustomize);
  const [analytics, setAnalytics] = useState(initialChoice.analytics);
  const [marketing, setMarketing] = useState(initialChoice.marketing);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 p-4 shadow-[0_-18px_40px_-24px_rgba(11,18,32,0.45)] backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div>
          <p id={titleId} className="text-sm font-semibold text-foreground">
            Cookies e medição
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
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
              <input type="checkbox" checked disabled className="mt-1 size-4 accent-cta" />
              <span>
                <span className="block text-sm font-medium text-foreground">Necessários</span>
                <span className="mt-1 block text-sm text-muted">Sempre ativos para o site e o formulário.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="mt-1 size-4 accent-cta"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Analytics</span>
                <span className="mt-1 block text-sm text-muted">Medição de visitas, CTAs e envios do formulário.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 sm:col-span-2">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="mt-1 size-4 accent-cta"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Marketing</span>
                <span className="mt-1 block text-sm text-muted">
                  Permite tags de publicidade configuradas no Google Tag Manager.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" className={buttonClass("primary", "w-full sm:w-auto")} onClick={onAcceptAll}>
            Aceitar todos
          </button>
          <button type="button" className={buttonClass("secondary", "w-full sm:w-auto")} onClick={onReject}>
            Recusar não essenciais
          </button>
          {customize ? (
            <button
              type="button"
              className={cn(buttonClass("secondary", "w-full sm:w-auto"), "border-border")}
              onClick={() => onSave({ analytics, marketing })}
            >
              Salvar preferências
            </button>
          ) : (
            <button
              type="button"
              className="w-full text-sm font-medium text-foreground underline underline-offset-4 sm:w-auto"
              onClick={() => setCustomize(true)}
            >
              Personalizar
            </button>
          )}
          {showCustomize ? (
            <button
              type="button"
              className="w-full text-sm text-muted underline underline-offset-4 sm:ml-auto sm:w-auto"
              onClick={onClose}
            >
              Fechar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
