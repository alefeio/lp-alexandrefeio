"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/AuthForms";
import { authCtaParams, trackEvent, type AuthCtaSource } from "@/lib/analytics";
import { authNextHref } from "@/lib/auth/messages";
import { buttonClass } from "@/lib/button-styles";

export function AccountNav({
  signedIn,
  source,
  nextPath,
  onNavigate,
  compact = false,
}: {
  signedIn: boolean;
  source: AuthCtaSource;
  nextPath?: string;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  if (signedIn) {
    return (
      <div className={compact ? "flex flex-col gap-3" : "flex items-center gap-4"}>
        <Link href="/app" className={compact ? "flex min-h-14 items-center text-2xl font-semibold tracking-tight" : "text-sm underline underline-offset-4"} onClick={onNavigate}>
          Área do aluno
        </Link>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className={compact ? "flex flex-col gap-3" : "flex items-center gap-3"}>
      <Link
        href={authNextHref("/entrar", nextPath)}
        className={compact ? "flex min-h-14 items-center text-2xl font-semibold tracking-tight" : "text-sm underline underline-offset-4"}
        onClick={() => {
          trackEvent("auth_cta_click", authCtaParams(source, "login"));
          onNavigate?.();
        }}
      >
        Entrar
      </Link>
      <Link
        href={authNextHref("/cadastro", nextPath)}
        className={compact ? "flex min-h-14 items-center text-2xl font-semibold tracking-tight" : buttonClass("secondary", "min-h-10 px-3 py-2")}
        onClick={() => {
          trackEvent("auth_cta_click", authCtaParams(source, "signup"));
          onNavigate?.();
        }}
      >
        Criar conta
      </Link>
    </div>
  );
}
