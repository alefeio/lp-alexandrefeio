import type { LandingPageSection } from "@/lib/landing-page/components";

/** Seções visíveis, ordenadas por `order`, depois pela posição original e pelo id. */
export function visibleLandingPageSections(sections: readonly LandingPageSection[]): LandingPageSection[] {
  return sections
    .map((section, index) => ({ section, index }))
    .filter((entry) => entry.section.enabled)
    .sort((left, right) => {
      if (left.section.order !== right.section.order) return left.section.order - right.section.order;
      if (left.index !== right.index) return left.index - right.index;
      return left.section.id.localeCompare(right.section.id);
    })
    .map((entry) => entry.section);
}
