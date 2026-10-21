import type { CSSProperties } from "react";
import { isNormalizedHex } from "@/lib/landing-page/theme/color";
import type { LandingPageThemeV1 } from "@/lib/landing-page/theme/schema";

const WIDTH: Record<LandingPageThemeV1["layout"]["contentWidth"], string> = {
  NARROW: "40rem",
  STANDARD: "48rem",
  WIDE: "64rem",
};

const RADIUS: Record<LandingPageThemeV1["shape"]["buttonRadius"], string> = {
  SQUARE: "0px",
  SOFT: "8px",
  ROUNDED: "16px",
};

const SPACING: Record<LandingPageThemeV1["layout"]["sectionSpacing"], string> = {
  COMPACT: "2.5rem",
  COMFORTABLE: "3.5rem",
  SPACIOUS: "5rem",
};

const DENSITY: Record<LandingPageThemeV1["layout"]["contentDensity"], string> = {
  COMPACT: "0.75rem",
  BALANCED: "1.25rem",
  AIRY: "2rem",
};

const HEADING: Record<LandingPageThemeV1["typography"]["headingScale"], string> = {
  COMPACT: "clamp(1.5rem, 4vw, 2rem)",
  BALANCED: "clamp(1.75rem, 5vw, 2.75rem)",
  EXPRESSIVE: "clamp(2rem, 6vw, 3.5rem)",
};

const BODY: Record<LandingPageThemeV1["typography"]["bodyScale"], string> = {
  COMPACT: "1rem",
  BALANCED: "1.0625rem",
  EXPRESSIVE: "1.125rem",
};

const FONT: Record<LandingPageThemeV1["typography"]["fontFamily"], string> = {
  SYSTEM_SANS: "ui-sans-serif, system-ui, sans-serif",
  INTER: "Inter, ui-sans-serif, system-ui, sans-serif",
  SERIF: "Georgia, 'Times New Roman', serif",
};

/** Tokens já validados viram variáveis internas. Nenhuma string de CSS do aluno entra aqui. */
export function mapLandingPageTheme(theme: LandingPageThemeV1): CSSProperties {
  const colors = [
    theme.colors.background,
    theme.colors.surface,
    theme.colors.text,
    theme.colors.mutedText,
    theme.colors.primary,
    theme.colors.primaryText,
    theme.colors.border,
    theme.colors.accent ?? theme.colors.surface,
  ];
  if (colors.some((color) => !isNormalizedHex(color))) throw new Error("LANDING_PAGE_THEME_INVALID");
  const solid = theme.buttons.style === "SOLID";
  return {
    ["--lp-background" as string]: theme.colors.background,
    ["--lp-surface" as string]: theme.colors.surface,
    ["--lp-text" as string]: theme.colors.text,
    ["--lp-muted" as string]: theme.colors.mutedText,
    ["--lp-primary" as string]: theme.colors.primary,
    ["--lp-primary-text" as string]: theme.colors.primaryText,
    ["--lp-border" as string]: theme.colors.border,
    ["--lp-accent" as string]: theme.colors.accent ?? theme.colors.surface,
    ["--lp-content-width" as string]: WIDTH[theme.layout.contentWidth],
    ["--lp-button-radius" as string]: RADIUS[theme.shape.buttonRadius],
    ["--lp-card-radius" as string]: RADIUS[theme.shape.cardRadius],
    ["--lp-section-spacing" as string]: SPACING[theme.layout.sectionSpacing],
    ["--lp-density" as string]: DENSITY[theme.layout.contentDensity],
    ["--lp-heading-size" as string]: HEADING[theme.typography.headingScale],
    ["--lp-body-size" as string]: BODY[theme.typography.bodyScale],
    ["--lp-heading-weight" as string]: String(theme.typography.headingWeight),
    ["--lp-body-weight" as string]: String(theme.typography.bodyWeight),
    ["--lp-button-bg" as string]: solid ? theme.colors.primary : "transparent",
    ["--lp-button-fg" as string]: solid ? theme.colors.primaryText : theme.colors.primary,
    ["--lp-button-border" as string]: solid ? "1px solid transparent" : `1px solid ${theme.colors.primary}`,
    fontFamily: FONT[theme.typography.fontFamily],
    fontWeight: theme.typography.bodyWeight,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: BODY[theme.typography.bodyScale],
  };
}

export const themeToCssVariables = mapLandingPageTheme;
export type { LandingPageThemeV1 as LandingPageTheme } from "@/lib/landing-page/theme/schema";
