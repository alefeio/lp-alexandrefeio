import { z } from "zod";
import type { CampaignBrief } from "@/lib/learning/campaign-brief";
import { destinationUrlError, type DestinationPlan } from "@/lib/learning/destination-plan";
import { formatPriceCents } from "@/lib/learning/money";
import {
  BUSINESS_GOALS,
  BUSINESS_GOAL_LABEL,
  META_OBJECTIVES,
  META_OBJECTIVE_LABEL,
  businessGoalFromBrief,
  personalDataError,
  type BusinessGoal,
  type ChannelHintName,
  type MetaCampaignPlan,
  type MetaObjective,
} from "@/lib/learning/meta-campaign";

/**
 * Fontes consultadas em 19 de outubro de 2026:
 * Meta Business Help Center — About the leads objective (387294348401675);
 * About lead ads with instant form (761812391313386);
 * About ads that click to message (1816962591668838);
 * How to create ads that click to WhatsApp in Ads Manager (447934475640650);
 * Meta for Business — Lead ads (facebook.com/business/ads/ad-objectives/lead-generation).
 */
export const LEAD_PATHS = ["WHATSAPP", "INSTANT_FORM", "WEBSITE", "OTHER_MESSAGING", "OTHER"] as const;
export const CONVERSION_LOCATIONS = [
  "MESSAGE_DESTINATIONS",
  "WHATSAPP",
  "MESSAGING_APPS",
  "INSTANT_FORM",
  "WEBSITE",
  "CALLS",
  "OTHER",
] as const;
export const PERFORMANCE_GOALS = [
  "MAXIMIZE_CONVERSATIONS",
  "LEADS",
  "QUALITY_LEADS",
  "LINK_CLICKS",
  "CONVERSIONS",
  "OTHER",
  "UNCONFIRMED",
] as const;
export const CAPACITY_STATUSES = ["READY", "LIMITED", "NOT_READY"] as const;
export const MEASUREMENT_STAGES = ["LEAD", "QUALIFIED_LEAD", "APPOINTMENT", "PROPOSAL", "SALE", "OTHER"] as const;
export const LEAD_READINESS = ["READY_TO_LAUNCH_LEAD_FLOW", "NEEDS_PREPARATION"] as const;
export const SITE_MEASUREMENT = ["CONFIGURED", "NOT_CONFIGURED", "NOT_SURE"] as const;

export type LeadPath = (typeof LEAD_PATHS)[number];
export type ConversionLocation = (typeof CONVERSION_LOCATIONS)[number];
export type PerformanceGoal = (typeof PERFORMANCE_GOALS)[number];
export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];
export type MeasurementStage = (typeof MEASUREMENT_STAGES)[number];
export type LeadReadiness = (typeof LEAD_READINESS)[number];

export const LEAD_PATH_LABEL: Record<LeadPath, string> = {
  WHATSAPP: "WhatsApp",
  INSTANT_FORM: "Formulário instantâneo",
  WEBSITE: "Site",
  OTHER_MESSAGING: "Outra mensagem",
  OTHER: "Outro caminho",
};

export const CONVERSION_LOCATION_LABEL: Record<ConversionLocation, string> = {
  MESSAGE_DESTINATIONS: "Message destinations",
  WHATSAPP: "WhatsApp",
  MESSAGING_APPS: "Messaging apps",
  INSTANT_FORM: "Instant forms",
  WEBSITE: "Site",
  CALLS: "Ligação",
  OTHER: "Outro local",
};

export const PERFORMANCE_GOAL_LABEL: Record<PerformanceGoal, string> = {
  MAXIMIZE_CONVERSATIONS: "Maximize number of conversations",
  LEADS: "Leads",
  QUALITY_LEADS: "Lead de maior intenção",
  LINK_CLICKS: "Cliques no link",
  CONVERSIONS: "Conversões",
  OTHER: "Outra meta de desempenho",
  UNCONFIRMED: "Ainda não conferi no Ads Manager",
};

export const CAPACITY_LABEL: Record<CapacityStatus, string> = {
  READY: "A operação aguenta o volume",
  LIMITED: "A operação aguenta com limite",
  NOT_READY: "A operação ainda não aguenta",
};

