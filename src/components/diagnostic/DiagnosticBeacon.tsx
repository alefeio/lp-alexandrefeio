"use client";

import { useEffect } from "react";
import { CONSENT_STORAGE_KEY, parseConsent } from "@/lib/consent";
import { trackEvent } from "@/lib/analytics";
import { diagnosticAnalyticsPayload } from "@/lib/diagnostic/analytics";
import type { ResultBand } from "@/lib/diagnostic/score";

export function DiagnosticBeacon({
  diagnosticId,
  event,
  band,
}: {
  diagnosticId: string;
  event: "diagnostic_started" | "diagnostic_completed";
  band?: ResultBand;
}) {
  useEffect(() => {
    const consent = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!consent?.analytics) return;
    const storageKey = `af_${event}_${diagnosticId}`;
    if (window.sessionStorage.getItem(storageKey) || window.localStorage.getItem(storageKey)) {
      window.sessionStorage.setItem(storageKey, "1");
      window.localStorage.setItem(storageKey, "1");
      return;
    }
    window.sessionStorage.setItem(storageKey, "1");
    window.localStorage.setItem(storageKey, "1");
    trackEvent(event, diagnosticAnalyticsPayload({ band: event === "diagnostic_completed" ? band : undefined }));
  }, [band, diagnosticId, event]);

  return null;
}
