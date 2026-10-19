import { z } from "zod";
import { dailyBudgetReferenceCents } from "@/lib/learning/campaign-brief";
import type { CampaignBrief } from "@/lib/learning/campaign-brief";
import type { DestinationPlan } from "@/lib/learning/destination-plan";
import { formatPriceCents } from "@/lib/learning/money";

/** Objetivos atuais do Meta Ads Manager. Fonte: Meta Business Help Center, “How to choose the right ad objective”. */
export const META_OBJECTIVES = ["AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEADS", "APP_PROMOTION", "SALES"] as const;
export const BUSINESS_GOALS = [
  "GENERATE_LEADS",
  "GENERATE_SALES",
  "START_CONVERSATIONS",
  "DRIVE_VISITS",
  "BUILD_AWARENESS",
  "PROMOTE_APP",
  "OTHER",
] as const;
export const CONVERSION_PATHS = ["WEBSITE", "MESSAGING", "INSTANT_FORM", "APP", "CALL", "OTHER"] as const;
export const AUDIENCE_APPROACHES = ["AUTOMATED_BROAD", "SIGNAL_GUIDED", "FIRST_PARTY", "LOOKALIKE", "REMARKETING", "CUSTOM"] as const;
export const PLACEMENT_STRATEGIES = ["ADVANTAGE_PLUS", "MANUAL"] as const;
export const PLACEMENT_SURFACES = ["FEED", "STORIES", "REELS", "OTHER"] as const;
export const BUDGET_STRATEGIES = ["CAMPAIGN_LEVEL", "AD_SET_LEVEL", "UNDECIDED"] as const;
export const META_READINESS = ["READY_FOR_META_SETUP", "NEEDS_PREPARATION"] as const;
export const MEASUREMENT_READINESS = ["READY", "NEEDS_WORK", "UNKNOWN"] as const;
export const CHANNEL_HINTS = ["google", "meta", "both", "none"] as const;

export type MetaObjective = (typeof META_OBJECTIVES)[number];
export type BusinessGoal = (typeof BUSINESS_GOALS)[number];
export type ConversionPath = (typeof CONVERSION_PATHS)[number];
export type AudienceApproach = (typeof AUDIENCE_APPROACHES)[number];
export type PlacementStrategy = (typeof PLACEMENT_STRATEGIES)[number];
export type BudgetStrategy = (typeof BUDGET_STRATEGIES)[number];
export type MetaReadiness = (typeof META_READINESS)[number];
export type MeasurementReadiness = (typeof MEASUREMENT_READINESS)[number];
export type ChannelHintName = (typeof CHANNEL_HINTS)[number];

export const META_OBJECTIVE_LABEL: Record<MetaObjective, string> = {
  AWARENESS: "Reconhecimento",
  TRAFFIC: "Tráfego",
  ENGAGEMENT: "Engajamento",
  LEADS: "Leads",
  APP_PROMOTION: "Promoção do app",
  SALES: "Vendas",
};

export const BUSINESS_GOAL_LABEL: Record<BusinessGoal, string> = {
  GENERATE_LEADS: "Receber contatos",
  GENERATE_SALES: "Gerar vendas",
  START_CONVERSATIONS: "Começar conversas",
  DRIVE_VISITS: "Levar visitas",
  BUILD_AWARENESS: "Fazer o negócio ser reconhecido",
  PROMOTE_APP: "Promover um aplicativo",
  OTHER: "Outro resultado",
};

export const CONVERSION_PATH_LABEL: Record<ConversionPath, string> = {
  WEBSITE: "Site ou página",
  MESSAGING: "Mensagens",
  INSTANT_FORM: "Formulário instantâneo",
  APP: "Aplicativo",
  CALL: "Ligação",
  OTHER: "Outro caminho",
};

