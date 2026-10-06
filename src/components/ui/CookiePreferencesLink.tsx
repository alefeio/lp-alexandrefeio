"use client";

import { useConsent } from "@/components/consent/ConsentProvider";

export function CookiePreferencesLink() {
  const { openPreferences } = useConsent();

  return (
    <button
      type="button"
      onClick={openPreferences}
      className="text-foreground underline-offset-4 transition-colors duration-200 hover:text-cta hover:underline"
    >
      Preferências de cookies
    </button>
  );
}
