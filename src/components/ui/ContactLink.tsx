"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { buttonClass, type ButtonVariant } from "@/lib/button-styles";
import { resolveCta } from "@/lib/contact";

export function ContactLink({
  location,
  serviceId,
  children,
  variant = "primary",
  className,
  onClick,
  label,
}: {
  location: string;
  serviceId?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  onClick?: () => void;
  label?: string;
}) {
  const target = resolveCta(serviceId);
  const classNames = buttonClass(variant, className);
  const params = {
    location,
    action: serviceId ?? (target.external ? "whatsapp" : "form"),
  };

  function handleClick() {
    trackEvent(target.event, params);
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
