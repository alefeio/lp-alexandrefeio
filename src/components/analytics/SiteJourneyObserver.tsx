"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getConsentUIState, subscribeConsentUI } from "@/lib/consent-store";
import { emitSitePageView } from "@/lib/product-journey/entry-client";

/**
 * Registra site_page_view em navegações públicas consentidas.
 * No aceite tardio, emite só a página atual (sem replay).
 */
export function SiteJourneyObserver() {
  const pathname = usePathname();
  const hadAnalytics = useRef(false);

  useEffect(() => {
    const state = getConsentUIState();
    if (state.consent?.analytics === true && pathname) {
      hadAnalytics.current = true;
      emitSitePageView(pathname, state.consent.updatedAt);
    }
  }, [pathname]);

  useEffect(() => {
    return subscribeConsentUI(() => {
      const state = getConsentUIState();
      const analytics = state.consent?.analytics === true;
      if (!analytics) {
        hadAnalytics.current = false;
        return;
      }
      if (hadAnalytics.current || !pathname) return;
      hadAnalytics.current = true;
      emitSitePageView(pathname, state.consent?.updatedAt);
    });
  }, [pathname]);

  return null;
}