export const AUDIENCE_APPROACH_LABEL: Record<AudienceApproach, string> = {
  AUTOMATED_BROAD: "Amplo, com Advantage+ audience",
  SIGNAL_GUIDED: "Com sinais de sugestão",
  FIRST_PARTY: "Pessoas que já se relacionaram com o negócio",
  LOOKALIKE: "Semelhante a uma fonte",
  REMARKETING: "Quem já interagiu",
  CUSTOM: "Outra lógica",
};

export const PLACEMENT_STRATEGY_LABEL: Record<PlacementStrategy, string> = {
  ADVANTAGE_PLUS: "Advantage+ placements",
  MANUAL: "Posicionamentos manuais",
};

export const PLACEMENT_SURFACE_LABEL: Record<(typeof PLACEMENT_SURFACES)[number], string> = {
  FEED: "Feed",
  STORIES: "Stories",
  REELS: "Reels",
  OTHER: "Outra superfície",
};

export const BUDGET_STRATEGY_LABEL: Record<BudgetStrategy, string> = {
  CAMPAIGN_LEVEL: "Orçamento da campanha",
  AD_SET_LEVEL: "Orçamento do conjunto",
  UNDECIDED: "Ainda não decidido",
};

export const META_READINESS_LABEL: Record<MetaReadiness, string> = {
  READY_FOR_META_SETUP: "Pronto para configurar a campanha",
  NEEDS_PREPARATION: "Resolva estas pendências antes de configurar",
};

export const CONVERSION_PATH_NOTICE =
  "O caminho da conversão é a intenção do plano. A disponibilidade real depende do objetivo e da configuração no Ads Manager. A próxima aula aprofunda leads e WhatsApp.";

export const FRAGMENTATION_NOTICE = "Seu orçamento está bastante dividido entre os conjuntos. Considere simplificar.";

const shortText = z.string().trim().min(1).max(160);
const optionalText = z.string().trim().max(240).optional();

const adSetSchema = z
  .object({
    name: shortText,
    purpose: shortText,
    audienceApproaches: z.array(z.enum(AUDIENCE_APPROACHES)).min(1).max(4),
    location: shortText,
    minimumAge: z.number().int().min(13).max(65).nullable(),
    ageNotes: optionalText,
    language: optionalText,
    audienceSuggestions: z.array(z.string().trim().min(1).max(80)).max(10),
    customAudienceStrategy: optionalText,
    lookalikeStrategy: optionalText,
    exclusions: z.array(z.string().trim().min(1).max(120)).max(8),
    placementStrategy: z.enum(PLACEMENT_STRATEGIES),
    manualPlacementReason: optionalText,
    surfaces: z.array(z.enum(PLACEMENT_SURFACES)).max(4),
    optimizationIntent: shortText,
    budgetAllocation: optionalText,
  })
  .strict();

export const metaCampaignPlanSchema = z
  .object({
    campaignName: shortText,
    offer: shortText,
    businessGoal: z.enum(BUSINESS_GOALS),
    businessGoalDetail: optionalText,
    desiredConversion: shortText,
    metaObjective: z.enum(META_OBJECTIVES),
    conversionPath: z.enum(CONVERSION_PATHS),
    destination: shortText,
    monthlyBudgetCents: z.number().int().positive().max(1_000_000_000),
    budgetStrategy: z.enum(BUDGET_STRATEGIES),
    adSets: z.array(adSetSchema).max(8),
    measurementReadiness: z.enum(MEASUREMENT_READINESS),
    preLaunchIssue: optionalText,
    representsOffer: z.boolean(),
    audienceLogicReviewed: z.boolean(),
    placementsAndBudgetReviewed: z.boolean(),
    claimsReviewed: z.boolean(),
    readinessStatus: z.enum(META_READINESS),
  })
  .strict();

export type MetaAdSet = z.infer<typeof adSetSchema>;
export type MetaCampaignPlan = z.infer<typeof metaCampaignPlanSchema>;

