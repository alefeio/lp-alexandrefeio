import { z } from "zod";
import type { SearchBlueprint } from "@/lib/learning/search-blueprint";

export const MATCH_TYPES = ["BROAD", "PHRASE", "EXACT"] as const;
export const KEYWORD_INTENTS = ["HIGH", "MEDIUM", "LOW", "EXCLUDE"] as const;
export const KEYWORD_DECISIONS = ["USE", "TEST_LATER", "EXCLUDE"] as const;
export const NEGATIVE_SCOPES = ["CAMPAIGN", "AD_GROUP"] as const;
export const KEYWORD_READINESS = ["READY_FOR_ADS", "NEEDS_REFINEMENT"] as const;

export const MATCH_TYPE_LABEL: Record<(typeof MATCH_TYPES)[number], string> = {
  BROAD: "ampla",
  PHRASE: "frase",
  EXACT: "exata",
};

export const INTENT_LABEL: Record<(typeof KEYWORD_INTENTS)[number], string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  EXCLUDE: "Incompatível",
};

export const DECISION_LABEL: Record<(typeof KEYWORD_DECISIONS)[number], string> = {
  USE: "Usar agora",
  TEST_LATER: "Testar depois",
  EXCLUDE: "Excluir",
};

export const READINESS_LABEL: Record<(typeof KEYWORD_READINESS)[number], string> = {
  READY_FOR_ADS: "Pronto para criar anúncios",
  NEEDS_REFINEMENT: "Refine sua lista antes de criar os anúncios",
};

const GENERIC_TERMS = new Set([
  "curso",
  "gratis",
  "grátis",
  "vaga",
  "emprego",
  "salario",
  "salário",
  "pdf",
  "download",
  "advogado",
  "serviço",
  "servico",
]);

const keywordSchema = z
  .object({
    text: z.string().trim().min(1).max(80),
    matchType: z.enum(MATCH_TYPES),
    intent: z.enum(KEYWORD_INTENTS),
    decision: z.enum(KEYWORD_DECISIONS),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

const groupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    theme: z.string().trim().min(1).max(200),
    keywords: z.array(keywordSchema).max(20),
  })
  .strict();

