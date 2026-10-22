import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { availableLandingPageMeasurementEvents } from "@/lib/landing-page/measurement/availability";
import { landingPageMeasurementSchema, type LandingPageMeasurementEvent, type LandingPageMeasurementV1 } from "@/lib/landing-page/measurement/schema";

export type LandingPageMeasurementValidation = {
  valid: boolean;
  warnings: string[];
  availableEvents: LandingPageMeasurementEvent[];
  invalidSelections: string[];
  measurement: LandingPageMeasurementV1 | null;
};

/** Confere o plano contra a página. Não produz nota. */
export function validateLandingPageMeasurement(document: LandingPageDocumentV1, measurement: unknown): LandingPageMeasurementValidation {
  const availableEvents = availableLandingPageMeasurementEvents(document);
  const parsed = landingPageMeasurementSchema.safeParse(measurement);
  if (!parsed.success) {
    return { valid: false, warnings: [], availableEvents, invalidSelections: ["measurement"], measurement: null };
  }
  const invalidSelections: string[] = [];
  const warnings: string[] = [];
  for (const event of parsed.data.enabledEvents) {
    if (!availableEvents.includes(event)) invalidSelections.push(event);
  }
  if (!parsed.data.primaryConversionEvent) {
    invalidSelections.push("primaryConversionEvent");
    warnings.push("A conversão principal ainda não foi confirmada.");
  } else if (!availableEvents.includes(parsed.data.primaryConversionEvent)) {
    invalidSelections.push(parsed.data.primaryConversionEvent);
  } else if (!parsed.data.enabledEvents.includes(parsed.data.primaryConversionEvent)) {
    invalidSelections.push(parsed.data.primaryConversionEvent);
  }
  const missing = availableEvents.filter((event) => !parsed.data.enabledEvents.includes(event));
  if (missing.length > 0 && invalidSelections.length === 0) {
    warnings.push("Há eventos disponíveis que ficaram de fora do plano.");
  }
  return {
    valid: invalidSelections.length === 0,
    warnings,
    availableEvents,
    invalidSelections,
    measurement: parsed.data,
  };
}