export type MetaCampaignFormInput = {
  projectId: string;
  campaignName: string;
  offer: string;
  businessGoal: string;
  businessGoalDetail: string;
  desiredConversion: string;
  metaObjective: string;
  conversionPath: string;
  destination: string;
  monthlyBudget: string;
  budgetStrategy: string;
  adSets: Array<{
    name: string;
    purpose: string;
    audienceApproaches: string[];
    location: string;
    minimumAge: string;
    ageNotes: string;
    language: string;
    audienceSuggestions: string[];
    customAudienceStrategy: string;
    lookalikeStrategy: string;
    exclusions: string[];
    placementStrategy: string;
    manualPlacementReason: string;
    surfaces: string[];
    optimizationIntent: string;
    budgetAllocation: string;
  }>;
  preLaunchIssue: string;
  representsOffer: boolean;
  audienceLogicReviewed: boolean;
  placementsAndBudgetReviewed: boolean;
  claimsReviewed: boolean;
};

export type MetaCampaignContext = {
  measurementReadiness?: MeasurementReadiness;
};

const formSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  campaignName: shortText,
  offer: shortText,
  businessGoal: z.enum(BUSINESS_GOALS),
  businessGoalDetail: z.string().trim().max(240),
  desiredConversion: shortText,
  metaObjective: z.enum(META_OBJECTIVES),
  conversionPath: z.enum(CONVERSION_PATHS),
  destination: shortText,
  monthlyBudget: z.string().trim().min(1).max(40),
  budgetStrategy: z.enum(BUDGET_STRATEGIES),
  adSets: z
    .array(
      z.object({
        name: shortText,
        purpose: shortText,
        audienceApproaches: z.array(z.enum(AUDIENCE_APPROACHES)).min(1).max(4),
        location: shortText,
        minimumAge: z.string().trim().max(3),
        ageNotes: z.string().trim().max(240),
        language: z.string().trim().max(80),
        audienceSuggestions: z.array(z.string().trim().min(1).max(80)).max(10),
        customAudienceStrategy: z.string().trim().max(240),
        lookalikeStrategy: z.string().trim().max(240),
        exclusions: z.array(z.string().trim().min(1).max(120)).max(8),
        placementStrategy: z.enum(PLACEMENT_STRATEGIES),
        manualPlacementReason: z.string().trim().max(240),
        surfaces: z.array(z.enum(PLACEMENT_SURFACES)).max(4),
        optimizationIntent: shortText,
        budgetAllocation: z.string().trim().max(160),
      }),
    )
    .max(8),
  preLaunchIssue: z.string().trim().max(240),
  representsOffer: z.boolean(),
  audienceLogicReviewed: z.boolean(),
  placementsAndBudgetReviewed: z.boolean(),
  claimsReviewed: z.boolean(),
});

export function personalDataError(value: string): string | null {
  if (/@/.test(value) || /\bcpf\b/i.test(value) || /\d{10,}/.test(value)) {
    return "Não informe dados de clientes, telefone, e-mail ou documento.";
  }
  return null;
}

export function objectiveConflict(input: {
  businessGoal: BusinessGoal;
  metaObjective: MetaObjective;
  desiredConversion: string;
}): string | null {
  const commercialGoal = input.businessGoal === "GENERATE_SALES" || input.businessGoal === "GENERATE_LEADS";
  if (input.metaObjective === "TRAFFIC" && commercialGoal) {
    return "Tráfego otimiza visita. O resultado que você descreveu é comercial.";
  }
  if (input.metaObjective === "AWARENESS" && (commercialGoal || input.businessGoal === "START_CONVERSATIONS" || input.businessGoal === "PROMOTE_APP")) {
    return "Reconhecimento não procura o contato, a venda ou a conversa que você descreveu.";
  }
  if (input.metaObjective === "APP_PROMOTION" && input.businessGoal !== "PROMOTE_APP") {
    return "Promoção do app só combina quando o resultado acontece dentro de um aplicativo.";
  }
  if (input.metaObjective === "SALES" && (input.businessGoal === "BUILD_AWARENESS" || input.businessGoal === "DRIVE_VISITS")) {
    return "Vendas pede um resultado comercial mensurável, não só reconhecimento ou visita.";
  }
  const desired = input.desiredConversion.toLocaleLowerCase("pt-BR");
  const wantsCommercial = /compra|venda|lead|orçamento|orcamento|cadastro/.test(desired);
  if (input.metaObjective === "AWARENESS" && wantsCommercial) {
    return "Reconhecimento não otimiza o resultado comercial descrito na conversão.";
  }
  if (input.metaObjective === "TRAFFIC" && wantsCommercial) {
    return "Tráfego otimiza a visita, e a conversão descrita é comercial.";
  }
  return null;
}