export const STAGE_LABEL: Record<MeasurementStage, string> = {
  LEAD: "Lead ou mensagem",
  QUALIFIED_LEAD: "Lead qualificado",
  APPOINTMENT: "Agendamento",
  PROPOSAL: "Proposta",
  SALE: "Venda",
  OTHER: "Outro resultado",
};

export const LEAD_READINESS_LABEL: Record<LeadReadiness, string> = {
  READY_TO_LAUNCH_LEAD_FLOW: "Pronto para configurar e lançar",
  NEEDS_PREPARATION: "Resolva estas pendências antes de anunciar",
};

export const ADS_MANAGER_CONFIRMATION =
  "Confirme esta combinação no Ads Manager antes de publicar. A disponibilidade muda por objetivo, conta, região e atualização do produto.";

const shortText = z.string().trim().min(1).max(160);
const optionalText = z.string().trim().max(300).optional();

const adSetSchema = z
  .object({
    name: shortText,
    purpose: shortText,
    location: shortText,
    creativeAngle: shortText,
    offerMessage: shortText,
    cta: shortText,
  })
  .strict();

export const leadConversionPlanSchema = z
  .object({
    campaignName: shortText,
    offer: shortText,
    businessGoal: z.enum(BUSINESS_GOALS),
    leadPath: z.enum(LEAD_PATHS),
    platformObjective: z.enum(META_OBJECTIVES),
    conversionLocation: z.enum(CONVERSION_LOCATIONS),
    performanceGoal: z.enum(PERFORMANCE_GOALS),
    confirmedAgainstCurrentMetaUi: z.boolean(),
    destination: shortText,
    leadDefinition: shortText,
    qualifiedLeadDefinition: shortText,
    adSets: z.array(adSetSchema).max(6),
    preservedAdSetCount: z.number().int().min(0).max(8),
    monthlyBudgetCents: z.number().int().positive().max(1_000_000_000).nullable(),
    whatsappReady: z.boolean(),
    initialMessage: z.string().trim().max(300),
    qualificationQuestions: z.array(z.string().trim().min(1).max(160)).max(6),
    responseOwner: z.string().trim().max(80),
    serviceHours: z.string().trim().max(120),
    followUpPlan: z.string().trim().max(240),
    successDefinition: z.string().trim().max(160),
    formPurpose: z.string().trim().max(160),
    formQuestions: z.array(z.string().trim().min(1).max(160)).max(6),
    completionAction: z.string().trim().max(160),
    followUpOwner: z.string().trim().max(80),
    formFollowUpPlan: z.string().trim().max(240),
    privacyNoticeReady: z.boolean(),
    finalUrl: z.string().trim().max(300),
    conversionEvent: z.string().trim().max(120),
    formOrCta: z.string().trim().max(120),
    measurementStatus: z.enum(SITE_MEASUREMENT),
    businessResultTracking: z.string().trim().max(80),
    pathNote: z.string().trim().max(240),
    contactFlow: z
      .object({
        source: shortText,
        initialResponse: shortText,
        qualification: shortText,
        nextStep: shortText,
        followUp: shortText,
        finalOutcome: shortText,
      })
      .strict(),
    operationsPlan: z
      .object({
        responseOwner: z.string().trim().min(1).max(80),
        serviceWindow: z.string().trim().min(1).max(120),
        capacityStatus: z.enum(CAPACITY_STATUSES),
        followUpMethod: z.string().trim().min(1).max(160),
      })
      .strict(),
    measurementStages: z.array(z.enum(MEASUREMENT_STAGES)).max(6),
    creativeAngle: shortText,
    offerMessage: shortText,
    cta: shortText,
    preLaunchIssue: optionalText,
    actionReviewed: z.boolean(),
    platformReviewed: z.boolean(),
    channelReviewed: z.boolean(),
    qualificationReviewed: z.boolean(),
    measurementReviewed: z.boolean(),
    capacityReviewed: z.boolean(),
    readinessStatus: z.enum(LEAD_READINESS),
  })
  .strict();

