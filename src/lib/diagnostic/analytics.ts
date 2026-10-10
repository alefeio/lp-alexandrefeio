import { DIAGNOSTIC_TYPE, DIAGNOSTIC_VERSION } from "@/lib/diagnostic/definition";
import type { ResultBand } from "@/lib/diagnostic/score";

const ALLOWED = ["diagnostic_type", "diagnostic_version", "result_band"] as const;

export function diagnosticAnalyticsPayload(input: { band?: ResultBand }) {
  const payload: Record<string, string> = {
    diagnostic_type: DIAGNOSTIC_TYPE,
    diagnostic_version: DIAGNOSTIC_VERSION,
  };
  if (input.band) payload.result_band = input.band;
  return payload;
}

export function diagnosticPayloadIsPublic(payload: Record<string, unknown>) {
  return Object.keys(payload).every((key) => (ALLOWED as readonly string[]).includes(key));
}
