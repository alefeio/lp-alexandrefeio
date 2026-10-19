import { z } from "zod";
import {
  ACTION_PRIORITIES,
  ACTION_READINESS,
  ACTION_TYPES,
  isCoherentDecision,
  planNextCampaignAction,
  type ActionContext,
  type ActionType,
  type NextActionPlan,
} from "@/lib/campaign-data/next-action";
import { BOTTLENECKS, EVIDENCE_CODES, EVIDENCE_STRENGTHS } from "@/lib/campaign-data/diagnosis";
import { DIMENSIONS } from "@/lib/campaign-data/types";
import { OBSERVATION_DAYS } from "@/lib/learning/campaign-brief";
import { campaignDiagnosisSchema, type CampaignDiagnosisResult } from "@/lib/learning/campaign-diagnosis";

export const NEXT_ACTION_RESULT_TITLE = "Plano de próxima ação";

const actionOptionSchema = z.object({
  actionType: z.enum(ACTION_TYPES),
  priority: z.enum(ACTION_PRIORITIES),
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(800),
});

export const campaignNextActionSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1),
  campaignDataImportId: z.string().min(1),
  diagnosisResultId: z.string().nullable(),
  primaryBottleneck: z.enum(BOTTLENECKS),
  evidenceStrength: z.enum(EVIDENCE_STRENGTHS),
  systemRecommendation: z.object({
    actionType: z.enum(ACTION_TYPES),
    priority: z.enum(ACTION_PRIORITIES),
    title: z.string().min(1).max(200),
    reason: z.string().min(1).max(800),
  }),
  userDecision: z.object({
    actionType: z.enum(ACTION_TYPES),
    title: z.string().min(1).max(200),
  }),
  hypothesis: z.string().max(500).nullable(),
  preconditions: z.array(z.string().max(300)).max(10),
  observationPlan: z.object({
    whatToObserve: z.array(z.string().max(300)).max(10),
    reviewDate: z.string().nullable(),
    reviewCondition: z.string().max(400).nullable(),
    suggestedReviewDays: z.union([z.literal(7), z.literal(14), z.literal(21), z.literal(30)]).nullable(),
    doNotChange: z.array(z.string().max(300)).max(10),
  }),
  evidenceRefs: z.array(z.object({
    code: z.enum(EVIDENCE_CODES),
    strength: z.enum(EVIDENCE_STRENGTHS),
    dimension: z.enum(DIMENSIONS).nullable(),
    entity: z.string().nullable(),
  })).max(8),
  alternatives: z.array(actionOptionSchema).max(3),
  caveats: z.array(z.string().max(300)).max(20),
  readiness: z.enum(ACTION_READINESS),
  lessonSlug: z.string().nullable(),
  taskId: z.string().nullable(),
  reminderId: z.string().nullable(),
  recommendationId: z.string().nullable(),
  overrideWarned: z.boolean(),
});

export type CampaignNextActionResult = z.infer<typeof campaignNextActionSchema>;

export function nextActionProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && campaignNextActionSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export function preferredDiagnosisImportId(ids: readonly string[]): string | null {
  return ids.length === 1 ? ids[0] : null;
}

export function buildNextActionResult(input: {
  projectId: string;
  campaignDataImportId: string;
  diagnosisResultId: string | null;
  diagnosis: CampaignDiagnosisResult;
  context?: ActionContext;
  userDecision?: { actionType: ActionType; title: string } | null;
  reviewDate?: string | null;
  taskId?: string | null;
  reminderId?: string | null;
  recommendationId?: string | null;
}): CampaignNextActionResult {
  if (input.diagnosis.projectId !== input.projectId || input.diagnosis.campaignDataImportId !== input.campaignDataImportId) {
    throw new Error("Diagnóstico e plano precisam do mesmo projeto e do mesmo arquivo.");
  }
  const plan = planNextCampaignAction(input.diagnosis, input.context);
  const userDecision = input.userDecision ?? {
    actionType: plan.actionType,
    title: plan.title,
  };
  const overrideWarned = !isCoherentDecision(plan, userDecision.actionType);
  return campaignNextActionSchema.parse({
    version: 1,
    projectId: input.projectId,
    campaignDataImportId: input.campaignDataImportId,
    diagnosisResultId: input.diagnosisResultId,
    primaryBottleneck: input.diagnosis.primaryBottleneck,
    evidenceStrength: input.diagnosis.evidenceStrength,
    systemRecommendation: {
      actionType: plan.actionType,
      priority: plan.priority,
      title: plan.title,
      reason: plan.reason,
    },
    userDecision,
    hypothesis: plan.hypothesis,
    preconditions: plan.preconditions,
    observationPlan: {
      whatToObserve: plan.observationPlan.whatToObserve,
      reviewDate: input.reviewDate ?? null,
      reviewCondition: plan.observationPlan.reviewCondition,
      suggestedReviewDays: plan.observationPlan.suggestedReviewDays,
      doNotChange: plan.observationPlan.doNotChange,
    },
    evidenceRefs: plan.evidenceRefs,
    alternatives: plan.alternatives,
    caveats: plan.caveats,
    readiness: plan.readiness,
    lessonSlug: plan.lessonSlug,
    taskId: input.taskId ?? null,
    reminderId: input.reminderId ?? null,
    recommendationId: input.recommendationId ?? null,
    overrideWarned,
  });
}

export function planFromDiagnosis(diagnosis: CampaignDiagnosisResult, context: ActionContext = {}): NextActionPlan {
  return planNextCampaignAction(campaignDiagnosisSchema.parse(diagnosis), context);
}

export function observationDaysFromBrief(payload: unknown): (typeof OBSERVATION_DAYS)[number] | null {
  if (!payload || typeof payload !== "object") return null;
  const value = "initialObservationDays" in payload ? payload.initialObservationDays : null;
  if (value === 7 || value === 14 || value === 21 || value === 30) return value;
  return null;
}

export function decisionChoices(plan: NextActionPlan): Array<{ actionType: ActionType; title: string; reason: string; system: boolean }> {
  return [
    { actionType: plan.actionType, title: plan.title, reason: plan.reason, system: true },
    ...plan.alternatives.map((item) => ({ actionType: item.actionType, title: item.title, reason: item.reason, system: false })),
    plan.actionType === "WAIT"
      ? null
      : { actionType: "WAIT" as const, title: "Vou aguardar e revisar depois", reason: "Registrar espera mesmo quando o sistema sugeriu outra ação coerente.", system: false },
  ].filter((item): item is { actionType: ActionType; title: string; reason: string; system: boolean } => Boolean(item));
}
