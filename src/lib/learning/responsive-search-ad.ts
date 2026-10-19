import { z } from "zod";
import { destinationUrlError } from "@/lib/learning/destination-plan";
import type { KeywordPlan } from "@/lib/learning/keyword-intent";
import type { SearchBlueprint } from "@/lib/learning/search-blueprint";

/**
 * Limites do Responsive Search Ad na documentação específica do formato:
 * Google Ads Help “About responsive search ads” e Google Ads API “Create responsive search ads”.
 * Título 30, descrição 90, caminho 15. Mínimo 3 títulos e 2 descrições. Máximo 15 e 4.
 * Coreano, japonês e chinês contam cada caractere como dois.
 */
export const RSA_LIMITS = {
  headlineMin: 3,
  headlineMax: 15,
  headlineUnits: 30,
  descriptionMin: 2,
  descriptionMax: 4,
  descriptionUnits: 90,
  pathUnits: 15,
} as const;

export const HEADLINE_CATEGORIES = ["KEYWORD", "OFFER", "BENEFIT", "DIFFERENTIATOR", "CTA", "BRAND", "LOCATION", "PROOF", "OTHER"] as const;
export const DESCRIPTION_CATEGORIES = ["VALUE", "HOW_IT_WORKS", "CTA", "PROOF", "OTHER"] as const;
export const PIN_ASSET_TYPES = ["HEADLINE", "DESCRIPTION"] as const;
export const AD_READINESS = ["READY_TO_BUILD", "NEEDS_REFINEMENT"] as const;

export const HEADLINE_CATEGORY_LABEL: Record<(typeof HEADLINE_CATEGORIES)[number], string> = {
  KEYWORD: "Intenção da busca",
  OFFER: "Oferta",
  BENEFIT: "Benefício",
  DIFFERENTIATOR: "Diferencial",
  CTA: "Ação",
  BRAND: "Marca",
  LOCATION: "Localização",
  PROOF: "Prova",
  OTHER: "Outro ângulo",
};

export const DESCRIPTION_CATEGORY_LABEL: Record<(typeof DESCRIPTION_CATEGORIES)[number], string> = {
  VALUE: "Valor",
  HOW_IT_WORKS: "Como funciona",
  CTA: "Ação",
  PROOF: "Prova",
  OTHER: "Outro",
};

export const AD_READINESS_LABEL: Record<(typeof AD_READINESS)[number], string> = {
  READY_TO_BUILD: "Pronto para configurar no Google Ads",
  NEEDS_REFINEMENT: "Refine o anúncio antes de publicar",
};

const headlineSchema = z
  .object({
    text: z.string().trim().min(1).max(80),
    category: z.enum(HEADLINE_CATEGORIES),
  })
  .strict();

const descriptionSchema = z
  .object({
    text: z.string().trim().min(1).max(160),
    category: z.enum(DESCRIPTION_CATEGORIES).optional(),
  })
  .strict();

const pinSchema = z
  .object({
    assetType: z.enum(PIN_ASSET_TYPES),
    assetIndex: z.number().int().nonnegative(),
    position: z.number().int().min(1).max(3),
  })
  .strict();

const groupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    theme: z.string().trim().min(1).max(200),
    primaryIntent: z.string().trim().max(300),
    keywordsContext: z.array(z.string().trim().min(1).max(80)).max(20),
    negativeContext: z.array(z.string().trim().min(1).max(80)).max(30),
    finalUrl: z.string().trim().max(300),
    path1: z.string().trim().max(40).optional(),
    path2: z.string().trim().max(40).optional(),
    cta: z.string().trim().max(90),
    headlines: z.array(headlineSchema).max(RSA_LIMITS.headlineMax),
    descriptions: z.array(descriptionSchema).max(RSA_LIMITS.descriptionMax),
    pinning: z.array(pinSchema).max(12),
    preLaunchIssue: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const responsiveAdPlanSchema = z
  .object({
    campaignName: z.string().trim().min(1).max(120),
    offer: z.string().trim().min(1).max(200),
    conversion: z.string().trim().max(200),
    destination: z.string().trim().max(300),
    groups: z.array(groupSchema).min(1).max(6),
    usesKeywordPlan: z.boolean(),
    offerAccurate: z.boolean(),
    destinationMatchesPromise: z.boolean(),
    claimsReviewed: z.boolean(),
    ctaMatchesConversion: z.boolean(),
    readinessStatus: z.enum(AD_READINESS),
  })
  .strict();