export type LeadConversionPlan = z.infer<typeof leadConversionPlanSchema>;
export type LeadAdSet = z.infer<typeof adSetSchema>;

export type LeadConversionFormInput = {
  projectId: string;
  campaignName: string;
  offer: string;
  businessGoal: string;
  leadPath: string;
  platformObjective: string;
  conversionLocation: string;
  performanceGoal: string;
  confirmedAgainstCurrentMetaUi: boolean;
  destination: string;
  leadDefinition: string;
  qualifiedLeadDefinition: string;
  adSets: Array<{
    name: string;
    purpose: string;
    location: string;
    creativeAngle: string;
    offerMessage: string;
    cta: string;
  }>;
  preservedAdSetCount: number;
  monthlyBudget: string;
  whatsappReady: boolean;
  initialMessage: string;
  qualificationQuestions: string[];
  responseOwner: string;
  serviceHours: string;
  followUpPlan: string;
  successDefinition: string;
  formPurpose: string;
  formQuestions: string[];
  completionAction: string;
  followUpOwner: string;
  formFollowUpPlan: string;
  privacyNoticeReady: boolean;
  finalUrl: string;
  conversionEvent: string;
  formOrCta: string;
  measurementStatus: string;
  businessResultTracking: string;
  pathNote: string;
  source: string;
  initialResponse: string;
  qualification: string;
  nextStep: string;
  followUp: string;
  finalOutcome: string;
  operationsOwner: string;
  serviceWindow: string;
  capacityStatus: string;
  followUpMethod: string;
  measurementStages: string[];
  creativeAngle: string;
  offerMessage: string;
  cta: string;
  preLaunchIssue: string;
  actionReviewed: boolean;
  platformReviewed: boolean;
  channelReviewed: boolean;
  qualificationReviewed: boolean;
  measurementReviewed: boolean;
  capacityReviewed: boolean;
};

const formSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  campaignName: shortText,
  offer: shortText,
  businessGoal: z.enum(BUSINESS_GOALS),
  leadPath: z.enum(LEAD_PATHS),
  platformObjective: z.enum(META_OBJECTIVES),
  conversionLocation: z.enum(CONVERSION_LOCATIONS),
  performanceGoal: z.enum(PERFORMANCE_GOALS),
  confirmedAgainstCurrentMetaUi: z.boolean(),
  destination: shortText,
  leadDefinition: shortText,
  qualifiedLeadDefinition: shortText,
  adSets: z.array(z.object({
    name: shortText,
    purpose: shortText,
    location: shortText,
    creativeAngle: shortText,
    offerMessage: shortText,
    cta: shortText,
  })).max(6),
  preservedAdSetCount: z.number().int().min(0).max(8),
  monthlyBudget: z.string().trim().max(40),
  whatsappReady: z.boolean(),
  initialMessage: z.string().trim().max(300),
  qualificationQuestions: z.array(z.string().trim().min(1).max(160)).max(6),
  responseOwner: z.string().trim().max(80),
  serviceHours: z.string().trim().max(120),
  followUpPlan: z.string().trim().max(240),
  successDefinition: z.string().trim().max(160),
  formPurpose: z.string().trim().max(160),
  formQuestions: z.array(z.string().trim().min(1).max(160)).max(6),
  completionAction: z.string().trim().max(160),
  followUpOwner: z.string().trim().max(80),
  formFollowUpPlan: z.string().trim().max(240),
  privacyNoticeReady: z.boolean(),
  finalUrl: z.string().trim().max(300),
  conversionEvent: z.string().trim().max(120),
  formOrCta: z.string().trim().max(120),
  measurementStatus: z.enum(SITE_MEASUREMENT),
  businessResultTracking: z.string().trim().max(80),
  pathNote: z.string().trim().max(240),
  source: shortText,
  initialResponse: shortText,
  qualification: shortText,
  nextStep: shortText,
  followUp: shortText,
  finalOutcome: shortText,
  operationsOwner: z.string().trim().min(1).max(80),
  serviceWindow: z.string().trim().min(1).max(120),
  capacityStatus: z.enum(CAPACITY_STATUSES),
  followUpMethod: z.string().trim().min(1).max(160),
  measurementStages: z.array(z.enum(MEASUREMENT_STAGES)).max(6),
  creativeAngle: shortText,
  offerMessage: shortText,
  cta: shortText,
  preLaunchIssue: z.string().trim().max(240),
  actionReviewed: z.boolean(),
  platformReviewed: z.boolean(),
  channelReviewed: z.boolean(),
  qualificationReviewed: z.boolean(),
  measurementReviewed: z.boolean(),
  capacityReviewed: z.boolean(),
});

