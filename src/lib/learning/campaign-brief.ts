import { z } from "zod";
import { DESTINATION_TYPES, PROJECT_OBJECTIVES, parseMoneyToCents } from "@/lib/project/schema";

export const OBSERVATION_DAYS = [7, 14, 21, 30] as const;
export type ObservationDays = (typeof OBSERVATION_DAYS)[number];

export const DAILY_BUDGET_NOTE =
  "Valor aproximado para distribuir o orçamento mensal ao longo de 30 dias. A plataforma de anúncios pode gastar de maneira diferente conforme a configuração da campanha.";

/**
 * Referência diária em centavos.
 * Regra: arredondamento half-up de monthlyBudgetCents / 30,
 * em inteiros: floor((centavos + 15) / 30).
 * R$ 600,00 (60000) vira R$ 20,00 (2000). Não é o gasto diário da plataforma.
 */
export function dailyBudgetReferenceCents(monthlyBudgetCents: number): number {
  if (!Number.isInteger(monthlyBudgetCents) || monthlyBudgetCents < 0) return 0;
  return Math.floor((monthlyBudgetCents + 15) / 30);
}

export function centsToReaisInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  if (fraction === 0) return String(whole);
  return `${whole},${String(fraction).padStart(2, "0")}`;
}

export const campaignBriefSchema = z
  .object({
    offer: z.string().trim().min(1).max(160),
    objective: z.enum(PROJECT_OBJECTIVES),
    primaryConversion: z.string().trim().min(1).max(200),
    destination: z.enum(DESTINATION_TYPES),
    monthlyBudgetCents: z.number().int().positive().max(1_000_000_000),
    dailyBudgetReferenceCents: z.number().int().min(0).max(1_000_000_000),
    initialObservationDays: z.union([z.literal(7), z.literal(14), z.literal(21), z.literal(30)]),
    validationBeforeLaunch: z.string().trim().min(1).max(500),
  })
  .strict();

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;

export const campaignBriefLinkSchema = z
  .object({
    projectId: z.string().trim().min(1).max(80),
  })
  .strict();

const formSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  offer: z.string().trim().min(1).max(160),
  objective: z.enum(PROJECT_OBJECTIVES),
  primaryConversion: z.string().trim().min(1).max(200),
  destination: z.enum(DESTINATION_TYPES),
  monthlyBudget: z.string().trim().min(1),
  initialObservationDays: z.union([z.literal(7), z.literal(14), z.literal(21), z.literal(30)]),
  validationBeforeLaunch: z.string().trim().min(1).max(500),
});

export function parseCampaignBriefForm(input: {
  projectId: string;
  offer: string;
  objective: string;
  primaryConversion: string;
  destination: string;
  monthlyBudget: string;
  initialObservationDays: number;
  validationBeforeLaunch: string;
}): { ok: true; projectId: string; brief: CampaignBrief } | { ok: false; message: string } {
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revise os campos do brief." };
  const cents = parseMoneyToCents(parsed.data.monthlyBudget);
  if (cents === "invalid") return { ok: false, message: "Informe o orçamento mensal em reais." };
  if (cents == null || cents <= 0) return { ok: false, message: "O orçamento mensal precisa ser maior que zero." };
  const brief: CampaignBrief = {
    offer: parsed.data.offer,
    objective: parsed.data.objective,
    primaryConversion: parsed.data.primaryConversion,
    destination: parsed.data.destination,
    monthlyBudgetCents: cents,
    dailyBudgetReferenceCents: dailyBudgetReferenceCents(cents),
    initialObservationDays: parsed.data.initialObservationDays,
    validationBeforeLaunch: parsed.data.validationBeforeLaunch,
  };
  const checked = campaignBriefSchema.safeParse(brief);
  if (!checked.success) return { ok: false, message: "Revise os campos do brief." };
  return { ok: true, projectId: parsed.data.projectId, brief: checked.data };
}

export function briefProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && campaignBriefSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}