export type ResponsiveAdPlan = z.infer<typeof responsiveAdPlanSchema>;
export type ResponsiveAdGroup = ResponsiveAdPlan["groups"][number];
export type ResponsiveHeadline = ResponsiveAdGroup["headlines"][number];
export type ResponsiveDescription = ResponsiveAdGroup["descriptions"][number];
export type ResponsivePin = ResponsiveAdGroup["pinning"][number];

export type ResponsiveAdFormInput = {
  projectId: string;
  campaignName: string;
  offer: string;
  conversion: string;
  destination: string;
  groups: Array<{
    name: string;
    theme: string;
    primaryIntent: string;
    keywordsContext: string[];
    negativeContext: string[];
    finalUrl: string;
    path1: string;
    path2: string;
    cta: string;
    headlines: Array<{ text: string; category: string }>;
    descriptions: Array<{ text: string; category?: string }>;
    pinning: Array<{ assetType: string; assetIndex: number; position: number }>;
    preLaunchIssue: string;
  }>;
  offerAccurate: boolean;
  destinationMatchesPromise: boolean;
  claimsReviewed: boolean;
  ctaMatchesConversion: boolean;
};

const formSchema = responsiveAdPlanSchema.omit({ readinessStatus: true, usesKeywordPlan: true });

const WEAK_CTA = new Set(["saiba mais", "clique aqui", "saiba mais agora"]);
const PRICE_CLAIM = /\b(r\$|desconto|promo[cç][aã]o)\b/i;

