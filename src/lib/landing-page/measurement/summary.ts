import type { LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { availableLandingPageMeasurementEvents } from "@/lib/landing-page/measurement/availability";
import { LANDING_PAGE_MEASUREMENT_LABELS, type LandingPageMeasurementEvent } from "@/lib/landing-page/measurement/schema";

function actionLabel(action: LandingPageAction | null): string {
  switch (action?.type) {
    case "WHATSAPP":
      return "WhatsApp";
    case "EXTERNAL_URL":
      return "Link externo";
    case "INTERNAL_ROUTE":
      return "Página interna";
    case "FORM_ANCHOR":
      return "Formulário";
    default:
      return "Ainda não definida";
  }
}

/**
 * Simulação do que a página mediria. Não lê e não grava contadores.
 */
export function buildLandingPageMeasurementSummary(document: LandingPageDocumentV1): {
  primaryAction: string;
  primaryConversion: string;
  availableEvents: Array<{ event: LandingPageMeasurementEvent; label: string }>;
  enabledEvents: LandingPageMeasurementEvent[];
  counts: null;
} {
  const primary = document.measurement.primaryConversionEvent;
  return {
    primaryAction: actionLabel(document.conversion.primaryAction),
    primaryConversion: primary ? LANDING_PAGE_MEASUREMENT_LABELS[primary] : "Ainda não confirmada",
    availableEvents: availableLandingPageMeasurementEvents(document).map((event) => ({
      event,
      label: LANDING_PAGE_MEASUREMENT_LABELS[event],
    })),
    enabledEvents: document.measurement.enabledEvents,
    counts: null,
  };
}