export function leadConversionIssues(plan: LeadConversionPlan): string[] {
  const issues: string[] = [];
  if (plan.adSets.length === 0) issues.push("O plano precisa de pelo menos um conjunto.");
  if (plan.adSets.some((set) => !set.purpose.trim())) issues.push("Cada conjunto precisa de um propósito.");
  if (plan.preservedAdSetCount > 0 && plan.adSets.length > plan.preservedAdSetCount) {
    issues.push("O plano da aula anterior já tinha uma estrutura. Evite criar conjuntos novos sem um motivo real.");
  }
  if (plan.adSets.length >= 4 && (plan.monthlyBudgetCents ?? 0) > 0) {
    issues.push("Seu orçamento está bastante dividido entre os conjuntos. Considere simplificar.");
  }
  if (!plan.confirmedAgainstCurrentMetaUi || plan.performanceGoal === "UNCONFIRMED" || !plan.platformReviewed) {
    issues.push(ADS_MANAGER_CONFIRMATION);
  }
  if (plan.leadPath === "WHATSAPP") {
    if (!plan.whatsappReady) issues.push("O WhatsApp ainda não está pronto para receber a campanha.");
    if (!plan.initialMessage.trim()) issues.push("Escreva a mensagem inicial da conversa.");
    if (genericOpening(plan.initialMessage)) issues.push("A mensagem inicial ainda está genérica demais para o contexto da oferta.");
    if (plan.qualificationQuestions.length < 1) issues.push("Defina pelo menos uma pergunta de qualificação.");
    if (!plan.responseOwner.trim() || !plan.serviceHours.trim() || !plan.followUpPlan.trim() || !plan.successDefinition.trim()) {
      issues.push("O fluxo de WhatsApp precisa de responsável, horário, retorno e o que conta como sucesso.");
    }
  }
  if (plan.leadPath === "INSTANT_FORM") {
    if (!plan.formPurpose.trim() || plan.formQuestions.length < 1 || !plan.completionAction.trim()) {
      issues.push("O formulário precisa de finalidade, pergunta e o que acontece depois do envio.");
    }
    if (!plan.followUpOwner.trim() || !plan.formFollowUpPlan.trim()) issues.push("O formulário instantâneo precisa de um plano de retorno.");
    if (!plan.privacyNoticeReady) issues.push("O formulário precisa informar a finalidade do dado antes de ir ao ar.");
  }
  if (plan.leadPath === "WEBSITE") {
    if (!plan.finalUrl.trim()) issues.push("O caminho pelo site precisa de um destino.");
    if (!plan.conversionEvent.trim() || !plan.formOrCta.trim()) issues.push("O site precisa de uma ação de conversão visível.");
    if (plan.measurementStatus !== "CONFIGURED" && !tracksBusinessResult(plan.businessResultTracking)) {
      issues.push("Ainda não há como saber se a visita ao site virou o resultado do negócio.");
    }
  }
  if ((plan.leadPath === "OTHER" || plan.leadPath === "OTHER_MESSAGING") && plan.pathNote.trim().length < 8) {
    issues.push("Descreva como esse caminho vira um contato útil.");
  }
  if (plan.qualificationQuestions.length > 5 || plan.formQuestions.length > 5) {
    issues.push("Mais de cinco perguntas vira interrogatório. Fique com o que ajuda a atender.");
  }
  if (plan.measurementStages.length === 0) issues.push("Escolha pelo menos um estágio que o negócio consegue registrar.");
  if (!plan.operationsPlan.responseOwner.trim()) issues.push("Defina quem atende o contato.");
  if (plan.operationsPlan.capacityStatus === "NOT_READY") issues.push("A operação ainda não suporta o volume esperado.");
  if (plan.preLaunchIssue?.trim()) issues.push(plan.preLaunchIssue.trim());
  if (!plan.actionReviewed || !plan.channelReviewed || !plan.qualificationReviewed || !plan.measurementReviewed || !plan.capacityReviewed) {
    issues.push("A revisão final do fluxo ainda não foi concluída.");
  }
  return issues;
}

