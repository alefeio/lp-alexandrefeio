import { z } from "zod";
import { LANDING_PAGE_LIMITS, type LandingComponentType } from "@/lib/landing-page/constants";
import { COMPONENT_REGISTRY_V1 } from "@/lib/landing-page/components";
import { normalizeHex } from "@/lib/landing-page/theme/color";
import { VISUAL_HIERARCHY_WARNINGS, type VisualHierarchyWarning } from "@/lib/landing-page/theme/hierarchy";
import {
  defaultLandingPageTheme,
  SECTION_ALIGNMENTS,
  SECTION_BACKGROUND_ROLES,
  SECTION_EMPHASIS,
  THEME_PRESET_IDS,
  themePreset,
  type LandingPageThemeV1,
  type SectionVisualSettings,
} from "@/lib/landing-page/theme/schema";
import { SECTION_NAMES } from "@/lib/landing-page/wireframe/policy";

export const LANDING_PAGE_VISUAL_TOOL = "LANDING_PAGE_VISUAL_DIRECTION_V1" as const;
export const SITE_VISUAL_SLUG = "hierarquia-visual-e-atencao";
export const VISUAL_DIRECTION_VERSION = 1 as const;
export const VISUAL_STARTING_POINTS = ["DEFAULT", "PRESET", "CUSTOM"] as const;
export const VISUAL_GOALS = ["CLARITY", "PRIMARY_ACTION", "TRUST", "CONTENT_FLOW"] as const;
export const VISUAL_COLOR_ROLES = ["background", "surface", "text", "mutedText", "primary", "primaryText", "border"] as const;

export type VisualColorRole = (typeof VISUAL_COLOR_ROLES)[number];
export type VisualStartingPoint = (typeof VISUAL_STARTING_POINTS)[number];
export type VisualGoal = (typeof VISUAL_GOALS)[number];
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

const sectionSummarySchema = z
  .object({
    sectionId: z.string().trim().min(1).max(64),
    backgroundRole: z.enum(SECTION_BACKGROUND_ROLES),
    alignment: z.enum(SECTION_ALIGNMENTS),
    emphasis: z.enum(SECTION_EMPHASIS),
    variant: z.string().trim().min(1).max(40),
  })
  .strict();

export const landingPageVisualDirectionSchema = z
  .object({
    version: z.literal(VISUAL_DIRECTION_VERSION),
    startingPoint: z.enum(VISUAL_STARTING_POINTS),
    preset: z.enum(THEME_PRESET_IDS).optional(),
    primaryVisualGoal: z.enum(VISUAL_GOALS),
    featuredSections: z.array(z.string().trim().min(1).max(64)).max(LANDING_PAGE_LIMITS.maxSections),
    warningsReviewed: z.array(z.enum(VISUAL_HIERARCHY_WARNINGS)).max(VISUAL_HIERARCHY_WARNINGS.length),
    themeFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    sectionVisualSummary: z.array(sectionSummarySchema).max(LANDING_PAGE_LIMITS.maxSections),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startingPoint === "PRESET" && !value.preset) {
      ctx.addIssue({ code: "custom", message: "Ponto de partida sem preset", path: ["preset"] });
    }
    if (value.startingPoint === "DEFAULT" && value.preset) {
      ctx.addIssue({ code: "custom", message: "O visual atual não guarda um preset", path: ["preset"] });
    }
  });

export type LandingPageVisualDirectionV1 = z.infer<typeof landingPageVisualDirectionSchema>;

export const visualDirectionChoiceSchema = z
  .object({
    startingPoint: z.enum(VISUAL_STARTING_POINTS),
    preset: z.enum(THEME_PRESET_IDS).optional(),
    primaryVisualGoal: z.enum(VISUAL_GOALS),
    warningsReviewed: z.array(z.enum(VISUAL_HIERARCHY_WARNINGS)).max(VISUAL_HIERARCHY_WARNINGS.length),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.startingPoint === "PRESET" && !value.preset) {
      ctx.addIssue({ code: "custom", message: "Ponto de partida sem preset", path: ["preset"] });
    }
    if (value.startingPoint === "DEFAULT" && value.preset) {
      ctx.addIssue({ code: "custom", message: "O visual atual não guarda um preset", path: ["preset"] });
    }
  });