export function metaCampaignIssues(plan: Omit<MetaCampaignPlan, "readinessStatus">): string[] {
  const issues: string[] = [];
  const conflict = objectiveConflict(plan);
  if (conflict) issues.push(conflict);
  if (plan.adSets.length === 0) issues.push("Inclua pelo menos um conjunto de anúncios.");
  if (plan.adSets.length >= 4 && plan.monthlyBudgetCents > 0) issues.push(FRAGMENTATION_NOTICE);
  if (plan.budgetStrategy === "UNDECIDED") issues.push("Decida se o orçamento fica na campanha ou no conjunto.");
  if (/^(javascript|data|vbscript):/i.test(plan.destination)) issues.push("Esse destino não pode ser usado.");
  for (const set of plan.adSets) {
    if (!set.purpose.trim()) issues.push(`O conjunto ${set.name} precisa de um propósito.`);
    if (!set.location.trim()) issues.push(`O conjunto ${set.name} precisa da área atendida.`);
    if (set.audienceApproaches.length === 0) issues.push(`O conjunto ${set.name} precisa de uma lógica de público.`);
    if (set.placementStrategy === "MANUAL" && !set.manualPlacementReason?.trim()) {
      issues.push(`O conjunto ${set.name} usa posicionamento manual sem motivo.`);
    }
    if (set.audienceApproaches.includes("FIRST_PARTY") && !set.customAudienceStrategy?.trim()) {
      issues.push(`O conjunto ${set.name} cita audiência própria sem dizer a fonte.`);
    }
    if (set.audienceApproaches.includes("LOOKALIKE") && !set.lookalikeStrategy?.trim()) {
      issues.push(`O conjunto ${set.name} cita audiência semelhante sem dizer a fonte.`);
    }
    if (set.audienceApproaches.includes("REMARKETING") && !set.customAudienceStrategy?.trim() && set.exclusions.length === 0 && !set.audienceSuggestions.length) {
      issues.push(`O conjunto ${set.name} cita remarketing sem uma fonte conceitual.`);
    }
  }
  if (plan.measurementReadiness === "NEEDS_WORK") issues.push("A mensuração ainda não sustenta esta otimização.");
  if (plan.preLaunchIssue?.trim()) issues.push(plan.preLaunchIssue.trim());
  if (!plan.representsOffer) issues.push("Confirme se o plano representa a oferta.");
  if (!plan.audienceLogicReviewed) issues.push("Revise a lógica de público.");
  if (!plan.placementsAndBudgetReviewed) issues.push("Revise posicionamentos e orçamento.");
  if (!plan.claimsReviewed) issues.push("Revise as afirmações do plano.");
  return [...new Set(issues)];
}