export function leadConversionReadiness(plan: Omit<LeadConversionPlan, "readinessStatus">): LeadReadiness {
  return leadConversionIssues({ ...plan, readinessStatus: "NEEDS_PREPARATION" }).length === 0
    ? "READY_TO_LAUNCH_LEAD_FLOW"
    : "NEEDS_PREPARATION";
}

export function parseLeadConversionForm(input: LeadConversionFormInput): { ok: true; projectId: string; plan: LeadConversionPlan } | { ok: false; message: string } {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revise os campos do plano." };
  const collected = [
    parsed.data.campaignName,
    parsed.data.offer,
    parsed.data.destination,
    parsed.data.leadDefinition,
    parsed.data.qualifiedLeadDefinition,
    parsed.data.initialMessage,
    parsed.data.responseOwner,
    parsed.data.followUpPlan,
    parsed.data.successDefinition,
    parsed.data.formPurpose,
    parsed.data.completionAction,
    parsed.data.followUpOwner,
    parsed.data.formFollowUpPlan,
    parsed.data.finalUrl,
    parsed.data.conversionEvent,
    parsed.data.formOrCta,
    parsed.data.pathNote,
    parsed.data.source,
    parsed.data.initialResponse,
    parsed.data.qualification,
    parsed.data.nextStep,
    parsed.data.followUp,
    parsed.data.finalOutcome,
    parsed.data.operationsOwner,
    parsed.data.serviceWindow,
    parsed.data.followUpMethod,
    parsed.data.creativeAngle,
    parsed.data.offerMessage,
    parsed.data.cta,
    parsed.data.preLaunchIssue,
    ...parsed.data.qualificationQuestions,
    ...parsed.data.formQuestions,
    ...parsed.data.adSets.flatMap((set) => [set.name, set.purpose, set.location, set.creativeAngle, set.offerMessage, set.cta]),
  ].join(" ");
  const privacy = personalDataError(collected);
  if (privacy) return { ok: false, message: privacy };
  if (parsed.data.leadPath === "WEBSITE" && parsed.data.finalUrl.trim()) {
    const urlError = destinationUrlError("WEBSITE", parsed.data.finalUrl);
    if (urlError) return { ok: false, message: urlError };
  }
  const monthlyBudgetCents = parsed.data.monthlyBudget.trim() ? parseReais(parsed.data.monthlyBudget) : null;
  if (parsed.data.monthlyBudget.trim() && monthlyBudgetCents == null) return { ok: false, message: "Informe o orçamento mensal em reais." };
  const draft = {
    campaignName: parsed.data.campaignName,
    offer: parsed.data.offer,
    businessGoal: parsed.data.businessGoal,
    leadPath: parsed.data.leadPath,
    platformObjective: parsed.data.platformObjective,
    conversionLocation: parsed.data.conversionLocation,
    performanceGoal: parsed.data.performanceGoal,
    confirmedAgainstCurrentMetaUi: parsed.data.confirmedAgainstCurrentMetaUi,
    destination: parsed.data.destination,
    leadDefinition: parsed.data.leadDefinition,
    qualifiedLeadDefinition: parsed.data.qualifiedLeadDefinition,
    adSets: parsed.data.adSets,
    preservedAdSetCount: parsed.data.preservedAdSetCount,
    monthlyBudgetCents,
    whatsappReady: parsed.data.whatsappReady,
    initialMessage: parsed.data.initialMessage,
    qualificationQuestions: parsed.data.qualificationQuestions,
    responseOwner: parsed.data.responseOwner,
    serviceHours: parsed.data.serviceHours,
    followUpPlan: parsed.data.followUpPlan,
    successDefinition: parsed.data.successDefinition,
    formPurpose: parsed.data.formPurpose,
    formQuestions: parsed.data.formQuestions,
    completionAction: parsed.data.completionAction,
    followUpOwner: parsed.data.followUpOwner,
    formFollowUpPlan: parsed.data.formFollowUpPlan,
    privacyNoticeReady: parsed.data.privacyNoticeReady,
    finalUrl: parsed.data.finalUrl,
    conversionEvent: parsed.data.conversionEvent,
    formOrCta: parsed.data.formOrCta,
    measurementStatus: parsed.data.measurementStatus,
    businessResultTracking: parsed.data.businessResultTracking,
    pathNote: parsed.data.pathNote,
    contactFlow: {
      source: parsed.data.source,
      initialResponse: parsed.data.initialResponse,
      qualification: parsed.data.qualification,
      nextStep: parsed.data.nextStep,
      followUp: parsed.data.followUp,
      finalOutcome: parsed.data.finalOutcome,
    },
    operationsPlan: {
      responseOwner: parsed.data.operationsOwner,
      serviceWindow: parsed.data.serviceWindow,
      capacityStatus: parsed.data.capacityStatus,
      followUpMethod: parsed.data.followUpMethod,
    },
    measurementStages: parsed.data.measurementStages,
    creativeAngle: parsed.data.creativeAngle,
    offerMessage: parsed.data.offerMessage,
    cta: parsed.data.cta,
    preLaunchIssue: parsed.data.preLaunchIssue.trim() ? parsed.data.preLaunchIssue.trim() : undefined,
    actionReviewed: parsed.data.actionReviewed,
    platformReviewed: parsed.data.platformReviewed,
    channelReviewed: parsed.data.channelReviewed,
    qualificationReviewed: parsed.data.qualificationReviewed,
    measurementReviewed: parsed.data.measurementReviewed,
    capacityReviewed: parsed.data.capacityReviewed,
  };
  const plan: LeadConversionPlan = { ...draft, readinessStatus: leadConversionReadiness(draft) };
  const checked = leadConversionPlanSchema.safeParse(plan);
  if (!checked.success) return { ok: false, message: "Revise os campos do plano." };
  return { ok: true, projectId: parsed.data.projectId, plan: checked.data };
}