export type VisualDirectionChoice = z.infer<typeof visualDirectionChoiceSchema>;

export const visualSectionUpdateSchema = z
  .object({
    sectionId: z.string().trim().min(1).max(64),
    visualSettings: z
      .object({
        backgroundRole: z.enum(SECTION_BACKGROUND_ROLES),
        alignment: z.enum(SECTION_ALIGNMENTS),
        emphasis: z.enum(SECTION_EMPHASIS),
      })
      .strict(),
    variant: z.string().trim().min(1).max(40),
  })
  .strict();

export const visualSectionUpdateListSchema = z.array(visualSectionUpdateSchema).max(LANDING_PAGE_LIMITS.maxSections);

export type VisualSectionView = {
  id: string;
  type: LandingComponentType;
  label: string;
  variant: string;
  enabled: boolean;
  settings: SectionVisualSettings;
};

export type VisualPageView = {
  id: string;
  title: string;
  draftRevision: number;
  status: string;
  setup: "NEED_SECTIONS" | "READY";
  copyHint: boolean;
  theme: LandingPageThemeV1;
  sections: VisualSectionView[];
  direction: LandingPageVisualDirectionV1 | null;
  previewHref: string;
};

export function visualWarningMessage(code: VisualHierarchyWarning): string {
  if (code === "TOO_MANY_FEATURED_SECTIONS") {
    return "Há muitas seções em destaque. Quando tudo recebe ênfase, fica mais difícil perceber o que é prioritário.";
  }
  if (code === "PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN") {
    return "Você está usando a cor principal em muitas seções. Considere reservar esse destaque para momentos mais importantes.";
  }
  if (code === "EXCESSIVE_CENTER_ALIGNMENT") {
    return "Grande parte da página está centralizada. Em conteúdos mais longos, alinhamento à esquerda pode facilitar a leitura.";
  }
  return "A cor principal e o texto sobre ela precisam de mais contraste para o botão continuar perceptível.";
}

export function contrastLevelLabel(level: "GOOD" | "ATTENTION" | "CRITICAL"): string {
  if (level === "GOOD") return "Bom";
  if (level === "ATTENTION") return "Precisa de atenção";
  return "Crítico";
}

export function contrastPairLabel(pair: string): string {
  if (pair === "TEXT_BACKGROUND") return "Texto e fundo";
  if (pair === "MUTED_BACKGROUND") return "Texto secundário e fundo";
  if (pair === "PRIMARY_TEXT_PRIMARY") return "Texto do botão e cor principal";
  return "Texto e superfície";
}

export function fontLabel(value: LandingPageThemeV1["typography"]["fontFamily"]): string {
  if (value === "INTER") return "Inter";
  if (value === "SERIF") return "Serifada";
  return "Sem serifa do sistema";
}

export function scaleLabel(value: LandingPageThemeV1["typography"]["headingScale"]): string {
  if (value === "COMPACT") return "Compacta";
  if (value === "EXPRESSIVE") return "Expressiva";
  return "Equilibrada";
}

export function widthLabel(value: LandingPageThemeV1["layout"]["contentWidth"]): string {
  if (value === "NARROW") return "Estreita";
  if (value === "WIDE") return "Larga";
  return "Padrão";
}

export function spacingLabel(value: LandingPageThemeV1["layout"]["sectionSpacing"]): string {
  if (value === "COMPACT") return "Compacto";
  if (value === "SPACIOUS") return "Espaçoso";
  return "Confortável";
}

export function densityLabel(value: LandingPageThemeV1["layout"]["contentDensity"]): string {
  if (value === "COMPACT") return "Compacta";
  if (value === "AIRY") return "Arejada";
  return "Equilibrada";
}

