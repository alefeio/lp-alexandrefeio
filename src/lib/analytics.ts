import { consentToGoogleSignals, type ConsentState } from "@/lib/consent";

export type AnalyticsEventName =
  | "cta_click"
  | "whatsapp_click"
  | "service_interest"
  | "form_start"
  | "form_submit"
  | "generate_lead";

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

let activeConsent: ConsentState | null = null;

function getDataLayer(): Array<Record<string, unknown>> | null {
  if (typeof window === "undefined") return null;
  window.dataLayer = window.dataLayer ?? [];
  return window.dataLayer;
}

export function setAnalyticsConsent(consent: ConsentState | null): void {
  activeConsent = consent;
}

export function pushConsentDefaults(): void {
  const dataLayer = getDataLayer();
  if (!dataLayer) return;

  dataLayer.push({
    event: "consent_default",
    ...consentToGoogleSignals({
      necessary: true,
      analytics: false,
      marketing: false,
      updatedAt: 0,
    }),
  });
}

export function pushConsentUpdate(consent: ConsentState): void {
  const dataLayer = getDataLayer();
  if (!dataLayer) return;

  activeConsent = consent;
  dataLayer.push({
    event: "consent_update",
    ...consentToGoogleSignals(consent),
  });
}

function canTrackAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  if (!activeConsent) return false;
  return activeConsent.analytics;
}

function sanitizeParams(params: AnalyticsParams): Record<string, string | number | boolean> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}

export function trackEvent(event: AnalyticsEventName, params: AnalyticsParams = {}): void {
  if (!canTrackAnalytics()) {
    if (process.env.NODE_ENV === "development") {
      console.info("[analytics blocked]", event, params);
    }
    return;
  }

  const dataLayer = getDataLayer();
  if (!dataLayer) return;

  const payload = {
    event,
    ...sanitizeParams(params),
  };

  dataLayer.push(payload);

  if (process.env.NODE_ENV === "development") {
    console.info("[analytics]", payload);
  }
}

export function trackGenerateLeadOnce(
  submissionId: string,
  params: AnalyticsParams,
): boolean {
  if (typeof window === "undefined") return false;

  const storageKey = `af_generate_lead_${submissionId}`;
  if (sessionStorage.getItem(storageKey)) return false;

  trackEvent("generate_lead", params);
  sessionStorage.setItem(storageKey, "1");
  return true;
}
