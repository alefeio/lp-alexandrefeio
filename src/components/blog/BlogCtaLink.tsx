"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";
import type { BlogClickParams } from "@/lib/blog/clicks";

export function BlogCtaLink({
  href,
  className,
  event,
  params,
  children,
}: {
  href: string;
  className?: string;
  event: Extract<AnalyticsEventName, "cta_click" | "service_from_course_click">;
  params: BlogClickParams;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent(event, params)}>
      {children}
    </Link>
  );
}