export function radiusLabel(value: LandingPageThemeV1["shape"]["buttonRadius"]): string {
  if (value === "SQUARE") return "Reto";
  if (value === "ROUNDED") return "Arredondado";
  return "Suave";
}

export function buttonStyleLabel(value: LandingPageThemeV1["buttons"]["style"]): string {
  return value === "OUTLINE" ? "Contorno" : "Preenchido";
}

export function backgroundRoleLabel(value: SectionVisualSettings["backgroundRole"]): string {
  if (value === "SURFACE") return "Fundo secundário";
  if (value === "PRIMARY") return "Cor principal";
  if (value === "ACCENT") return "Destaque";
  return "Fundo principal";
}

export function alignmentLabel(value: SectionVisualSettings["alignment"]): string {
  return value === "CENTER" ? "Centralizado" : "À esquerda";
}

export function emphasisLabel(value: SectionVisualSettings["emphasis"]): string {
  return value === "FEATURED" ? "Em destaque" : "Normal";
}

export function presetLabel(value: ThemePresetId): string {
  if (value === "SOBRIO") return "Sóbrio";
  if (value === "CONTRASTE") return "Contraste";
  if (value === "EDITORIAL") return "Editorial";
  return "Claro";
}

export function goalLabel(value: VisualGoal): string {
  if (value === "PRIMARY_ACTION") return "Ação principal";
  if (value === "TRUST") return "Confiança";
  if (value === "CONTENT_FLOW") return "Percurso do conteúdo";
  return "Clareza da oferta";
}

export function startingPointLabel(value: VisualStartingPoint): string {
  if (value === "PRESET") return "Ponto de partida";
  if (value === "CUSTOM") return "Personalizado";
  return "Visual atual";
}

const VARIANT_LABELS: Record<string, Record<string, string>> = {
  HERO: { default: "Coluna de texto", centered: "Abertura centralizada", split: "Texto em duas colunas" },
  BENEFITS: { default: "Lista", grid: "Cartões" },
  PROCESS: { default: "Empilhado", numbered: "Passos" },
  FAQ: { default: "Lista" },
  CTA: { default: "Simples", banner: "Faixa" },
};

export function variantLabel(type: string, variant: string): string {
  return VARIANT_LABELS[type]?.[variant] ?? "Padrão";
}

export function selectableVariants(type: string): readonly string[] {
  if (!Object.prototype.hasOwnProperty.call(COMPONENT_REGISTRY_V1, type)) return ["default"];
  return COMPONENT_REGISTRY_V1[type as LandingComponentType].variants;
}

export function sectionTypeLabel(type: LandingComponentType): string {
  return SECTION_NAMES[type];
}

