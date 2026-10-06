"use client";

import { useEffect } from "react";
import { ATTRIBUTION_STORAGE_KEY, buildAttributionFromUrl } from "@/lib/attribution";

export function AttributionCapture() {
  useEffect(() => {
    if (sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return;
    const attribution = buildAttributionFromUrl(window.location.href, document.referrer);
    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  }, []);

  return null;
}
