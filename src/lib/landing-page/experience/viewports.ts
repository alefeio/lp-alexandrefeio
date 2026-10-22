export const EXPERIENCE_VIEWPORT_IDS = ["MOBILE_SMALL", "MOBILE", "TABLET", "DESKTOP"] as const;

export type ExperienceViewportId = (typeof EXPERIENCE_VIEWPORT_IDS)[number];

export const EXPERIENCE_VIEWPORT_WIDTH: Record<ExperienceViewportId, number> = {
  MOBILE_SMALL: 320,
  MOBILE: 375,
  TABLET: 768,
  DESKTOP: 1280,
};

export const EXPERIENCE_VIEWPORT_LABEL: Record<ExperienceViewportId, string> = {
  MOBILE_SMALL: "320 px",
  MOBILE: "375 px",
  TABLET: "Tablet",
  DESKTOP: "Desktop",
};

export const EXPERIENCE_VIEWPORT_CONTROL: Record<ExperienceViewportId, string> = {
  MOBILE_SMALL: "Celular pequeno",
  MOBILE: "Celular",
  TABLET: "Tablet",
  DESKTOP: "Desktop",
};

/** A conclusão pedagógica da revisão pede os quatro presets. */
export const EXPERIENCE_REQUIRED_VIEWPORTS: readonly ExperienceViewportId[] = EXPERIENCE_VIEWPORT_IDS;
