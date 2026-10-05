"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { trackEvent, type AnalyticsEventName, type AnalyticsParams } from "@/lib/analytics";

export function TrackedLink({
  href,
  event,
  params,
  className,
  children,
}: {
  href: string;
  event: AnalyticsEventName;
  params?: AnalyticsParams;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent(event, params)}>
      {children}
    </Link>
  );
}
