import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { EXPERIENCE_VIEWPORT_IDS, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";

export type ExperienceChecklistDefinition = {
  id: string;
  label: string;
  viewport: ExperienceViewportId;
};

export const EXPERIENCE_CHECKLIST: readonly ExperienceChecklistDefinition[] = [
  { id: "small-scroll", viewport: "MOBILE_SMALL", label: "Consigo ler sem rolagem horizontal?" },
  { id: "small-headline", viewport: "MOBILE_SMALL", label: "A headline está compreensível?" },
  { id: "small-cta", viewport: "MOBILE_SMALL", label: "A ação principal está visível?" },
  { id: "small-stack", viewport: "MOBILE_SMALL", label: "As seções empilham corretamente?" },
  { id: "small-cut", viewport: "MOBILE_SMALL", label: "Os textos não estão cortados?" },
  { id: "mobile-read", viewport: "MOBILE", label: "A leitura está confortável?" },
  { id: "mobile-button", viewport: "MOBILE", label: "O botão tem espaço para tocar?" },
  { id: "mobile-images", viewport: "MOBILE", label: "As imagens fazem sentido?" },
  { id: "mobile-faq", viewport: "MOBILE", label: "FAQ e depoimentos continuam legíveis?" },
  { id: "mobile-form", viewport: "MOBILE", label: "Os campos do formulário parecem compreensíveis?" },
  { id: "tablet-grid", viewport: "TABLET", label: "A grade aproveita o espaço sem ficar dispersa?" },
  { id: "tablet-hierarchy", viewport: "TABLET", label: "A hierarquia continua clara?" },
  { id: "tablet-width", viewport: "TABLET", label: "As seções não ficam largas demais?" },
  { id: "desktop-spread", viewport: "DESKTOP", label: "O conteúdo não está espalhado?" },
  { id: "desktop-width", viewport: "DESKTOP", label: "A largura está confortável?" },
  { id: "desktop-cta", viewport: "DESKTOP", label: "A ação principal continua prioritária?" },
  { id: "desktop-sections", viewport: "DESKTOP", label: "As seções estão separadas adequadamente?" },
];

export function checklistApplicable(document: LandingPageDocumentV1, id: string): boolean {
  const enabled = document.sections.filter((section) => section.enabled);
  if (id === "mobile-form") return enabled.some((section) => section.type === "FORM");
  if (id === "mobile-faq") return enabled.some((section) => section.type === "FAQ" || section.type === "TESTIMONIALS");
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
