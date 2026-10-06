"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CONSENT_STORAGE_KEY,
  DEFAULT_CONSENT,
  parseConsent,
  serializeConsent,
  type ConsentChoice,
  type ConsentState,
} from "@/lib/consent";
import { pushConsentDefaults, pushConsentUpdate } from "@/lib/analytics";
import { ConsentBanner } from "@/components/consent/ConsentBanner";

interface ConsentContextValue {
  consent: ConsentState;
  hasChoice: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  saveChoice: (choice: ConsentChoice) => void;
  openPreferences: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
}

export function useConsent() {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error("useConsent must be used within ConsentProvider");
  }
  return context;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(() => readStoredConsent());
  const [hasChoice, setHasChoice] = useState(() => Boolean(readStoredConsent()));
  const [showBanner, setShowBanner] = useState(() => !readStoredConsent());
  const [showCustomize, setShowCustomize] = useState(false);

  const applyConsent = useCallback((next: ConsentState) => {
    setConsent(next);
    setHasChoice(true);
    setShowBanner(false);
    setShowCustomize(false);
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    pushConsentUpdate(next);
  }, []);

  useEffect(() => {
    pushConsentDefaults();
    const stored = readStoredConsent();
    if (stored) {
      pushConsentUpdate(stored);
    }
  }, []);

  const acceptAll = useCallback(() => {
    applyConsent(serializeConsent({ analytics: true, marketing: true }));
  }, [applyConsent]);

  const rejectNonEssential = useCallback(() => {
    applyConsent(serializeConsent({ analytics: false, marketing: false }));
  }, [applyConsent]);

  const saveChoice = useCallback(
    (choice: ConsentChoice) => {
      applyConsent(serializeConsent(choice));
    },
    [applyConsent],
  );

  const openPreferences = useCallback(() => {
    setShowCustomize(true);
    setShowBanner(true);
  }, []);

  const value = useMemo(
    () => ({
      consent: consent ?? DEFAULT_CONSENT,
      hasChoice,
      acceptAll,
      rejectNonEssential,
      saveChoice,
      openPreferences,
    }),
    [acceptAll, consent, hasChoice, openPreferences, rejectNonEssential, saveChoice],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {showBanner ? (
        <ConsentBanner
          initialChoice={{
            analytics: consent?.analytics ?? false,
            marketing: consent?.marketing ?? false,
          }}
          showCustomize={showCustomize || hasChoice}
          onAcceptAll={acceptAll}
          onReject={rejectNonEssential}
          onSave={saveChoice}
          onClose={() => setShowBanner(false)}
        />
      ) : null}
    </ConsentContext.Provider>
  );
}
