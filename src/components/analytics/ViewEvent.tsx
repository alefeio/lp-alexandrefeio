"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { acquisitionAnalyticsPayload, acquisitionDedupeKey, type AcquisitionEvent } from "@/lib/learning/acquisition-analytics";

export function ViewEvent({
  event,
  slug,
  courseSlug,
  lessonSlug,
  ctaName,
}: {
  event: AcquisitionEvent;
  slug: string;
  courseSlug?: string;
  lessonSlug?: string;
  ctaName?: string;
}) {
  useEffect(() => {
    const key = acquisitionDedupeKey(event, slug);
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    trackEvent(event, acquisitionAnalyticsPayload({ course_slug: courseSlug, lesson_slug: lessonSlug, cta_name: ctaName }));
  }, [event, slug, courseSlug, lessonSlug, ctaName]);
  return null;
}
