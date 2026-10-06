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
    dataLayer?: Array<Record<string, unknown> | IArguments>;
    gtag?: (...args: unknown[]) => void;
  }
}

function getDataLayer(): Array<Record<string, unknown> | IArguments> | null {
  if (typeof window === "undefined") return null;
  window.dataLayer = window.dataLayer ?? [];
  return window.dataLayer;
}

function ensureGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === "undefined") return null;
  const dataLayer = getDataLayer();
  if (!dataLayer) return null;

  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      // Consent Mode expects the Arguments object, not a rest array.
      // eslint-disable-next-line prefer-rest-params
      dataLayer.push(arguments);
    };
  }

  return window.gtag;
}

export function pushConsentDefaults(): void {
  const gtag = ensureGtag();
  if (!gtag) return;

  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
}

export function pushConsentUpdate(consent: ConsentState): void {
  const gtag = ensureGtag();
  if (!gtag) return;

  gtag("consent", "update", consentToGoogleSignals(consent));
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

/**
 * Empurra eventos de negócio no dataLayer.
 * A existência do evento não depende de consentimento.
 * GA4 / Ads / Meta só devem consumir via tags no GTM com Consent Mode.
 */
export function trackEvent(event: AnalyticsEventName, params: AnalyticsParams = {}): void {
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

export function trackGenerateLeadOnce(submissionId: string, params: AnalyticsParams): boolean {
  if (typeof window === "undefined") return false;

  const storageKey = `af_generate_lead_${submissionId}`;
  if (sessionStorage.getItem(storageKey)) return false;

  trackEvent("generate_lead", params);
  sessionStorage.setItem(storageKey, "1");
  return true;
}