export function metaCampaignReadiness(plan: Omit<MetaCampaignPlan, "readinessStatus">): MetaReadiness {
  return metaCampaignIssues(plan).length === 0 ? "READY_FOR_META_SETUP" : "NEEDS_PREPARATION";
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function collectText(input: MetaCampaignFormInput): string[] {
  const values = [
    input.campaignName,
    input.offer,
    input.businessGoalDetail,
    input.desiredConversion,
    input.destination,
    input.preLaunchIssue,
    ...input.adSets.flatMap((set) => [
      set.name,
      set.purpose,
      set.location,
      set.ageNotes,
      set.language,
      set.customAudienceStrategy,
      set.lookalikeStrategy,
      set.manualPlacementReason,
      set.optimizationIntent,
      set.budgetAllocation,
      ...set.audienceSuggestions,
      ...set.exclusions,
    ]),
  ];
  return values;
}

export function parseMetaCampaignForm(
  input: MetaCampaignFormInput,
  context: MetaCampaignContext = {},
): { ok: true; projectId: string; plan: MetaCampaignPlan } | { ok: false; message: string } {
  const personal = collectText(input).map(personalDataError).find((error) => error);
  if (personal) return { ok: false, message: personal };
  if (/^(javascript|data|vbscript):/i.test(input.destination.trim())) {
    return { ok: false, message: "Esse destino não pode ser usado." };
  }
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os campos do plano." };
  const cents = parseReais(parsed.data.monthlyBudget);
  if (cents == null || cents <= 0) return { ok: false, message: "Informe o orçamento mensal em reais." };
  const adSets: MetaAdSet[] = [];
  for (const set of parsed.data.adSets) {
    const age = set.minimumAge.trim();
    let minimumAge: number | null = null;
    if (age) {
      if (!/^\d{2}$/.test(age)) return { ok: false, message: "A idade mínima precisa ser um número entre 13 e 65." };
      minimumAge = Number(age);
      if (minimumAge < 13 || minimumAge > 65) return { ok: false, message: "A idade mínima precisa ficar entre 13 e 65." };
    }
    adSets.push({
      name: set.name,
      purpose: set.purpose,
      audienceApproaches: set.audienceApproaches,
      location: set.location,
      minimumAge,
      ageNotes: blankToUndefined(set.ageNotes),
      language: blankToUndefined(set.language),
      audienceSuggestions: set.audienceSuggestions,
      customAudienceStrategy: blankToUndefined(set.customAudienceStrategy),
      lookalikeStrategy: blankToUndefined(set.lookalikeStrategy),
      exclusions: set.exclusions,
      placementStrategy: set.placementStrategy,
      manualPlacementReason: blankToUndefined(set.manualPlacementReason),
      surfaces: set.surfaces,
      optimizationIntent: set.optimizationIntent,
      budgetAllocation: blankToUndefined(set.budgetAllocation),
    });
  }
  const draft = {
    campaignName: parsed.data.campaignName,
    offer: parsed.data.offer,
    businessGoal: parsed.data.businessGoal,
    businessGoalDetail: blankToUndefined(parsed.data.businessGoalDetail),
    desiredConversion: parsed.data.desiredConversion,
    metaObjective: parsed.data.metaObjective,
    conversionPath: parsed.data.conversionPath,
    destination: parsed.data.destination,
    monthlyBudgetCents: cents,
    budgetStrategy: parsed.data.budgetStrategy,
    adSets,
    measurementReadiness: context.measurementReadiness ?? "UNKNOWN",
    preLaunchIssue: blankToUndefined(parsed.data.preLaunchIssue),
    representsOffer: parsed.data.representsOffer,
    audienceLogicReviewed: parsed.data.audienceLogicReviewed,
    placementsAndBudgetReviewed: parsed.data.placementsAndBudgetReviewed,
    claimsReviewed: parsed.data.claimsReviewed,
  };
  const plan: MetaCampaignPlan = { ...draft, readinessStatus: metaCampaignReadiness(draft) };
  const checked = metaCampaignPlanSchema.safeParse(plan);
  if (!checked.success) return { ok: false, message: "Revise os campos do plano." };
  return { ok: true, projectId: parsed.data.projectId, plan: checked.data };
}

function parseReais(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function metaCampaignProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && metaCampaignPlanSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export type MetaCampaignPrefill = {
  campaignName: string;
  offer: string;
  businessGoal: BusinessGoal | "";
  desiredConversion: string;
  destination: string;
  monthlyBudgetCents: number | null;
  dailyBudgetReferenceCents: number | null;
  channelHint: ChannelHintName | null;
  hasBrief: boolean;
  hasDestination: boolean;
  hasDiagnostic: boolean;
  measurementReadiness: MeasurementReadiness;
};

export function measurementFromDestination(plan: DestinationPlan | null): MeasurementReadiness {
  if (!plan) return "UNKNOWN";
  if (plan.readinessStatus === "NEEDS_PREPARATION" || plan.preLaunchIssue || plan.platformConversionStatus === "NOT_CONFIGURED") {
    return "NEEDS_WORK";
  }
  return "READY";
}

export function businessGoalFromBrief(objective: CampaignBrief["objective"]): BusinessGoal | "" {
  if (objective === "LEADS") return "GENERATE_LEADS";
  if (objective === "SALES") return "GENERATE_SALES";
  if (objective === "WHATSAPP") return "START_CONVERSATIONS";
  if (objective === "STORE_VISITS") return "DRIVE_VISITS";
  if (objective === "AWARENESS") return "BUILD_AWARENESS";
  return "";
}

export function destinationLabel(plan: DestinationPlan | null, fallback: string): string {
  if (!plan) return fallback;
  const url = plan.destinationUrl?.trim();
  return url ? `${plan.destinationType} · ${url}` : plan.destinationType;
}

export function buildMetaCampaignPrefill(input: {
  projectOffer: string;
  projectArea: string | null;
  brief: CampaignBrief | null;
  destination: DestinationPlan | null;
  channelHint: ChannelHintName | null;
  saved: MetaCampaignPlan | null;
}): MetaCampaignPrefill {
  const brief = input.brief;
  const monthly = input.saved?.monthlyBudgetCents ?? brief?.monthlyBudgetCents ?? null;
  return {
    campaignName: input.saved?.campaignName ?? "",
    offer: input.saved?.offer || brief?.offer || input.projectOffer || "",
    businessGoal: input.saved?.businessGoal || (brief ? businessGoalFromBrief(brief.objective) : ""),
    desiredConversion: input.saved?.desiredConversion || brief?.primaryConversion || "",
    destination: input.saved?.destination || destinationLabel(input.destination, input.projectArea ?? ""),
    monthlyBudgetCents: monthly,
    dailyBudgetReferenceCents: monthly == null ? null : dailyBudgetReferenceCents(monthly),
    channelHint: input.channelHint,
    hasBrief: Boolean(brief),
    hasDestination: Boolean(input.destination),
    hasDiagnostic: Boolean(input.channelHint),
    measurementReadiness: measurementFromDestination(input.destination),
  };
}

export function formatMetaCampaignSummary(plan: MetaCampaignPlan): string[] {
  const lines = [
    `Campanha: ${plan.campaignName}`,
    `Objetivo do negócio: ${BUSINESS_GOAL_LABEL[plan.businessGoal]}`,
    `Objetivo Meta: ${META_OBJECTIVE_LABEL[plan.metaObjective]}`,
    `Conversão: ${plan.desiredConversion}`,
    `Orçamento: ${formatPriceCents(plan.monthlyBudgetCents)} · ${BUDGET_STRATEGY_LABEL[plan.budgetStrategy]}`,
    "Estrutura:",
  ];
  plan.adSets.forEach((set, index) => {
    lines.push(`Conjunto ${index + 1}: ${set.name}`);
    lines.push(`Público: ${set.audienceApproaches.map((item) => AUDIENCE_APPROACH_LABEL[item]).join(", ")}`);
    lines.push(`Localização: ${set.location}`);
    lines.push(`Sinais: ${set.audienceSuggestions.join(", ") || "nenhum"}`);
    lines.push(`Posicionamentos: ${PLACEMENT_STRATEGY_LABEL[set.placementStrategy]}`);
  });
  lines.push(`Status: ${META_READINESS_LABEL[plan.readinessStatus]}`);
  return lines;
}
