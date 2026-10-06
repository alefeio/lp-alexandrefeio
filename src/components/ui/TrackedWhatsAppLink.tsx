"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";

export function TrackedWhatsAppLink({
  href,
  location,
  className,
  children,
  label,
}: {
  href: string;
  location: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackEvent("whatsapp_click", { cta_location: location })}
    >
      {children}
    </a>
  );
}