const negativeSchema = z
  .object({
    text: z.string().trim().min(1).max(80),
    scope: z.enum(NEGATIVE_SCOPES),
    groupName: z.string().trim().max(100).optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();

export const keywordPlanSchema = z
  .object({
    campaignName: z.string().trim().min(1).max(120),
    offer: z.string().trim().min(1).max(200),
    groups: z.array(groupSchema).min(1).max(6),
    negativeKeywords: z.array(negativeSchema).max(30),
    preLaunchIssue: z.string().trim().min(1).max(500).optional(),
    reviewed: z.boolean(),
    readinessStatus: z.enum(KEYWORD_READINESS),
  })
  .strict();

export type KeywordPlan = z.infer<typeof keywordPlanSchema>;
export type KeywordGroup = KeywordPlan["groups"][number];
export type PlannedKeyword = KeywordGroup["keywords"][number];
export type PlannedNegative = KeywordPlan["negativeKeywords"][number];

export type KeywordPlanFormInput = {
  projectId: string;
  campaignName: string;
  offer: string;
  groups: Array<{
    name: string;
    theme: string;
    keywords: Array<{ text: string; matchType: string; intent: string; decision: string; reason?: string }>;
  }>;
  negativeKeywords: Array<{ text: string; scope: string; groupName?: string; reason?: string }>;
  preLaunchIssue: string;
  reviewed: boolean;
};

const formSchema = z.object({
  projectId: z.string().trim().min(1).max(80),
  campaignName: z.string().trim().min(1).max(120),
  offer: z.string().trim().min(1).max(200),
  groups: z.array(groupSchema).min(1).max(6),
  negativeKeywords: z.array(negativeSchema).max(30),
  preLaunchIssue: z.string().trim().max(500),
  reviewed: z.boolean(),
});

/** Só trim e caixa. Não trata “curso google ads” e “curso de google ads” como iguais. */
export function normalizeKeywordText(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export function keywordPlanReadiness(plan: Omit<KeywordPlan, "readinessStatus">): {
  status: "READY_FOR_ADS" | "NEEDS_REFINEMENT";
  issues: string[];
} {
  const issues: string[] = [];
  for (const group of plan.groups) {
    const useKeywords = group.keywords.filter((keyword) => keyword.decision === "USE");
    if (useKeywords.length === 0) issues.push(`O grupo ${group.name} não tem palavra-chave marcada para usar agora.`);
    const seen = new Set<string>();
    for (const keyword of group.keywords) {
      const key = normalizeKeywordText(keyword.text);
      if (seen.has(key)) issues.push(`“${keyword.text}” está repetida no grupo ${group.name}.`);
      seen.add(key);
      if (keyword.decision === "USE" && keyword.intent === "EXCLUDE") {
        issues.push(`“${keyword.text}” foi marcada para usar e também como intenção incompatível.`);
      }
      if (keyword.decision === "USE" && isGenericTerm(keyword.text)) {
        issues.push(`“${keyword.text}” está genérica demais para receber orçamento sem um contexto na própria busca.`);
      }
    }
    const useKeys = new Set(useKeywords.map((keyword) => normalizeKeywordText(keyword.text)));
    const excluded = group.keywords.filter((keyword) => keyword.decision === "EXCLUDE").map((keyword) => normalizeKeywordText(keyword.text));
    for (const key of excluded) {
      if (useKeys.has(key)) issues.push(`“${key}” aparece para usar e para excluir no grupo ${group.name}.`);
    }
    if (useKeywords.length > 0 && !groupRelatesToTheme(group.theme, plan.offer, useKeywords)) {
      issues.push(`As palavras do grupo ${group.name} não conversam com o tema informado.`);
    }
  }

  for (const negative of plan.negativeKeywords) {
    if (negative.scope === "AD_GROUP" && !plan.groups.some((group) => group.name === negative.groupName)) {
      issues.push("Uma negativa de grupo precisa apontar para um grupo existente.");
    }
    const key = normalizeKeywordText(negative.text);
    for (const group of plan.groups) {
      if (negative.scope === "AD_GROUP" && group.name !== negative.groupName) continue;
      const clash = group.keywords.some((keyword) => keyword.decision === "USE" && normalizeKeywordText(keyword.text) === key);
      if (clash) issues.push(`“${negative.text}” está negativa e também marcada para usar no mesmo escopo.`);
    }
  }

  if (!plan.reviewed) issues.push("Marque que você revisou a lista antes de considerá-la pronta.");
  if (plan.preLaunchIssue?.trim()) issues.push(plan.preLaunchIssue.trim());
  return { status: issues.length > 0 ? "NEEDS_REFINEMENT" : "READY_FOR_ADS", issues: [...new Set(issues)] };
}

export function parseKeywordPlanForm(
  input: KeywordPlanFormInput,
): { ok: true; projectId: string; plan: KeywordPlan } | { ok: false; message: string } {
  const parsed = formSchema.safeParse({
    ...input,
    preLaunchIssue: input.preLaunchIssue.trim(),
    groups: input.groups.map((group) => ({
      ...group,
      keywords: group.keywords.map((keyword) => ({
        ...keyword,
        reason: keyword.reason?.trim() || undefined,
      })),
    })),
    negativeKeywords: input.negativeKeywords
      .filter((item) => item.text.trim())
      .map((item) => ({
        text: item.text,
        scope: item.scope,
        groupName: item.scope === "AD_GROUP" ? item.groupName?.trim() || undefined : undefined,
        reason: item.reason?.trim() || undefined,
      })),
  });
  if (!parsed.success) {
    if (input.groups.some((group) => group.keywords.length > 20)) {
      return { ok: false, message: "Use no máximo 20 palavras-chave por grupo nesta etapa." };
    }
    return { ok: false, message: "Revise os campos do plano de palavras-chave." };
  }
  const note = parsed.data.preLaunchIssue.trim();
  const draft = {
    campaignName: parsed.data.campaignName,
    offer: parsed.data.offer,
    groups: parsed.data.groups,
    negativeKeywords: parsed.data.negativeKeywords,
    preLaunchIssue: note || undefined,
    reviewed: parsed.data.reviewed,
  };
  const readiness = keywordPlanReadiness(draft);
  const plan: KeywordPlan = { ...draft, readinessStatus: readiness.status };
  const checked = keywordPlanSchema.safeParse(plan);
  if (!checked.success) return { ok: false, message: "Revise os campos do plano de palavras-chave." };
  return { ok: true, projectId: parsed.data.projectId, plan: checked.data };
}

export function keywordProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && keywordPlanSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export type KeywordPrefill = {
  campaignName: string;
  offer: string;
  objective: string;
  conversion: string;
  destination: string;
  groups: Array<{ name: string; theme: string; sourceIntent: string; keywords: PlannedKeyword[] }>;
  negativeKeywords: PlannedNegative[];
  preLaunchIssue: string;
  reviewed: boolean;
  fromBlueprint: boolean;
};

export function buildKeywordPrefill(input: {
  projectOffer: string;
  blueprint: SearchBlueprint | null;
  saved: KeywordPlan | null;
}): KeywordPrefill {
  if (input.saved) {
    return {
      campaignName: input.saved.campaignName,
      offer: input.saved.offer,
      objective: input.blueprint?.businessObjective ?? "",
      conversion: input.blueprint?.primaryConversion ?? "",
      destination: input.blueprint?.destinationType ?? "",
      groups: input.saved.groups.map((group) => ({
        name: group.name,
        theme: group.theme,
        sourceIntent: input.blueprint?.adGroups.find((item) => item.name === group.name)?.intent ?? "",
        keywords: group.keywords,
      })),
      negativeKeywords: input.saved.negativeKeywords,
      preLaunchIssue: input.saved.preLaunchIssue ?? "",
      reviewed: input.saved.reviewed,
      fromBlueprint: Boolean(input.blueprint),
    };
  }
  if (input.blueprint) {
    return {
      campaignName: input.blueprint.campaignName,
      offer: input.blueprint.offer,
      objective: input.blueprint.businessObjective,
      conversion: input.blueprint.primaryConversion,
      destination: input.blueprint.destinationType,
      groups: input.blueprint.adGroups.map((group) => ({
        name: group.name,
        theme: group.theme,
        sourceIntent: group.intent,
        keywords: [],
      })),
      negativeKeywords: [],
      preLaunchIssue: "",
      reviewed: false,
      fromBlueprint: true,
    };
  }
  const offer = input.projectOffer.trim();
  return {
    campaignName: offer ? `Pesquisa | ${offer}`.slice(0, 120) : "",
    offer,
    objective: "",
    conversion: "",
    destination: "",
    groups: [{ name: "", theme: "", sourceIntent: "", keywords: [] }],
    negativeKeywords: [],
    preLaunchIssue: "",
    reviewed: false,
    fromBlueprint: false,
  };
}

function isGenericTerm(value: string): boolean {
  const key = normalizeKeywordText(value);
  return !key.includes(" ") && GENERIC_TERMS.has(key);
}

function tokens(value: string): string[] {
  return normalizeKeywordText(value)
    .split(/[^a-z0-9à-ÿ]+/i)
    .filter((token) => token.length >= 5);
}

function groupRelatesToTheme(theme: string, offer: string, keywords: PlannedKeyword[]): boolean {
  const context = new Set([...tokens(theme), ...tokens(offer)]);
  if (context.size === 0) return true;
  return keywords.some((keyword) => tokens(keyword.text).some((token) => context.has(token)) || [...context].some((token) => normalizeKeywordText(keyword.text).includes(token)));
}
