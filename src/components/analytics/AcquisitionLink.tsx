"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { acquisitionAnalyticsPayload, type AcquisitionEvent, type AcquisitionPayload } from "@/lib/learning/acquisition-analytics";
import { journeyPath } from "@/lib/product-journey/paths";

export function AcquisitionLink({
  href,
  event,
  payload,
  className,
  children,
}: {
  href: string;
  event: AcquisitionEvent;
  payload?: AcquisitionPayload;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent(event, acquisitionAnalyticsPayload(payload ?? {}), { targetPath: journeyPath(href) })}>
      {children}
    </Link>
  );
}
