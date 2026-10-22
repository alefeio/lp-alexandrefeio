import type { LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import type { LandingPageMeasurementEvent } from "@/lib/landing-page/measurement/schema";

function visitActions(document: LandingPageDocumentV1, visit: (action: LandingPageAction) => void): void {
  if (document.conversion.primaryAction) visit(document.conversion.primaryAction);
  if (document.conversion.secondaryAction) visit(document.conversion.secondaryAction);
  for (const section of document.sections) {
    if (!section.enabled) continue;
    if (section.type === "HERO") {
      if (section.content.primaryCta) visit(section.content.primaryCta);
      if (section.content.secondaryCta) visit(section.content.secondaryCta);
    } else if (section.type === "CTA") {
      visit(section.content.action);
    } else if (section.type === "FOOTER") {
      for (const link of section.content.links) visit(link.action);
    }
  }
}

export function landingPageHasEnabledForm(document: LandingPageDocumentV1): boolean {
  return document.sections.some((section) => section.type === "FORM" && section.enabled);
}

/** Eventos que esta página pode medir. PAGE_VIEW existe mesmo sem ação. */
export function availableLandingPageMeasurementEvents(document: LandingPageDocumentV1): LandingPageMeasurementEvent[] {
  const events: LandingPageMeasurementEvent[] = ["PAGE_VIEW"];
  let hasAction = false;
  let hasWhatsApp = false;
  visitActions(document, (action) => {
    hasAction = true;
    if (action.type === "WHATSAPP") hasWhatsApp = true;
  });
  if (hasAction) events.push("CTA_CLICK");
  if (hasWhatsApp) events.push("WHATSAPP_CLICK");
  if (landingPageHasEnabledForm(document)) {
    events.push("FORM_START", "FORM_SUBMIT");
  }
  return events;
}

/**
 * Sugestão determinística a partir da ação principal.
 * Não grava e não confirma o plano. A aula é quem confirma.
 */
export function recommendLandingPageMeasurement(document: LandingPageDocumentV1): {
  enabledEvents: LandingPageMeasurementEvent[];
  primaryConversionEvent: LandingPageMeasurementEvent | null;
} {
  const enabledEvents = availableLandingPageMeasurementEvents(document);
  const action = document.conversion.primaryAction;
  let primaryConversionEvent: LandingPageMeasurementEvent | null = null;
  if (action?.type === "WHATSAPP" && enabledEvents.includes("WHATSAPP_CLICK")) primaryConversionEvent = "WHATSAPP_CLICK";
  else if (action?.type === "FORM_ANCHOR" && enabledEvents.includes("FORM_SUBMIT")) primaryConversionEvent = "FORM_SUBMIT";
  else if (action && enabledEvents.includes("CTA_CLICK")) primaryConversionEvent = "CTA_CLICK";
  return { enabledEvents, primaryConversionEvent };
}