export function normalizeAdText(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export function rsaUnits(value: string): number {
  let units = 0;
  for (const char of value.trim()) {
    const code = char.codePointAt(0) ?? 0;
    units += isDoubleWidth(code) ? 2 : 1;
  }
  return units;
}

export function responsiveAdReadiness(
  plan: Omit<ResponsiveAdPlan, "readinessStatus">,
): { status: "READY_TO_BUILD" | "NEEDS_REFINEMENT"; issues: string[] } {
  const issues: string[] = [];
  for (const group of plan.groups) {
    if (group.headlines.length < RSA_LIMITS.headlineMin) {
      issues.push(`O grupo ${group.name} precisa de pelo menos ${RSA_LIMITS.headlineMin} títulos.`);
    }
    if (group.descriptions.length < RSA_LIMITS.descriptionMin) {
      issues.push(`O grupo ${group.name} precisa de pelo menos ${RSA_LIMITS.descriptionMin} descrições.`);
    }
    const seen = new Set<string>();
    const signatures = new Map<string, string>();
    for (const headline of group.headlines) {
      const key = normalizeAdText(headline.text);
      if (seen.has(key)) issues.push(`“${headline.text}” está repetido no grupo ${group.name}.`);
      seen.add(key);
      const units = rsaUnits(headline.text);
      if (units > RSA_LIMITS.headlineUnits) issues.push(`“${headline.text}” passa de ${RSA_LIMITS.headlineUnits} caracteres.`);
      const signature = tokenSignature(headline.text);
      const previous = signatures.get(signature);
      if (signature && previous && previous !== key) issues.push(`“${headline.text}” repete o mesmo ângulo de “${previous}”.`);
      if (signature) signatures.set(signature, key);
    }
    const descriptionSeen = new Set<string>();
    for (const description of group.descriptions) {
      const key = normalizeAdText(description.text);
      if (descriptionSeen.has(key)) issues.push(`A descrição “${description.text}” está repetida no grupo ${group.name}.`);
      descriptionSeen.add(key);
      if (rsaUnits(description.text) > RSA_LIMITS.descriptionUnits) {
        issues.push(`A descrição “${description.text}” passa de ${RSA_LIMITS.descriptionUnits} caracteres.`);
      }
    }
    if (group.headlines.length > 1 && seen.size === 1) issues.push(`Os títulos do grupo ${group.name} dizem a mesma coisa.`);
    if (!group.finalUrl.trim()) issues.push(`O grupo ${group.name} ainda não tem URL final.`);
    else if (destinationUrlError("LANDING_PAGE", group.finalUrl)) issues.push(`A URL final do grupo ${group.name} não pode ser usada.`);
    const pathIssue = pathIssues(group.path1, group.path2);
    if (pathIssue) issues.push(`${pathIssue} Grupo ${group.name}.`);
    if (!adMentionsOffer(plan.offer, group)) issues.push(`O anúncio do grupo ${group.name} não menciona a oferta.`);
    if (!adMentionsIntent(group)) issues.push(`Nenhum título do grupo ${group.name} conversa com a busca ou com o tema.`);
    if (plan.usesKeywordPlan && group.keywordsContext.length === 0) {
      issues.push(`O grupo ${group.name} não tem palavra-chave marcada para usar na aula anterior.`);
    }
    if (!ctaCoherent(group.cta, plan.conversion)) issues.push(`O CTA do grupo ${group.name} não corresponde à conversão definida.`);
    if (promisesUnstatedPrice(plan.offer, plan.conversion, group)) {
      issues.push(`O anúncio do grupo ${group.name} promete preço ou desconto que não está na oferta.`);
    }
    issues.push(...pinIssues(group));
    if (group.preLaunchIssue?.trim()) issues.push(group.preLaunchIssue.trim());
  }
  if (!plan.offerAccurate) issues.push("Confirme que o anúncio representa a oferta.");
  if (!plan.destinationMatchesPromise) issues.push("Confirme que o destino cumpre o que o anúncio promete.");
  if (!plan.claimsReviewed) issues.push("Revise valores, condições e afirmações antes de considerar o anúncio pronto.");
  if (!plan.ctaMatchesConversion) issues.push("Confirme que o CTA corresponde à conversão.");
  if (!plan.destination.trim() && plan.groups.some((group) => !group.finalUrl.trim())) {
    issues.push("O destino da campanha ainda não foi informado.");
  }
  return { status: issues.length > 0 ? "NEEDS_REFINEMENT" : "READY_TO_BUILD", issues: [...new Set(issues)] };
}

export function parseResponsiveAdForm(
  input: ResponsiveAdFormInput,
  context: { keywordPlan?: KeywordPlan | null } = {},
): { ok: true; projectId: string; plan: ResponsiveAdPlan } | { ok: false; message: string } {
  const groups = input.groups.map((group) => ({
    ...group,
    keywordsContext: group.keywordsContext.map((item) => item.trim()).filter(Boolean),
    negativeContext: group.negativeContext.map((item) => item.trim()).filter(Boolean),
    headlines: group.headlines.filter((item) => item.text.trim()),
    descriptions: group.descriptions
      .filter((item) => item.text.trim())
      .map((item) => (item.category ? { text: item.text, category: item.category } : { text: item.text })),
    path1: group.path1.trim() || undefined,
    path2: group.path2.trim() || undefined,
    preLaunchIssue: group.preLaunchIssue.trim() || undefined,
    pinning: group.pinning,
  }));
  const withKeywordContext = context.keywordPlan
    ? groups.map((group) => ({
        ...group,
        keywordsContext: useKeywordsFor(context.keywordPlan as KeywordPlan, group.name),
        negativeContext: negativesFor(context.keywordPlan as KeywordPlan, group.name),
      }))
    : groups;
  if (withKeywordContext.some((group) => group.headlines.length > RSA_LIMITS.headlineMax)) {
    return { ok: false, message: `Use no máximo ${RSA_LIMITS.headlineMax} títulos por grupo.` };
  }
  if (withKeywordContext.some((group) => group.descriptions.length > RSA_LIMITS.descriptionMax)) {
    return { ok: false, message: `Use no máximo ${RSA_LIMITS.descriptionMax} descrições por grupo.` };
  }
  for (const group of withKeywordContext) {
    if (group.finalUrl && destinationUrlError("LANDING_PAGE", group.finalUrl)) {
      return { ok: false, message: "A URL final precisa ser um endereço HTTPS. Endereços javascript ou data não entram." };
    }
  }
  const parsed = formSchema.safeParse({
    campaignName: input.campaignName,
    offer: input.offer,
    conversion: input.conversion,
    destination: input.destination,
    groups: withKeywordContext,
    offerAccurate: input.offerAccurate,
    destinationMatchesPromise: input.destinationMatchesPromise,
    claimsReviewed: input.claimsReviewed,
    ctaMatchesConversion: input.ctaMatchesConversion,
  });
  if (!parsed.success) return { ok: false, message: "Revise os campos do plano de anúncios." };
  const draft = { ...parsed.data, usesKeywordPlan: Boolean(context.keywordPlan) };
  const readiness = responsiveAdReadiness(draft);
  const plan: ResponsiveAdPlan = { ...draft, readinessStatus: readiness.status };
  const checked = responsiveAdPlanSchema.safeParse(plan);
  if (!checked.success) return { ok: false, message: "Revise os campos do plano de anúncios." };
  return { ok: true, projectId: input.projectId.trim(), plan: checked.data };
}

export function responsiveAdProjectIdsFrom(rows: { projectId: string | null; payload: unknown }[]): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.projectId && responsiveAdPlanSchema.safeParse(row.payload).success) ids.add(row.projectId);
  }
  return ids;
}

