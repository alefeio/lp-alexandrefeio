import { z } from "zod";
import { calculateContrastRatio, mixHex, normalizeHex, relativeLuminance } from "@/lib/landing-page/theme/color";

export const THEME_FONT_FAMILIES = ["SYSTEM_SANS", "INTER", "SERIF"] as const;
export const THEME_SCALES = ["COMPACT", "BALANCED", "EXPRESSIVE"] as const;
export const THEME_CONTENT_WIDTHS = ["NARROW", "STANDARD", "WIDE"] as const;
export const THEME_SECTION_SPACING = ["COMPACT", "COMFORTABLE", "SPACIOUS"] as const;
export const THEME_CONTENT_DENSITY = ["COMPACT", "BALANCED", "AIRY"] as const;
export const THEME_RADII = ["SQUARE", "SOFT", "ROUNDED"] as const;
export const THEME_BUTTON_STYLES = ["SOLID", "OUTLINE"] as const;
export const THEME_WEIGHTS = [400, 500, 600, 700] as const;
export const THEME_PRESET_IDS = ["CLARO", "SOBRIO", "CONTRASTE", "EDITORIAL"] as const;

export const SECTION_BACKGROUND_ROLES = ["DEFAULT", "SURFACE", "PRIMARY", "ACCENT"] as const;
export const SECTION_ALIGNMENTS = ["LEFT", "CENTER"] as const;
export const SECTION_EMPHASIS = ["NORMAL", "FEATURED"] as const;
export const MAX_FEATURED_WITHOUT_WARNING = 3;
export const PRIMARY_BACKGROUND_RUN_WARNING = 3;

const hex = z.string().trim().transform((value, ctx) => {
  const normalized = normalizeHex(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Cor inválida" });
    return z.NEVER;
  }
  return normalized;
});

const scale = z.enum(THEME_SCALES);

export const landingPageThemeV1Schema = z
  .object({
    version: z.literal(1),
    colors: z
      .object({
        background: hex,
        surface: hex,
        text: hex,
        mutedText: hex,
        primary: hex,
        primaryText: hex,
        border: hex,
        accent: hex.optional(),
      })
      .strict(),
    typography: z
      .object({
        fontFamily: z.enum(THEME_FONT_FAMILIES),
        headingScale: scale,
        bodyScale: scale.default("BALANCED"),
        headingWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
        bodyWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
      })
      .strict(),
    layout: z
      .object({
        contentWidth: z.enum(THEME_CONTENT_WIDTHS),
        sectionSpacing: z.enum(THEME_SECTION_SPACING),
        contentDensity: z.enum(THEME_CONTENT_DENSITY),
      })
      .strict(),
    shape: z
      .object({
        buttonRadius: z.enum(THEME_RADII),
        cardRadius: z.enum(THEME_RADII),
      })
      .strict(),
    buttons: z
      .object({
        style: z.enum(THEME_BUTTON_STYLES),
      })
      .strict(),
  })
  .strict();

export type LandingPageThemeV1 = z.infer<typeof landingPageThemeV1Schema>;

const legacyThemeSchema = z
  .object({
    fontFamily: z.enum(["sans", "serif"]),
    primaryColor: z.string(),
    backgroundColor: z.string(),
    textColor: z.string(),
    buttonRadius: z.enum(["none", "sm", "md", "lg"]),
    contentWidth: z.enum(["narrow", "default", "wide"]),
  })
  .strict();

const WIDTH_FROM_LEGACY = { narrow: "NARROW", default: "STANDARD", wide: "WIDE" } as const;
const RADIUS_FROM_LEGACY = { none: "SQUARE", sm: "SOFT", md: "SOFT", lg: "ROUNDED" } as const;

export function defaultLandingPageTheme(): LandingPageThemeV1 {
  return {
    version: 1,
    colors: {
      background: "#f7f6f3",
      surface: "#ffffff",
      text: "#1c1917",
      mutedText: "#44403c",
      primary: "#1c1917",
      primaryText: "#ffffff",
      border: "#e7e5e4",
    },
    typography: {
      fontFamily: "SYSTEM_SANS",
      headingScale: "BALANCED",
      bodyScale: "BALANCED",
      headingWeight: 600,
      bodyWeight: 400,
    },
    layout: {
      contentWidth: "STANDARD",
      sectionSpacing: "COMFORTABLE",
      contentDensity: "BALANCED",
    },
    shape: { buttonRadius: "SOFT", cardRadius: "SOFT" },
    buttons: { style: "SOLID" },
  };
}

