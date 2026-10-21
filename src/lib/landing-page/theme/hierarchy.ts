import type { LandingPageSection } from "@/lib/landing-page/components";
import { assessThemeContrast, MAX_FEATURED_WITHOUT_WARNING, PRIMARY_BACKGROUND_RUN_WARNING, type LandingPageThemeV1 } from "@/lib/landing-page/theme/schema";

export const VISUAL_HIERARCHY_WARNINGS = [
  "NO_PRIMARY_CONTRAST",
  "TOO_MANY_FEATURED_SECTIONS",
  "EXCESSIVE_CENTER_ALIGNMENT",
  "PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN",
] as const;

export type VisualHierarchyWarning = (typeof VISUAL_HIERARCHY_WARNINGS)[number];

export function evaluateVisualHierarchy(theme: LandingPageThemeV1, sections: LandingPageSection[]): VisualHierarchyWarning[] {
  const warnings: VisualHierarchyWarning[] = [];
  const contrast = assessThemeContrast(theme);
  if (contrast.checks.some((check) => check.pair === "PRIMARY_TEXT_PRIMARY" && check.level !== "GOOD")) {
    warnings.push("NO_PRIMARY_CONTRAST");
  }
  const featured = sections.filter((section) => section.settings.emphasis === "FEATURED").length;
  if (featured > MAX_FEATURED_WITHOUT_WARNING) warnings.push("TOO_MANY_FEATURED_SECTIONS");
  const enabled = sections.filter((section) => section.enabled);
  if (enabled.length >= 3 && enabled.every((section) => section.settings.alignment === "CENTER")) {
    warnings.push("EXCESSIVE_CENTER_ALIGNMENT");
  }
  let run = 0;
  for (const section of enabled) {
    run = section.settings.backgroundRole === "PRIMARY" ? run + 1 : 0;
    if (run >= PRIMARY_BACKGROUND_RUN_WARNING) {
      warnings.push("PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN");
      break;
    }
  }
  return warnings;
}