export type ResponsiveAdPrefill = {
  campaignName: string;
  offer: string;
  conversion: string;
  destination: string;
  groups: ResponsiveAdFormInput["groups"];
  fromBlueprint: boolean;
  fromKeywordPlan: boolean;
  offerAccurate: boolean;
  destinationMatchesPromise: boolean;
  claimsReviewed: boolean;
  ctaMatchesConversion: boolean;
};

export function buildResponsiveAdPrefill(input: {
  projectOffer: string;
  blueprint: SearchBlueprint | null;
  keywordPlan: KeywordPlan | null;
  saved: ResponsiveAdPlan | null;
}): ResponsiveAdPrefill {
  const fromBlueprint = Boolean(input.blueprint);
  const fromKeywordPlan = Boolean(input.keywordPlan);
  if (input.saved) {
    return {
      campaignName: input.saved.campaignName,
      offer: input.saved.offer,
      conversion: input.saved.conversion,
      destination: input.saved.destination,
      groups: input.saved.groups.map((group) => ({
        name: group.name,
        theme: group.theme,
        primaryIntent: group.primaryIntent,
        keywordsContext: input.keywordPlan ? useKeywordsFor(input.keywordPlan, group.name) : group.keywordsContext,
        negativeContext: input.keywordPlan ? negativesFor(input.keywordPlan, group.name) : group.negativeContext,
        finalUrl: group.finalUrl,
        path1: group.path1 ?? "",
        path2: group.path2 ?? "",
        cta: group.cta,
        headlines: group.headlines,
        descriptions: group.descriptions.map((item) => ({ text: item.text, category: item.category })),
        pinning: group.pinning,
        preLaunchIssue: group.preLaunchIssue ?? "",
      })),
      fromBlueprint,
      fromKeywordPlan,
      offerAccurate: input.saved.offerAccurate,
      destinationMatchesPromise: input.saved.destinationMatchesPromise,
      claimsReviewed: input.saved.claimsReviewed,
      ctaMatchesConversion: input.saved.ctaMatchesConversion,
    };
  }
  const offer = input.blueprint?.offer || input.keywordPlan?.offer || input.projectOffer.trim();
  const campaignName = input.blueprint?.campaignName || input.keywordPlan?.campaignName || (offer ? `Pesquisa | ${offer}`.slice(0, 120) : "");
  return {
    campaignName,
    offer,
    conversion: input.blueprint?.primaryConversion ?? "",
    destination: destinationLabel(input.blueprint),
    groups: draftGroups(input.blueprint, input.keywordPlan),
    fromBlueprint,
    fromKeywordPlan,
    offerAccurate: false,
    destinationMatchesPromise: false,
    claimsReviewed: false,
    ctaMatchesConversion: false,
  };
}

function draftGroups(blueprint: SearchBlueprint | null, keywordPlan: KeywordPlan | null): ResponsiveAdFormInput["groups"] {
  const names = keywordPlan
    ? keywordPlan.groups.map((group) => group.name)
    : blueprint
      ? blueprint.adGroups.map((group) => group.name)
      : [""];
  return names.map((name) => {
    const keywordGroup = keywordPlan?.groups.find((group) => group.name === name);
    const blueprintGroup = blueprint?.adGroups.find((group) => group.name === name);
    return emptyGroup({
      name,
      theme: keywordGroup?.theme || blueprintGroup?.theme || "",
      primaryIntent: blueprintGroup?.intent || "",
      keywordsContext: keywordGroup ? keywordGroup.keywords.filter((keyword) => keyword.decision === "USE").map((keyword) => keyword.text) : [],
      negativeContext: keywordPlan ? negativesFor(keywordPlan, name) : [],
      finalUrl: blueprint?.destinationUrl ?? "",
    });
  });
}

