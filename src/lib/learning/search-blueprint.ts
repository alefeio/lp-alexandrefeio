import { z } from "zod";
import { dailyBudgetReferenceCents } from "@/lib/learning/campaign-brief";
import { destinationUrlError, normalizeDestinationUrl } from "@/lib/learning/destination-plan";
import { DESTINATION_TYPES, PROJECT_OBJECTIVES, parseMoneyToCents } from "@/lib/project/schema";

export const OPTIMIZATION_FOCUSES = ["CONVERSIONS", "TRAFFIC", "UNDECIDED"] as const;
export const BRAND_STRATEGIES = ["SEPARATE", "INCLUDE", "NOT_APPLICABLE", "UNDECIDED"] as const;
export const SEARCH_PARTNER_DECISIONS = ["INCLUDE", "EXCLUDE", "UNDECIDED"] as const;
export const BLUEPRINT_READINESS = ["READY_FOR_KEYWORDS", "NEEDS_PREPARATION"] as const;

export const KEYWORDS_LESSON_SLUG = "palavras-chave-com-intencao";

export const OPTIMIZATION_FOCUS_LABEL: Record<(typeof OPTIMIZATION_FOCUSES)[number], string> = {
  CONVERSIONS: "Conversões",
  TRAFFIC: "Tráfego/cliques para aprendizado inicial",
  UNDECIDED: "Ainda preciso decidir",
};

export const BRAND_STRATEGY_LABEL: Record<(typeof BRAND_STRATEGIES)[number], string> = {
  SEPARATE: "Tratar buscas da marca separadamente",
  INCLUDE: "Incluir a marca nesta campanha",
  NOT_APPLICABLE: "Não se aplica",
  UNDECIDED: "Ainda preciso decidir",
};

export const SEARCH_PARTNER_LABEL: Record<(typeof SEARCH_PARTNER_DECISIONS)[number], string> = {
  INCLUDE: "Incluir parceiros de pesquisa",
  EXCLUDE: "Não incluir parceiros de pesquisa",
  UNDECIDED: "Ainda preciso decidir",
};

const adGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    theme: z.string().trim().min(1).max(200),
    intent: z.string().trim().min(1).max(300),
  })
  .strict();

export const searchBlueprintSchema = z
  .object({
    campaignName: z.string().trim().min(1).max(120),
    offer: z.string().trim().min(1).max(200),
    businessObjective: z.enum(PROJECT_OBJECTIVES),
    primaryConversion: z.string().trim().min(1).max(200),
    destinationType: z.enum(DESTINATION_TYPES),
    destinationUrl: z.string().trim().max(300).optional(),
    locationPlan: z.string().trim().min(1).max(300),
    languagePlan: z.string().trim().min(1).max(80).optional(),
    monthlyBudgetCents: z.number().int().positive().max(1_000_000_000).optional(),
    dailyBudgetReferenceCents: z.number().int().min(0).max(1_000_000_000).optional(),
    optimizationFocus: z.enum(OPTIMIZATION_FOCUSES),
    brandStrategy: z.enum(BRAND_STRATEGIES),
    searchPartnersDecision: z.enum(SEARCH_PARTNER_DECISIONS),
    adGroups: z.array(adGroupSchema).min(1).max(6),
    preLaunchIssue: z.string().trim().min(1).max(500).optional(),
    readinessStatus: z.enum(BLUEPRINT_READINESS),
  })
  .strict();

export type SearchBlueprint = z.infer<typeof searchBlueprintSchema>;
export type SearchAdGroup = SearchBlueprint["adGroups"][number];

export function blueprintReadiness(input: {
  businessObjective: string;
  destinationType: string;
  monthlyBudgetCents?: number;
  preLaunchIssue?: string;
}): { status: "READY_FOR_KEYWORDS" | "NEEDS_PREPARATION"; issues: string[] } {
  const issues: string[] = [];
  if (input.businessObjective === "UNDEFINED") issues.push("O objetivo da campanha ainda não foi definido.");
  if (input.destinationType === "UNDEFINED") issues.push("O destino ainda não foi definido.");
  if (input.monthlyBudgetCents == null) issues.push("O orçamento ainda não foi definido.");
  const note = input.preLaunchIssue?.trim();
  if (note) issues.push(note);
  return { status: issues.length > 0 ? "NEEDS_PREPARATION" : "READY_FOR_KEYWORDS", issues };
}

const formSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  campaignName: z.string().trim().min(1).max(120),
  offer: z.string().trim().min(1).max(200),
  businessObjective: z.enum(PROJECT_OBJECTIVES),
  primaryConversion: z.string().trim().min(1).max(200),
  destinationType: z.enum(DESTINATION_TYPES),
  destinationUrl: z.string().trim().max(300),
  locationPlan: z.string().trim().min(1).max(300),
  languagePlan: z.string().trim().max(80),
  monthlyBudget: z.string().trim().max(20),
  optimizationFocus: z.enum(OPTIMIZATION_FOCUSES),
  brandStrategy: z.enum(BRAND_STRATEGIES),
  searchPartnersDecision: z.enum(SEARCH_PARTNER_DECISIONS),
  adGroups: z.array(adGroupSchema).min(1).max(6),
  preLaunchIssue: z.string().trim().max(500),
});

export type SearchBlueprintFormInput = {
  projectId: string;
  campaignName: string;
  offer: string;
  businessObjective: string;
  primaryConversion: string;
  destinationType: string;
  destinationUrl: string;
  locationPlan: string;
  languagePlan: string;
  monthlyBudget: string;
  optimizationFocus: string;
  brandStrategy: string;
  searchPartnersDecision: string;
  adGroups: Array<{ name: string; theme: string; intent: string }>;
  preLaunchIssue: string;
};

export function parseSearchBlueprintForm(
  input: SearchBlueprintFormInput,
): { ok: true; projectId: string; blueprint: SearchBlueprint } | { ok: false; message: string } {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    if (input.adGroups.length > 6) return { ok: false, message: "Use no máximo 6 grupos de anúncios nesta etapa." };
    if (input.adGroups.length < 1) return { ok: false, message: "Adicione pelo menos um grupo de anúncios." };
    return { ok: false, message: "Revise os campos do Blueprint." };
  }
  const urlError = destinationUrlError(parsed.data.destinationType, parsed.data.destinationUrl);
  if (urlError) return { ok: false, message: urlError };
  const money = parseMoneyToCents(parsed.data.monthlyBudget);
  if (money === "invalid") return { ok: false, message: "Informe o orçamento mensal em reais." };
  const note = parsed.data.preLaunchIssue.trim();
  const language = parsed.data.languagePlan.trim();
  const readiness = blueprintReadiness({
    businessObjective: parsed.data.businessObjective,
    destinationType: parsed.data.destinationType,
    monthlyBudgetCents: money ?? undefined,
    preLaunchIssue: note || undefined,
  });
  const blueprint: SearchBlueprint = {
    campaignName: parsed.data.campaignName,
    offer: parsed.data.offer,
    businessObjective: parsed.data.businessObjective,
    primaryConversion: parsed.data.primaryConversion,
    destinationType: parsed.data.destinationType,
    destinationUrl: parsed.data.destinationUrl.trim() ? normalizeDestinationUrl(parsed.data.destinationUrl) : undefined,
    locationPlan: parsed.data.locationPlan,
    languagePlan: language || undefined,
    monthlyBudgetCents: money ?? undefined,
    dailyBudgetReferenceCents: money == null ? undefined : dailyBudgetReferenceCents(money),
    optimizationFocus: parsed.data.optimizationFocus,
    brandStrategy: parsed.data.brandStrategy,
    searchPartnersDecision: parsed.data.searchPartnersDecision,
    adGroups: parsed.data.adGroups,
    preLaunchIssue: note || undefined,
    readinessStatus: readiness.status,
  };
  const checked = searchBlueprintSchema.safeParse(blueprint);
  if (!checked.success) return { ok: false, message: "Revise os campos do Blueprint." };
  return { ok: true, projectId: parsed.data.projectId, blueprint: checked.data };
}

export function blueprintProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && searchBlueprintSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}
