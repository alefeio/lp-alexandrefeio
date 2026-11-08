"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useBlogReadingOptional } from "@/components/blog/BlogReadingContext";
import { trackEvent, type AnalyticsEventName } from "@/lib/analytics";
import type { BlogClickParams } from "@/lib/blog/clicks";
import { journeyPath } from "@/lib/product-journey/paths";

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
  const reading = useBlogReadingOptional();
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackEvent(event, params, { targetPath: journeyPath(href) });
        if (reading && params.cta_location === "blog_post") {
          reading.reportCommercialClick({
            ctaName: params.cta_name,
            destinationType: params.destination_type,
            targetPath: href,
          });
        }
      }}
    >
      {children}
    </Link>
  );
}
