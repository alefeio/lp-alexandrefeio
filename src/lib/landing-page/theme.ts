import type { CSSProperties } from "react";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

export type LandingPageTheme = LandingPageDocumentV1["theme"];

const RADIUS: Record<LandingPageTheme["buttonRadius"], string> = {
  none: "0px",
  sm: "4px",
  md: "8px",
  lg: "16px",
};

const WIDTH: Record<LandingPageTheme["contentWidth"], string> = {
  narrow: "40rem",
  default: "48rem",
  wide: "64rem",
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Tokens validados do documento viram variáveis internas. Sem CSS, url() ou var() do usuário. */
export function mapLandingPageTheme(theme: LandingPageTheme): CSSProperties {
  if (!HEX.test(theme.primaryColor) || !HEX.test(theme.backgroundColor) || !HEX.test(theme.textColor)) {
    throw new Error("LANDING_PAGE_THEME_INVALID");
  }

  const fontFamily =
    theme.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : "ui-sans-serif, system-ui, sans-serif";

  return {
    ["--lp-primary" as string]: theme.primaryColor,
    ["--lp-background" as string]: theme.backgroundColor,
    ["--lp-text" as string]: theme.textColor,
    ["--lp-content-width" as string]: WIDTH[theme.contentWidth],
    ["--lp-radius" as string]: RADIUS[theme.buttonRadius],
    fontFamily,
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
  };
}

export const themeToCssVariables = mapLandingPageTheme;