function emptyGroup(patch: Partial<ResponsiveAdFormInput["groups"][number]>): ResponsiveAdFormInput["groups"][number] {
  return {
    name: "",
    theme: "",
    primaryIntent: "",
    keywordsContext: [],
    negativeContext: [],
    finalUrl: "",
    path1: "",
    path2: "",
    cta: "",
    headlines: [],
    descriptions: [],
    pinning: [],
    preLaunchIssue: "",
    ...patch,
  };
}

function useKeywordsFor(plan: KeywordPlan, groupName: string): string[] {
  return plan.groups.find((group) => group.name === groupName)?.keywords.filter((keyword) => keyword.decision === "USE").map((keyword) => keyword.text) ?? [];
}

function negativesFor(plan: KeywordPlan, groupName: string): string[] {
  return plan.negativeKeywords
    .filter((item) => item.scope === "CAMPAIGN" || item.groupName === groupName)
    .map((item) => item.text);
}

function destinationLabel(blueprint: SearchBlueprint | null): string {
  if (!blueprint) return "";
  return [blueprint.destinationType, blueprint.destinationUrl].filter(Boolean).join(" ").slice(0, 300);
}

function tokens(value: string): string[] {
  return normalizeAdText(value)
    .split(/[^a-z0-9à-ÿ]+/i)
    .filter((token) => token.length >= 4);
}

function tokenSignature(value: string): string {
  return tokens(value).slice().sort().join(" ");
}

function adMentionsOffer(offer: string, group: ResponsiveAdGroup): boolean {
  const context = tokens(offer);
  if (context.length === 0) return true;
  const copy = [...group.headlines.map((item) => item.text), ...group.descriptions.map((item) => item.text)].join(" ");
  return context.some((token) => normalizeAdText(copy).includes(token));
}

function adMentionsIntent(group: ResponsiveAdGroup): boolean {
  const context = [...tokens(group.theme), ...tokens(group.primaryIntent), ...group.keywordsContext.flatMap(tokens)];
  if (context.length === 0) return true;
  return group.headlines.some((headline) => context.some((token) => normalizeAdText(headline.text).includes(token)));
}

function ctaCoherent(cta: string, conversion: string): boolean {
  const key = normalizeAdText(cta);
  if (!key) return false;
  if (WEAK_CTA.has(key) && !normalizeAdText(conversion).includes("saiba")) return false;
  return tokens(cta).some((token) => normalizeAdText(conversion).includes(token));
}

function promisesUnstatedPrice(offer: string, conversion: string, group: ResponsiveAdGroup): boolean {
  const copy = [group.cta, ...group.headlines.map((item) => item.text), ...group.descriptions.map((item) => item.text)].join(" ");
  if (!PRICE_CLAIM.test(copy)) return false;
  return !PRICE_CLAIM.test(`${offer} ${conversion}`);
}

function pathIssues(path1: string | undefined, path2: string | undefined): string | null {
  if (path2 && !path1) return "O segundo caminho só pode existir quando o primeiro também existe.";
  for (const path of [path1, path2]) {
    if (!path) continue;
    if (rsaUnits(path) > RSA_LIMITS.pathUnits) return `O caminho “${path}” passa de ${RSA_LIMITS.pathUnits} caracteres.`;
    if (/[\s/]/.test(path)) return `O caminho “${path}” precisa ser um trecho curto, sem espaço nem barra.`;
  }
  return null;
}

function pinIssues(group: ResponsiveAdGroup): string[] {
  const issues: string[] = [];
  const positions = new Set<string>();
  let headlinePins = 0;
  for (const pin of group.pinning) {
    const slot = `${pin.assetType}:${pin.position}`;
    if (positions.has(slot)) issues.push(`Mais de um asset do grupo ${group.name} foi fixado na mesma posição.`);
    positions.add(slot);
    const list = pin.assetType === "HEADLINE" ? group.headlines : group.descriptions;
    if (pin.assetIndex >= list.length) issues.push(`Uma fixação do grupo ${group.name} aponta para um texto que não existe.`);
    if (pin.assetType === "DESCRIPTION" && pin.position > 2) issues.push(`Descrição só pode ser fixada na posição 1 ou 2.`);
    if (pin.assetType === "HEADLINE") headlinePins += 1;
  }
  if (headlinePins >= RSA_LIMITS.headlineMin && headlinePins === group.headlines.length) {
    issues.push(`Fixar todos os títulos do grupo ${group.name} reduz as combinações possíveis.`);
  }
  return issues;
}

function isDoubleWidth(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}
