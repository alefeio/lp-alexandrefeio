import { DIAGNOSTIC_TYPE, DIAGNOSTIC_VERSION } from "@/lib/diagnostic/definition";
import type { ResultBand } from "@/lib/diagnostic/score";

export const DIAGNOSTIC_COURSE_SLUG = "trafego-pago-na-pratica";

const ALLOWED = ["course_slug", "diagnostic_type", "diagnostic_version", "result_band"] as const;

export function diagnosticAnalyticsPayload(input: { band?: ResultBand }) {
  const payload: Record<string, string> = {
    course_slug: DIAGNOSTIC_COURSE_SLUG,
    diagnostic_type: DIAGNOSTIC_TYPE,
    diagnostic_version: DIAGNOSTIC_VERSION,
  };
  if (input.band) payload.result_band = input.band;
  return payload;
}

export function diagnosticPayloadIsPublic(payload: Record<string, unknown>) {
  return Object.keys(payload).every((key) => (ALLOWED as readonly string[]).includes(key));
}
