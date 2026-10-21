import { COMPONENT_REGISTRY_V1 } from "@/lib/landing-page/components";
import { LANDING_COMPONENT_TYPES, LANDING_PAGE_LIMITS, type LandingComponentType } from "@/lib/landing-page/constants";
import { WIREFRAME_CONFIDENCE, WIREFRAME_STRATEGIES, type WireframeConfidence, type WireframeStrategy } from "@/lib/landing-page/wireframe/plan";

export const WIREFRAME_CARDINALITY: Record<LandingComponentType, { min: number; max: number }> = {
  HERO: { min: 1, max: 1 },
  PROBLEM: { min: 0, max: 1 },
  SOLUTION: { min: 0, max: 1 },
  BENEFITS: { min: 0, max: 1 },
  PROCESS: { min: 0, max: 1 },
  TRUST: { min: 0, max: 1 },
  PORTFOLIO: { min: 0, max: 1 },
  TESTIMONIALS: { min: 0, max: 1 },
  FAQ: { min: 0, max: 1 },
  FORM: { min: 0, max: 1 },
  CONTACT: { min: 0, max: 1 },
  FOOTER: { min: 1, max: 1 },
  CTA: { min: 0, max: 2 },
};

export const WIREFRAME_REQUIRED_TYPES = ["HERO", "FOOTER"] as const;

export const SECTION_NAMES: Record<LandingComponentType, string> = {
  HERO: "Abertura",
  PROBLEM: "Contexto",
  SOLUTION: "Solução",
  BENEFITS: "Benefícios",
  PROCESS: "Processo",
  TRUST: "Confiança",
  PORTFOLIO: "Portfólio",
  TESTIMONIALS: "Depoimentos",
  FAQ: "Dúvidas",
  FORM: "Formulário",
  CTA: "Convite para ação",
  CONTACT: "Contato",
  FOOTER: "Rodapé",
};

export const DEFAULT_SECTION_VARIANT: Record<LandingComponentType, string> = {
  HERO: "default",
  PROBLEM: "default",
  SOLUTION: "default",
  BENEFITS: "grid",
  PROCESS: "numbered",
  TRUST: "default",
  PORTFOLIO: "default",
  TESTIMONIALS: "default",
  FAQ: "default",
  CTA: "banner",
  FORM: "default",
  CONTACT: "default",
  FOOTER: "default",
};

export const STRATEGY_LABELS: Record<WireframeStrategy, string> = {
  FOCUSED: "Estrutura enxuta para uma decisão simples",
  EXPLANATORY: "Estrutura para explicar a decisão",
  TRUST_HEAVY: "Estrutura focada em confiança",
  CONVERSATIONAL: "Estrutura para uma conversa",
  BALANCED: "Estrutura equilibrada para este cenário",
};

export const CONFIDENCE_LABELS: Record<WireframeConfidence, string> = {
  STRONG: "Temos informações suficientes para uma recomendação consistente.",
  MODERATE: "Algumas decisões ainda podem ser refinadas.",
  LIMITED: "A estrutura é inicial porque ainda faltam informações.",
};

export const PARTIAL_STRUCTURE_WARNING =
  "Algumas decisões ainda estão incompletas. A estrutura abaixo é uma recomendação inicial.";

export function strategyLabel(strategy: WireframeStrategy): string {
  return STRATEGY_LABELS[strategy];
}

export function confidenceLabel(confidence: WireframeConfidence): string {
  return CONFIDENCE_LABELS[confidence];
}

export function variantAllowed(type: LandingComponentType, variant: string): boolean {
  return (COMPONENT_REGISTRY_V1[type].variants as readonly string[]).includes(variant);
}

export function hasActionPath(types: readonly LandingComponentType[]): boolean {
  return types.includes("HERO") || types.includes("CTA") || types.includes("FORM");
}

export function cardinalityAllows(types: readonly LandingComponentType[], next?: LandingComponentType): boolean {
  const counts = new Map<LandingComponentType, number>();
  for (const type of LANDING_COMPONENT_TYPES) counts.set(type, 0);
  for (const type of types) counts.set(type, (counts.get(type) ?? 0) + 1);
  if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  if (types.length + (next ? 1 : 0) > LANDING_PAGE_LIMITS.maxSections) return false;
  for (const type of LANDING_COMPONENT_TYPES) {
    const count = counts.get(type) ?? 0;
    if (count > WIREFRAME_CARDINALITY[type].max) return false;
    if (!next && count < WIREFRAME_CARDINALITY[type].min) return false;
  }
  return true;
}

export function availableSectionTypes(types: readonly LandingComponentType[]): LandingComponentType[] {
  return LANDING_COMPONENT_TYPES.filter((type) => cardinalityAllows(types, type));
}

export const WIREFRAME_STRATEGY_VALUES = WIREFRAME_STRATEGIES;
export const WIREFRAME_CONFIDENCE_VALUES = WIREFRAME_CONFIDENCE;
