import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { EXPERIENCE_VIEWPORT_IDS, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";

export type ExperienceChecklistDefinition = {
  id: string;
  label: string;
  viewport: ExperienceViewportId;
};

export const EXPERIENCE_CHECKLIST: readonly ExperienceChecklistDefinition[] = [
  { id: "mobile-offer", viewport: "MOBILE", label: "Consigo entender a oferta sem zoom?" },
  { id: "mobile-cta", viewport: "MOBILE", label: "O CTA principal está fácil de encontrar?" },
  { id: "mobile-text", viewport: "MOBILE", label: "Os textos estão confortáveis de ler?" },
  { id: "mobile-images", viewport: "MOBILE", label: "Imagens fazem sentido?" },
  { id: "mobile-form", viewport: "MOBILE", label: "Formulário parece simples?" },
  { id: "desktop-width", viewport: "DESKTOP", label: "O conteúdo não fica largo demais?" },
  { id: "desktop-hierarchy", viewport: "DESKTOP", label: "Existe hierarquia?" },
  { id: "desktop-sections", viewport: "DESKTOP", label: "Seções estão bem separadas?" },
  { id: "desktop-action", viewport: "DESKTOP", label: "A ação continua clara?" },
];

export function checklistApplicable(document: LandingPageDocumentV1, id: string): boolean {
  const enabled = document.sections.filter((section) => section.enabled);
  if (id === "mobile-form") return enabled.some((section) => section.type === "FORM");
  if (id === "mobile-images") {
    return enabled.some((section) => {
      if ((section.type === "HERO" || section.type === "FOOTER") && section.content.mediaRef) return true;
      if (section.type === "PORTFOLIO" && section.content.items.length > 0) return true;
      return false;
    });
  }
  return EXPERIENCE_CHECKLIST.some((item) => item.id === id);
}

export function experienceChecklistFor(document: LandingPageDocumentV1) {
  return EXPERIENCE_CHECKLIST.map((item) => ({
    ...item,
    applicable: checklistApplicable(document, item.id),
    confirmed: false,
  }));
}

export function requiredViewportsReviewed(viewports: readonly ExperienceViewportId[]): boolean {
  return EXPERIENCE_VIEWPORT_IDS.every((id) => viewports.includes(id));
}
