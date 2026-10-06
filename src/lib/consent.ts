export const CONSENT_STORAGE_KEY = "af_consent_v1";

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: number;
}

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
}

export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: 0,
};

export function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    return {
      necessary: true,
      analytics: parsed.analytics,
      marketing: parsed.marketing,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice): ConsentState {
  return {
    necessary: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    updatedAt: Date.now(),
  };
}

export function consentToGoogleSignals(consent: ConsentState) {
  return {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
  } as const;
}
