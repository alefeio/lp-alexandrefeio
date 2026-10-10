import type { ProgressBucket } from "@/lib/learning/progress";

export type LessonAnalyticsEvent = "lesson_started" | "lesson_progress" | "lesson_completed";

const ALLOWED_KEYS = ["lesson_slug", "course_slug", "access_type", "progress_bucket"] as const;

export type LessonAnalyticsPayload = {
  lesson_slug: string;
  course_slug: string;
  access_type: "FREE" | "PAID";
  progress_bucket?: ProgressBucket;
};

export function lessonAnalyticsPayload(input: {
  lessonSlug: string;
  courseSlug: string;
  accessType: "FREE" | "PAID";
  progressBucket?: ProgressBucket;
}): LessonAnalyticsPayload {
  const payload: LessonAnalyticsPayload = {
    lesson_slug: input.lessonSlug,
    course_slug: input.courseSlug,
    access_type: input.accessType,
  };
  if (input.progressBucket !== undefined) payload.progress_bucket = input.progressBucket;
  return payload;
}

export function lessonEventDedupeKey(slug: string, event: LessonAnalyticsEvent, bucket?: ProgressBucket): string {
  if (event === "lesson_started") return `af_lesson_started_${slug}`;
  return `af_lesson_${event}_${slug}_${bucket ?? "x"}`;
}

export function lessonAnalyticsEntries(payload: LessonAnalyticsPayload): Record<string, string | number> {
  const entries: Record<string, string | number> = {};
  for (const key of ALLOWED_KEYS) {
    const value = payload[key];
    if (value !== undefined) entries[key] = value;
  }
  return entries;
}
