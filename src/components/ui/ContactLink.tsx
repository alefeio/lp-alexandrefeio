"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { buttonClass, type ButtonVariant } from "@/lib/button-styles";
import { resolveCta } from "@/lib/contact";
import { toServiceAnalyticsName } from "@/lib/service-analytics";

export function ContactLink({
  location,
  serviceId,
  ctaName,
  children,
  variant = "primary",
  className,
  onClick,
  label,
  channel = "form",
}: {
  location: string;
  serviceId?: string;
  ctaName?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: () => void;
  label?: string;
  channel?: "form" | "whatsapp";
}) {
  const target = resolveCta(serviceId, channel);
  const classNames = buttonClass(variant, className);

  function handleClick() {
    if (target.event === "service_interest") {
      const serviceName = toServiceAnalyticsName(serviceId);
      if (serviceName) {
        trackEvent("service_interest", { service_name: serviceName });
      }
    } else if (target.event === "whatsapp_click") {
      trackEvent("whatsapp_click", { cta_location: location });
    } else {
      trackEvent("cta_click", {
        cta_name: ctaName ?? location,
        cta_location: location,
        destination_type: target.external ? "whatsapp" : serviceId ? "form_service" : "form",
      });
    }

    onClick?.();
  }

  if (target.external) {
    return (
      <a href={target.href} className={classNames} aria-label={label} target="_blank" rel="noopener noreferrer" onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={target.href} className={classNames} aria-label={label} onClick={handleClick}>
      {children}
    </Link>
  );
}
