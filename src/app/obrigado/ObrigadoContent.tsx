"use client";

import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { THANK_YOU_STORAGE_KEY } from "@/components/sections/LeadForm";
import { siteConfig } from "@/data/site-config";
import { buttonClass } from "@/lib/button-styles";
import { buildWhatsAppUrl } from "@/lib/contact";
import { TrackedWhatsAppLink } from "@/components/ui/TrackedWhatsAppLink";

interface ThankYouState {
  firstName?: string;
  confirmationSent?: boolean;
}

function readThankYouState(): ThankYouState {
  const raw = sessionStorage.getItem(THANK_YOU_STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as ThankYouState;
  } catch {
    return {};
  }
}

function subscribeThankYouState(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function ObrigadoContent() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const state = useSyncExternalStore(subscribeThankYouState, readThankYouState, () => ({}));
  const whatsappHref = buildWhatsAppUrl();

  const greeting = state.firstName
    ? `Obrigado, ${state.firstName}. Recebi suas informações e entrarei em contato.`
    : "Contato recebido. Recebi suas informações e entrarei em contato.";

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_60px_-36px_rgba(11,18,32,0.2)] sm:p-8">
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl"
      >
        Contato recebido.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{greeting}</p>
      {state.confirmationSent ? (
        <p className="mt-3 text-sm text-muted">Enviei uma confirmação para o seu e-mail.</p>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {whatsappHref ? (
          <TrackedWhatsAppLink href={whatsappHref} location="obrigado" className={buttonClass("primary", "w-full sm:w-auto")}>
            Falar comigo no WhatsApp
          </TrackedWhatsAppLink>
        ) : null}
        <Link href="/" className={buttonClass("secondary", "w-full sm:w-auto")}>
          Voltar ao site
        </Link>
      </div>

      <p className="mt-6 text-sm text-subtle">{siteConfig.name}</p>
    </div>
  );
}