export function deriveSurface(background: string): string {
  const normalized = normalizeHex(background) ?? "#ffffff";
  const luminance = relativeLuminance(normalized);
  if (luminance > 0.9) return mixHex(normalized, "#111111", 0.04);
  if (luminance > 0.45) return mixHex(normalized, "#ffffff", 0.4);
  return mixHex(normalized, "#ffffff", 0.1);
}

export function deriveBorder(background: string, text: string): string {
  return mixHex(background, text, 0.16);
}

export function deriveMutedText(text: string, background: string): string {
  let muted = mixHex(text, background, 0.28);
  if (calculateContrastRatio(muted, background) < 4.5) muted = mixHex(text, background, 0.12);
  return muted;
}

export function derivePrimaryText(primary: string): string {
  const white = calculateContrastRatio("#ffffff", primary);
  const ink = calculateContrastRatio("#111111", primary);
  return white >= ink ? "#ffffff" : "#111111";
}

export function themeFromBrandColors(input: {
  primary: string;
  background: string;
  text: string;
  accent?: string;
  fontFamily?: LandingPageThemeV1["typography"]["fontFamily"];
  contentWidth?: LandingPageThemeV1["layout"]["contentWidth"];
  buttonRadius?: LandingPageThemeV1["shape"]["buttonRadius"];
}): LandingPageThemeV1 {
  const base = defaultLandingPageTheme();
  const primary = normalizeHex(input.primary) ?? input.primary;
  const background = normalizeHex(input.background) ?? input.background;
  const text = normalizeHex(input.text) ?? input.text;
  const accent = input.accent ? normalizeHex(input.accent) ?? input.accent : undefined;
  return {
    ...base,
    colors: {
      background,
      surface: deriveSurface(background),
      text,
      mutedText: deriveMutedText(text, background),
      primary,
      primaryText: derivePrimaryText(primary),
      border: deriveBorder(background, text),
      ...(accent ? { accent } : {}),
    },
    typography: { ...base.typography, fontFamily: input.fontFamily ?? base.typography.fontFamily },
    layout: { ...base.layout, contentWidth: input.contentWidth ?? base.layout.contentWidth },
    shape: {
      buttonRadius: input.buttonRadius ?? base.shape.buttonRadius,
      cardRadius: input.buttonRadius ?? base.shape.cardRadius,
    },
  };
}

function fromLegacy(value: z.infer<typeof legacyThemeSchema>): LandingPageThemeV1 {
  return themeFromBrandColors({
    primary: value.primaryColor,
    background: value.backgroundColor,
    text: value.textColor,
    fontFamily: value.fontFamily === "serif" ? "SERIF" : "SYSTEM_SANS",
    contentWidth: WIDTH_FROM_LEGACY[value.contentWidth],
    buttonRadius: RADIUS_FROM_LEGACY[value.buttonRadius],
  });
}

export const landingPageThemeSchema = z.preprocess((input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  if ("colors" in input) return input;
  if (!("primaryColor" in input)) return input;
  const legacy = legacyThemeSchema.safeParse(input);
  return legacy.success ? fromLegacy(legacy.data) : input;
}, landingPageThemeV1Schema);

export const sectionVisualSettingsSchema = z
  .object({
    backgroundRole: z.enum(SECTION_BACKGROUND_ROLES).default("DEFAULT"),
    alignment: z.enum(SECTION_ALIGNMENTS).default("LEFT"),
    emphasis: z.enum(SECTION_EMPHASIS).default("NORMAL"),
  })
  .strict();

export type SectionVisualSettings = z.infer<typeof sectionVisualSettingsSchema>;

export type ContrastLevel = "GOOD" | "ATTENTION" | "CRITICAL";