export function leadConversionProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && leadConversionPlanSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export type LeadConversionPrefill = {
  campaignName: string;
  offer: string;
  businessGoal: BusinessGoal | "";
  desiredConversion: string;
  platformObjective: MetaObjective | "";
  leadPath: LeadPath | "";
  destination: string;
  monthlyBudgetCents: number | null;
  adSets: LeadConversionFormInput["adSets"];
  preservedAdSetCount: number;
  hasBlueprint: boolean;
  hasDestination: boolean;
  measurementStatus: (typeof SITE_MEASUREMENT)[number];
  businessResultTracking: string;
  channelHint: ChannelHintName | null;
  operationsAttention: boolean;
  finalUrl: string;
  conversionEvent: string;
};

export function buildLeadConversionPrefill(input: {
  projectOffer: string;
  brief: CampaignBrief | null;
  destination: DestinationPlan | null;
  blueprint: MetaCampaignPlan | null;
  channelHint: ChannelHintName | null;
  operationsAttention: boolean;
  saved: LeadConversionPlan | null;
}): LeadConversionPrefill {
  const blueprint = input.blueprint;
  const brief = input.brief;
  const destination = input.destination;
  const saved = input.saved;
  const adSets = saved
    ? saved.adSets
    : (blueprint?.adSets ?? []).slice(0, 6).map((set) => ({
        name: set.name,
        purpose: set.purpose,
        location: set.location,
        creativeAngle: "",
        offerMessage: "",
        cta: "",
      }));
  return {
    campaignName: saved?.campaignName || blueprint?.campaignName || "",
    offer: saved?.offer || blueprint?.offer || brief?.offer || input.projectOffer,
    businessGoal: saved?.businessGoal || blueprint?.businessGoal || (brief ? businessGoalFromBrief(brief.objective) : ""),
    desiredConversion: blueprint?.desiredConversion || brief?.primaryConversion || destination?.primaryConversion || "",
    platformObjective: saved?.platformObjective || blueprint?.metaObjective || "",
    leadPath: saved?.leadPath || leadPathFromBlueprint(blueprint),
    destination: saved?.destination || blueprint?.destination || destinationLabel(destination),
    monthlyBudgetCents: saved?.monthlyBudgetCents ?? blueprint?.monthlyBudgetCents ?? brief?.monthlyBudgetCents ?? null,
    adSets,
    preservedAdSetCount: saved?.preservedAdSetCount ?? blueprint?.adSets.length ?? 0,
    hasBlueprint: Boolean(blueprint),
    hasDestination: Boolean(destination),
    measurementStatus: saved?.measurementStatus || siteMeasurementFrom(destination),
    businessResultTracking: saved?.businessResultTracking || destination?.businessOutcomeMethod || "",
    channelHint: input.channelHint,
    operationsAttention: input.operationsAttention,
    finalUrl: saved?.finalUrl || destination?.destinationUrl || "",
    conversionEvent: saved?.conversionEvent || destination?.primaryConversion || "",
  };
}