export function sameWarningSet(reviewed: readonly string[], current: readonly string[]): boolean {
  const left = [...reviewed].sort();
  const right = [...current].sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function withThemeColor(theme: LandingPageThemeV1, role: VisualColorRole | "accent", raw: string): LandingPageThemeV1 | null {
  const hex = normalizeHex(raw);
  if (!hex) return null;
  return { ...theme, colors: { ...theme.colors, [role]: hex } };
}

export function withoutAccent(theme: LandingPageThemeV1): LandingPageThemeV1 {
  const colors = { ...theme.colors };
  delete colors.accent;
  return { ...theme, colors };
}

export function resolveStartingPoint(theme: LandingPageThemeV1, appliedPreset: ThemePresetId | null): { startingPoint: VisualStartingPoint; preset?: ThemePresetId } {
  if (appliedPreset) {
    if (JSON.stringify(theme) === JSON.stringify(themePreset(appliedPreset))) return { startingPoint: "PRESET", preset: appliedPreset };
    return { startingPoint: "CUSTOM", preset: appliedPreset };
  }
  if (JSON.stringify(theme) === JSON.stringify(defaultLandingPageTheme())) return { startingPoint: "DEFAULT" };
  for (const id of THEME_PRESET_IDS) {
    if (JSON.stringify(theme) === JSON.stringify(themePreset(id))) return { startingPoint: "PRESET", preset: id };
  }
  return { startingPoint: "CUSTOM" };
}

export function assembleVisualDirection(input: {
  themeFingerprint: string;
  sections: VisualSectionView[];
  choice: VisualDirectionChoice;
}): LandingPageVisualDirectionV1 | null {
  const candidate = {
    version: VISUAL_DIRECTION_VERSION,
    startingPoint: input.choice.startingPoint,
    ...(input.choice.preset ? { preset: input.choice.preset } : {}),
    primaryVisualGoal: input.choice.primaryVisualGoal,
    featuredSections: input.sections.filter((section) => section.settings.emphasis === "FEATURED").map((section) => section.id),
    warningsReviewed: input.choice.warningsReviewed,
    themeFingerprint: input.themeFingerprint,
    sectionVisualSummary: input.sections.map((section) => ({
      sectionId: section.id,
      backgroundRole: section.settings.backgroundRole,
      alignment: section.settings.alignment,
      emphasis: section.settings.emphasis,
      variant: section.variant,
    })),
  };
  const parsed = landingPageVisualDirectionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function visualLessonResult(input: {
  landingPageProjectId: string;
  direction: LandingPageVisualDirectionV1;
  draftRevision: number;
}) {
  return {
    kind: "landing-visual-summary" as const,
    landingPageProjectId: input.landingPageProjectId,
    visualDirectionVersion: VISUAL_DIRECTION_VERSION,
    startingPoint: input.direction.startingPoint,
    ...(input.direction.preset ? { preset: input.direction.preset } : {}),
    primaryVisualGoal: input.direction.primaryVisualGoal,
    themeFingerprint: input.direction.themeFingerprint,
    featuredSectionCount: input.direction.featuredSections.length,
    warningCount: input.direction.warningsReviewed.length,
    warningsReviewedCount: input.direction.warningsReviewed.length,
    draftRevision: input.draftRevision,
  };
}

export const visualLessonResponseSchema = z
  .object({
    kind: z.literal("landing-visual-summary"),
    landingPageProjectId: z.string().trim().min(1).max(80),
    visualDirectionVersion: z.literal(VISUAL_DIRECTION_VERSION),
    startingPoint: z.enum(VISUAL_STARTING_POINTS),
    preset: z.enum(THEME_PRESET_IDS).optional(),
    primaryVisualGoal: z.enum(VISUAL_GOALS),
    themeFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    featuredSectionCount: z.number().int().min(0).max(LANDING_PAGE_LIMITS.maxSections),
    warningCount: z.number().int().min(0).max(VISUAL_HIERARCHY_WARNINGS.length),
    warningsReviewedCount: z.number().int().min(0).max(VISUAL_HIERARCHY_WARNINGS.length),
    draftRevision: z.number().int().min(1),
  })
  .strict();

export function visualUserMessage(code: string): string {
  if (code === "LANDING_PAGE_THEME_CONTRAST") return "Esse contraste pode dificultar a leitura.";
  if (code === "LANDING_PAGE_DRAFT_CONFLICT") return "Esta página foi alterada em outro lugar. Atualize antes de salvar novamente.";
  if (code === "LANDING_PAGE_VISUAL_REVIEW") return "A revisão visual mudou. Confira os avisos antes de salvar.";
  if (code === "NOT_FOUND") return "Página não encontrada.";
  return "Não foi possível salvar agora.";
}

export const VISUAL_COPY_HINT = "Você terá uma experiência melhor depois de preparar os textos principais na Aula 7.";
export const VISUAL_STRUCTURE_CTA = "Monte a estrutura da sua landing page";
export const VISUAL_STRUCTURE_HREF = "/aulas/organize-as-secoes-da-pagina";
export const VISUAL_CRITICAL_MESSAGE = "Esse contraste pode dificultar a leitura.";
