"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_CONSENT, type ConsentChoice, type ConsentState } from "@/lib/consent";
import {
  acceptAllConsent,
  bootstrapConsent,
  closeConsentBanner,
  getConsentUIState,
  getServerConsentUIState,
  openConsentPreferences,
  rejectNonEssentialConsent,
  saveConsentChoice,
  subscribeConsentUI,
} from "@/lib/consent-store";
import { ConsentBanner } from "@/components/consent/ConsentBanner";

interface ConsentContextValue {
  consent: ConsentState;
  hasChoice: boolean;
  ready: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  saveChoice: (choice: ConsentChoice) => void;
  openPreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return context;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const ui = useSyncExternalStore(subscribeConsentUI, getConsentUIState, getServerConsentUIState);

  useEffect(() => {
    bootstrapConsent();
  }, []);

  const value = useMemo(
    () => ({
      consent: ui.consent ?? DEFAULT_CONSENT,
      hasChoice: ui.hasChoice,
      ready: ui.ready,
      acceptAll: acceptAllConsent,
      rejectNonEssential: rejectNonEssentialConsent,
      saveChoice: saveConsentChoice,
      openPreferences: openConsentPreferences,
    }),
    [ui.consent, ui.hasChoice, ui.ready],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {ui.ready && ui.showBanner ? (
        <ConsentBanner
          key={ui.panelKey}
          initialChoice={{
            analytics: ui.consent?.analytics ?? false,
            marketing: ui.consent?.marketing ?? false,
          }}
          showCustomize={ui.showCustomize || ui.hasChoice}
          onAcceptAll={acceptAllConsent}
          onReject={rejectNonEssentialConsent}
          onSave={saveConsentChoice}
          onClose={closeConsentBanner}
        />
      ) : null}
    </ConsentContext.Provider>
  );
}