export type ContrastPair = "TEXT_BACKGROUND" | "MUTED_BACKGROUND" | "PRIMARY_TEXT_PRIMARY" | "TEXT_SURFACE";

export type ContrastCheck = { pair: ContrastPair; ratio: number; level: ContrastLevel };

function levelFor(ratio: number, strong: number): ContrastLevel {
  if (ratio >= strong) return "GOOD";
  if (ratio >= 3) return "ATTENTION";
  return "CRITICAL";
}

/**
 * Checagem parcial de contraste dos papéis de cor.
 * Não é uma auditoria completa de acessibilidade.
 * Texto corrido usa 4.5 como referência forte. Componente de interface usa 3.0.
 */
export function assessThemeContrast(theme: LandingPageThemeV1): {
  checks: ContrastCheck[];
  blocked: ContrastPair[];
  warnings: ContrastPair[];
} {
  const { colors } = theme;
  const checks: ContrastCheck[] = [
    { pair: "TEXT_BACKGROUND", ratio: calculateContrastRatio(colors.text, colors.background), level: "GOOD" },
    { pair: "MUTED_BACKGROUND", ratio: calculateContrastRatio(colors.mutedText, colors.background), level: "GOOD" },
    { pair: "PRIMARY_TEXT_PRIMARY", ratio: calculateContrastRatio(colors.primaryText, colors.primary), level: "GOOD" },
    { pair: "TEXT_SURFACE", ratio: calculateContrastRatio(colors.text, colors.surface), level: "GOOD" },
  ];
  checks[0].level = levelFor(checks[0].ratio, 4.5);
  checks[1].level = levelFor(checks[1].ratio, 4.5);
  checks[2].level = levelFor(checks[2].ratio, 4.5);
  checks[3].level = levelFor(checks[3].ratio, 4.5);
  const blocked = checks
    .filter((check) => {
      if (check.pair === "TEXT_BACKGROUND") return check.ratio < 4.5;
      if (check.pair === "PRIMARY_TEXT_PRIMARY" || check.pair === "MUTED_BACKGROUND" || check.pair === "TEXT_SURFACE") return check.ratio < 3;
      return false;
    })
    .map((check) => check.pair);
  const warnings = checks
    .filter((check) => !blocked.includes(check.pair) && check.level === "ATTENTION")
    .map((check) => check.pair);
  return { checks, blocked, warnings };
}

const SOBRIO: LandingPageThemeV1 = {
  ...defaultLandingPageTheme(),
  colors: {
    background: "#f4f4f5",
    surface: "#ffffff",
    text: "#18181b",
    mutedText: "#3f3f46",
    primary: "#27272a",
    primaryText: "#ffffff",
    border: "#e4e4e7",
  },
};

const CONTRASTE: LandingPageThemeV1 = {
  ...defaultLandingPageTheme(),
  colors: {
    background: "#ffffff",
    surface: "#f5f5f5",
    text: "#000000",
    mutedText: "#3f3f46",
    primary: "#000000",
    primaryText: "#ffffff",
    border: "#d4d4d8",
  },
  typography: { ...defaultLandingPageTheme().typography, headingScale: "EXPRESSIVE" },
};

const EDITORIAL: LandingPageThemeV1 = {
  ...defaultLandingPageTheme(),
  colors: {
    background: "#f6f1e7",
    surface: "#fffaf3",
    text: "#1f1a17",
    mutedText: "#44403c",
    primary: "#3f2f2a",
    primaryText: "#ffffff",
    border: "#e6dccb",
  },
  typography: { ...defaultLandingPageTheme().typography, fontFamily: "SERIF", headingScale: "EXPRESSIVE" },
  layout: { ...defaultLandingPageTheme().layout, sectionSpacing: "SPACIOUS", contentDensity: "AIRY" },
};

export const THEME_PRESETS: Record<(typeof THEME_PRESET_IDS)[number], LandingPageThemeV1> = {
  CLARO: defaultLandingPageTheme(),
  SOBRIO,
  CONTRASTE,
  EDITORIAL,
};

export function themePreset(id: (typeof THEME_PRESET_IDS)[number]): LandingPageThemeV1 {
  return structuredClone(THEME_PRESETS[id]);
}
