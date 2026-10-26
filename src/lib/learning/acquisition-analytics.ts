export type AcquisitionEvent =
  | "course_view"
  | "course_catalog_view"
  | "course_catalog_click"
  | "course_free_start"
  | "lesson_public_preview_view"
  | "lesson_paywall_view"
  | "course_cta_click"
  | "course_complementary_click"
  | "curriculum_lesson_expand"
  | "home_course_path_click"
  | "service_from_course_click";

const ALLOWED_KEYS = ["course_slug", "lesson_slug", "cta_name", "source_course_slug", "target_course_slug", "scenario"] as const;

export type AcquisitionPayload = {
  course_slug?: string;
  lesson_slug?: string;
  cta_name?: string;
  source_course_slug?: string;
  target_course_slug?: string;
  scenario?: string;
};

export function acquisitionAnalyticsPayload(input: AcquisitionPayload): AcquisitionPayload {
  const payload: AcquisitionPayload = {};
  for (const key of ALLOWED_KEYS) {
    const value = input[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

export function acquisitionDedupeKey(event: AcquisitionEvent, slug: string): string {
  return `af_${event}_${slug}`;
}
