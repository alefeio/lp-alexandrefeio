"use client";

import { useEffect, type ReactNode } from "react";
import { publicLandingLifecycle, reportPublicLandingEvent } from "@/lib/landing-page/publication/lifecycle";

export function PublicLandingInteractions({ slug, children }: { slug: string; children: ReactNode }) {
  useEffect(() => {
    if (!publicLandingLifecycle.once(`${slug}:PAGE_VIEW`)) return;
    reportPublicLandingEvent(slug, { eventType: "PAGE_VIEW" });
  }, [slug]);

  return (
    <div
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const action = target.closest("[data-action-kind]");
        if (!action) return;
        const kind = action.getAttribute("data-action-kind");
        if (kind === "WHATSAPP") reportPublicLandingEvent(slug, { eventType: "WHATSAPP_CLICK" });
        else if (kind) reportPublicLandingEvent(slug, { eventType: "CTA_CLICK" });
      }}
    >
      {children}
    </div>
  );
}