export function formatLeadConversionSummary(plan: LeadConversionPlan): string[] {
  const budget = plan.monthlyBudgetCents == null ? "Orçamento ainda não definido." : `Orçamento mensal: ${formatPriceCents(plan.monthlyBudgetCents)}.`;
  const stages = plan.measurementStages.map((stage) => STAGE_LABEL[stage]).join(", ") || "Nenhum estágio registrado.";
  const flow = [
    plan.contactFlow.source,
    plan.contactFlow.initialResponse,
    plan.contactFlow.qualification,
    plan.contactFlow.nextStep,
    plan.contactFlow.followUp,
    plan.contactFlow.finalOutcome,
  ];
  return [
    `Campanha: ${plan.campaignName}`,
    `Caminho: ${LEAD_PATH_LABEL[plan.leadPath]}`,
    `Objetivo Meta: ${META_OBJECTIVE_LABEL[plan.platformObjective]}`,
    `Local da conversão: ${CONVERSION_LOCATION_LABEL[plan.conversionLocation]}`,
    `Meta de desempenho: ${PERFORMANCE_GOAL_LABEL[plan.performanceGoal]}`,
    `O que é um lead: ${plan.leadDefinition}`,
    `Lead qualificado: ${plan.qualifiedLeadDefinition}`,
    "Fluxo de atendimento:",
    ...flow.map((step, index) => `${index + 1}. ${step}`),
    `Mensuração: ${stages}`,
    budget,
    ADS_MANAGER_CONFIRMATION,
  ];
}

function leadPathFromBlueprint(plan: MetaCampaignPlan | null): LeadPath | "" {
  if (!plan) return "";
  if (plan.conversionPath === "INSTANT_FORM") return "INSTANT_FORM";
  if (plan.conversionPath === "WEBSITE") return "WEBSITE";
  if (plan.conversionPath === "MESSAGING") {
    return /whatsapp/i.test(`${plan.destination} ${plan.desiredConversion}`) ? "WHATSAPP" : "OTHER_MESSAGING";
  }
  return "";
}

function destinationLabel(plan: DestinationPlan | null): string {
  if (!plan) return "";
  return plan.destinationUrl?.trim() || plan.primaryCta;
}

function siteMeasurementFrom(plan: DestinationPlan | null): (typeof SITE_MEASUREMENT)[number] {
  if (!plan) return "NOT_SURE";
  if (plan.platformConversionStatus === "CONFIGURED") return "CONFIGURED";
  if (plan.platformConversionStatus === "NOT_CONFIGURED") return "NOT_CONFIGURED";
  return "NOT_SURE";
}

function tracksBusinessResult(value: string): boolean {
  return value.trim().length > 0 && value !== "NONE";
}

function genericOpening(value: string): boolean {
  const text = value.trim().toLowerCase().replace(/[.!]+$/g, "");
  if (!text) return false;
  return ["oi", "olá", "ola", "fale conosco", "clique e fale conosco", "fala comigo"].includes(text);
}

function parseReais(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export { BUSINESS_GOALS, BUSINESS_GOAL_LABEL, META_OBJECTIVES, META_OBJECTIVE_LABEL };
