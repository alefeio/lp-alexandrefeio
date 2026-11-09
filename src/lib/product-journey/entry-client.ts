import { CONSENT_STORAGE_KEY, parseConsent } from "@/lib/consent";
import { persistJourneyEvent } from "@/lib/product-journey/client";
import { journeyObservedPath } from "@/lib/product-journey/public-path";

let lastPageViewPath: string | null = null;
let lastPageViewAt = 0;

export function resetSitePageViewDedupeForTests(): void {
  lastPageViewPath = null;
  lastPageViewAt = 0;
}

/** Deduplica remount/Strict Mode na mesma navegação; reload (novo JS) dispara de novo. */
export function shouldEmitSitePageView(path: string, now = Date.now()): boolean {
  if (lastPageViewPath === path && now - lastPageViewAt < 1500) return false;
  lastPageViewPath = path;
  lastPageViewAt = now;
  return true;
}

/** Emite site_page_view da página atual se analytics estiver ligado e o path for observado. */
export function emitSitePageView(pathname: string, consentUpdatedAt?: number): boolean {
  if (typeof window === "undefined") return false;
  const path = journeyObservedPath(pathname);
  if (!path) return false;
  const consent = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  if (!consent?.analytics) return false;
  if (!shouldEmitSitePageView(path)) return false;
  persistJourneyEvent({
    eventName: "site_page_view",
    params: {},
    sourcePathOverride: path,
    consentUpdatedAt: consentUpdatedAt ?? consent.updatedAt,
  });
  return true;
}
