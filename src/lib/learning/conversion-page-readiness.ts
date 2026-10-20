import { z } from "zod";
import {
  conversionJourneyLocalKey,
  conversionJourneyMapSchema,
  type ConversionJourneyMap,
} from "@/lib/learning/conversion-journey-map";
import {
  digitalPresenceDecisionSchema,
  digitalPresenceLocalKey,
  RECOMMENDED_STRUCTURE_LABELS,
  type DigitalPresenceDecision,
} from "@/lib/learning/digital-presence-decision";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export const CONVERSION_PAGE_READINESS_TOOL = "CONVERSION_PAGE_READINESS_V1" as const;
export const SITE_PAGE_READINESS_SLUG = "pagina-pronta-para-converter";

/** Dimensões avaliadas — ordem pedagógica e de prioridade. */
export const READINESS_DIMENSIONS = [
  "CLARITY",
  "OFFER",
  "CTA",
  "TRUST",
  "STRUCTURE",
  "MOBILE",
  "EXPERIENCE",
  "MEASUREMENT",
] as const;

export type ReadinessDimension = (typeof READINESS_DIMENSIONS)[number];

/** Pesos explícitos (percentuais). Soma = 100. */
export const DIMENSION_WEIGHTS: Record<ReadinessDimension, number> = {
  CLARITY: 20,
  OFFER: 15,
  CTA: 15,
  TRUST: 10,
  STRUCTURE: 10,
  MOBILE: 10,
  EXPERIENCE: 10,
  MEASUREMENT: 10,
};

/** Heurísticas pedagógicas — não são benchmark de mercado. */
export const DIMENSION_THRESHOLDS = {
  STRONG_MIN: 75,
  ATTENTION_MIN: 40,
} as const;

export const CRITICAL_OVERRIDE_DIMENSIONS = ["CLARITY", "OFFER", "CTA"] as const;

export const PAGE_EXISTS = ["YES", "PARTIALLY", "NO"] as const;
export const ANSWER_VALUES = ["YES", "PARTIALLY", "NO", "UNKNOWN"] as const;
export const DIMENSION_STATUSES = ["STRONG", "ATTENTION", "CRITICAL", "INSUFFICIENT_INFORMATION", "NOT_APPLICABLE"] as const;
export const OVERALL_READINESS = [
  "FOUNDATION_NOT_BUILT",
  "NEEDS_PREPARATION",
  "READY_TO_IMPROVE",
  "READY_TO_VALIDATE",
  "INSUFFICIENT_INFORMATION",
] as const;
export const BOTTLENECKS = [
  "CLARITY",
  "OFFER",
  "CTA",
  "TRUST",
  "STRUCTURE",
  "MOBILE",
  "EXPERIENCE",
  "MEASUREMENT",
  "NONE",
  "INSUFFICIENT_INFORMATION",
  "FOUNDATION",
] as const;

export const DIMENSION_LABELS: Record<ReadinessDimension, string> = {
  CLARITY: "Clareza",
  OFFER: "Oferta",
  CTA: "Ação",
  TRUST: "Confiança",
  STRUCTURE: "Estrutura",
  MOBILE: "Mobile",
  EXPERIENCE: "Experiência",
  MEASUREMENT: "Mensuração",
};

export const DIMENSION_STATUS_LABELS: Record<(typeof DIMENSION_STATUSES)[number], string> = {
  STRONG: "Forte",
  ATTENTION: "Atenção",
  CRITICAL: "Crítico",
  INSUFFICIENT_INFORMATION: "Sem informação suficiente",
  NOT_APPLICABLE: "Não aplicável",
};

export const OVERALL_READINESS_LABELS: Record<(typeof OVERALL_READINESS)[number], string> = {
  FOUNDATION_NOT_BUILT: "Ainda na fase de construção",
  NEEDS_PREPARATION: "Precisa de preparação",
  READY_TO_IMPROVE: "Pronto para melhorar",
  READY_TO_VALIDATE: "Pronto para validar",
  INSUFFICIENT_INFORMATION: "Informação insuficiente",
};

export const PAGE_EXISTS_LABELS: Record<(typeof PAGE_EXISTS)[number], string> = {
  YES: "Sim — já tenho a estrutura para avaliar",
  PARTIALLY: "Parcialmente — existe algo, mas incompleto",
  NO: "Não — ainda não tenho página/estrutura",
};

export const ANSWER_LABELS: Record<(typeof ANSWER_VALUES)[number], string> = {
  YES: "Sim",
  PARTIALLY: "Parcialmente",
  NO: "Não",
  UNKNOWN: "Ainda não sei",
};

/** Pontos por resposta. UNKNOWN = null (fora do denominador). */
export const ANSWER_POINTS: Record<(typeof ANSWER_VALUES)[number], number | null> = {
  YES: 2,
  PARTIALLY: 1,
  NO: 0,
  UNKNOWN: null,
};

export type ReadinessQuestion = {
  id: string;
  dimension: ReadinessDimension;
  prompt: string;
  help?: string;
};

/** 16 questões — 2 por dimensão. */
export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  {
    id: "clarity_offer_clear",
    dimension: "CLARITY",
    prompt: "Em poucos segundos, uma pessoa entende o que você oferece?",
    help: "O que é oferecido, sem ambiguidade.",
  },
  {
    id: "clarity_audience_context",
    dimension: "CLARITY",
    prompt: "Fica claro para quem é e qual benefício ou contexto principal?",
  },
  {
    id: "offer_defined",
    dimension: "OFFER",
    prompt: "A oferta (serviço/produto) está suficientemente definida para alguém decidir avançar?",
    help: "Escopo compreensível — preço público não é obrigatório.",
  },
  {
    id: "offer_next_step",
    dimension: "OFFER",
    prompt: "A proposta deixa claro o próximo passo relacionado à oferta?",
  },
  {
    id: "cta_main_action",
    dimension: "CTA",
    prompt: "Está claro o que a pessoa deve fazer agora?",
  },
  {
    id: "cta_visibility",
    dimension: "CTA",
    prompt: "A ação principal é visível e não compete com muitas ações iguais em importância?",
  },
  {
    id: "trust_identity",
    dimension: "TRUST",
    prompt: "Existe identificação clara da empresa ou profissional?",
  },
  {
    id: "trust_evidence",
    dimension: "TRUST",
    prompt: "Há informações que reduzem insegurança (processo, portfólio, contato, prova real)?",
    help: "Não invente prova. Avalie o que realmente existe.",
  },
  {
    id: "structure_sequence",
    dimension: "STRUCTURE",
    prompt: "A ordem das informações ajuda a pessoa a entender antes de agir?",
  },
  {
    id: "structure_hierarchy",
    dimension: "STRUCTURE",
    prompt: "As informações importantes aparecem com hierarquia clara (não tudo com o mesmo peso)?",
  },
  {
    id: "mobile_reading",
    dimension: "MOBILE",
    prompt: "No celular, a leitura e os botões funcionam bem?",
  },
  {
    id: "mobile_forms",
    dimension: "MOBILE",
    prompt: "Formulários, navegação e imagens se comportam bem no celular (sem cortes graves)?",
  },
  {
    id: "experience_friction",
    dimension: "EXPERIENCE",
    prompt: "O próximo passo é fácil de realizar, sem fricção óbvia?",
    help: "Texto confuso, formulário excessivo, lentidão percebida, distrações.",
  },
  {
    id: "experience_distraction",
    dimension: "EXPERIENCE",
    prompt: "A página evita elementos que atrapalham a compreensão ou a ação?",
  },
  {
    id: "measurement_action",
    dimension: "MEASUREMENT",
    prompt: "Você consegue saber quando a ação importante aconteceu?",
    help: "Clique no WhatsApp, envio de formulário, agendamento, compra, lead — o princípio, não a ferramenta.",
  },
  {
    id: "measurement_review",
    dimension: "MEASUREMENT",
    prompt: "Você consegue revisar esses resultados com alguma regularidade?",
  },
];

const answerEnum = z.enum(ANSWER_VALUES);

const answersRecordSchema = z
  .object({
    clarity_offer_clear: answerEnum.optional(),
    clarity_audience_context: answerEnum.optional(),
    offer_defined: answerEnum.optional(),
    offer_next_step: answerEnum.optional(),
    cta_main_action: answerEnum.optional(),
    cta_visibility: answerEnum.optional(),
    trust_identity: answerEnum.optional(),
    trust_evidence: answerEnum.optional(),
    structure_sequence: answerEnum.optional(),
    structure_hierarchy: answerEnum.optional(),
    mobile_reading: answerEnum.optional(),
    mobile_forms: answerEnum.optional(),
    experience_friction: answerEnum.optional(),
    experience_distraction: answerEnum.optional(),
    measurement_action: answerEnum.optional(),
    measurement_review: answerEnum.optional(),
  })
  .strict();

export const pageReadinessContextSchema = z
  .object({
    offer: z.string().trim().max(160).optional().nullable(),
    currentDestination: z.string().trim().max(200).optional().nullable(),
    recommendedStructure: z.string().trim().max(80).optional().nullable(),
    primaryAction: z.string().trim().max(80).optional().nullable(),
  })
  .strict();

const dimensionScoreSchema = z
  .object({
    dimension: z.enum(READINESS_DIMENSIONS),
    score: z.number().min(0).max(100).nullable(),
    status: z.enum(DIMENSION_STATUSES),
    knownAnswers: z.number().int().min(0).max(2),
  })
  .strict();

const prioritySchema = z
  .object({
    dimension: z.enum(READINESS_DIMENSIONS),
    status: z.enum(DIMENSION_STATUSES),
    reason: z.string().trim().min(1).max(280),
    nextStep: z.string().trim().min(1).max(280),
  })
  .strict();

export const conversionPageReadinessSchema = z
  .object({
    pageExists: z.enum(PAGE_EXISTS),
    context: pageReadinessContextSchema,
    answers: answersRecordSchema,
    dimensionScores: z.array(dimensionScoreSchema).max(8),
    assessmentCoverage: z.object({ evaluated: z.number().int().min(0).max(8), total: z.literal(8) }).strict(),
    overallScore: z.number().min(0).max(100).nullable(),
    overallReadiness: z.enum(OVERALL_READINESS),
    primaryBottleneck: z.enum(BOTTLENECKS),
    priorities: z.array(prioritySchema).max(3),
    caveats: z.array(z.string().trim().min(1).max(280)).max(6),
  })
  .strict();

export type ConversionPageReadiness = z.infer<typeof conversionPageReadinessSchema>;
export type PageReadinessAnswers = z.infer<typeof answersRecordSchema>;

export const pageReadinessResponseSchema = z
  .object({
    kind: z.enum(["personal", "project"]),
    projectId: z.string().trim().min(1).max(80).optional().nullable(),
    readiness: conversionPageReadinessSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "project" && !value.projectId) {
      ctx.addIssue({ code: "custom", path: ["projectId"], message: "Escolha um projeto." });
    }
  });

export type PageReadinessResponse = z.infer<typeof pageReadinessResponseSchema>;

export function pageReadinessLocalKey(courseSlug = SITES_COURSE_SLUG, lessonSlug = SITE_PAGE_READINESS_SLUG): string {
  return `af_${courseSlug}_${lessonSlug}_conversion_page_readiness_v1`;
}

export function answerPoints(value: (typeof ANSWER_VALUES)[number] | undefined): number | null {
  if (!value) return null;
  return ANSWER_POINTS[value];
}

export function statusFromScore(score: number | null, knownAnswers: number): (typeof DIMENSION_STATUSES)[number] {
  if (knownAnswers === 0 || score == null) return "INSUFFICIENT_INFORMATION";
  if (score >= DIMENSION_THRESHOLDS.STRONG_MIN) return "STRONG";
  if (score >= DIMENSION_THRESHOLDS.ATTENTION_MIN) return "ATTENTION";
  return "CRITICAL";
}

export function scoreDimension(
  dimension: ReadinessDimension,
  answers: PageReadinessAnswers,
): { score: number | null; status: (typeof DIMENSION_STATUSES)[number]; knownAnswers: number } {
  const questions = READINESS_QUESTIONS.filter((question) => question.dimension === dimension);
  let earned = 0;
  let possible = 0;
  let knownAnswers = 0;
  for (const question of questions) {
    const points = answerPoints(answers[question.id as keyof PageReadinessAnswers] as (typeof ANSWER_VALUES)[number] | undefined);
    if (points == null) continue;
    knownAnswers += 1;
    earned += points;
    possible += 2;
  }
  if (knownAnswers === 0) {
    return { score: null, status: "INSUFFICIENT_INFORMATION", knownAnswers: 0 };
  }
  const score = Math.round((earned / possible) * 100);
  return { score, status: statusFromScore(score, knownAnswers), knownAnswers };
}

const PRIORITY_TEMPLATES: Record<
  ReadinessDimension,
  { critical: { reason: string; nextStep: string }; attention: { reason: string; nextStep: string } }
> = {
  CLARITY: {
    critical: {
      reason: "Em poucos segundos, a oferta ainda não fica clara para o visitante.",
      nextStep: "Deixe explícito o que você oferece e para quem, na primeira impressão da página.",
    },
    attention: {
      reason: "A clareza pode melhorar para reduzir hesitação inicial.",
      nextStep: "Revise título e contexto para remover ambiguidades.",
    },
  },
  OFFER: {
    critical: {
      reason: "A oferta ainda não está definida o suficiente para alguém decidir avançar.",
      nextStep: "Defina escopo e proposta da oferta antes de pedir a ação.",
    },
    attention: {
      reason: "A oferta existe, mas ainda pode ficar mais concreta.",
      nextStep: "Deixe o próximo passo da oferta mais evidente.",
    },
  },
  CTA: {
    critical: {
      reason: "A ação principal não está clara ou compete demais com outras ações.",
      nextStep: "Defina uma ação principal clara e torne-a visível.",
    },
    attention: {
      reason: "A ação existe, mas a hierarquia de CTAs pode melhorar.",
      nextStep: "Reforce a ação principal e reduza ações concorrentes.",
    },
  },
  TRUST: {
    critical: {
      reason: "Falta informação básica para reduzir a insegurança da decisão.",
      nextStep: "Inclua identificação e pelo menos um elemento verificável de confiança.",
    },
    attention: {
      reason: "Há espaço para fortalecer a confiança antes do pedido de ação.",
      nextStep: "Adicione processo, contato ou prova real aplicável ao seu caso.",
    },
  },
  STRUCTURE: {
    critical: {
      reason: "A ordem das informações dificulta entender e avançar.",
      nextStep: "Reorganize a sequência para explicar antes de pedir a ação.",
    },
    attention: {
      reason: "A estrutura pode conduzir melhor a atenção.",
      nextStep: "Agrupe informações relacionadas e destaque o essencial.",
    },
  },
  MOBILE: {
    critical: {
      reason: "A experiência no celular parece prejudicar leitura ou ação.",
      nextStep: "Revise botões, formulários e cortes no celular.",
    },
    attention: {
      reason: "Há pontos de atenção na experiência mobile.",
      nextStep: "Teste a página no celular e ajuste o que atrapalha o avanço.",
    },
  },
  EXPERIENCE: {
    critical: {
      reason: "Há fricção relevante no caminho até a ação.",
      nextStep: "Remova ou simplifique o que torna o próximo passo difícil.",
    },
    attention: {
      reason: "A experiência pode ficar mais fluida.",
      nextStep: "Reduza distrações e passos desnecessários até a ação.",
    },
  },
  MEASUREMENT: {
    critical: {
      reason: "Você ainda não consegue saber quando a ação importante acontece.",
      nextStep: "Defina como registrar a ação principal (mesmo que de forma simples).",
    },
    attention: {
      reason: "A mensuração existe parcialmente e limita o aprendizado.",
      nextStep: "Garanta que a ação principal possa ser observada com regularidade.",
    },
  },
};

export function decidePageReadiness(input: {
  pageExists: (typeof PAGE_EXISTS)[number];
  answers: PageReadinessAnswers;
  context?: z.infer<typeof pageReadinessContextSchema>;
}): ConversionPageReadiness {
  const context = pageReadinessContextSchema.parse(input.context ?? {});
  const caveats = [
    "Este diagnóstico é baseado nas informações que você forneceu.",
    "Não analisamos automaticamente sua página.",
  ];

  if (input.pageExists === "NO") {
    return conversionPageReadinessSchema.parse({
      pageExists: "NO",
      context,
      answers: {},
      dimensionScores: [],
      assessmentCoverage: { evaluated: 0, total: 8 },
      overallScore: null,
      overallReadiness: "FOUNDATION_NOT_BUILT",
      primaryBottleneck: "FOUNDATION",
      priorities: [],
      caveats: [
        ...caveats,
        "Você ainda não tem uma página para avaliar — e tudo bem. Seu próximo passo é estruturar os fundamentos antes de fazer este diagnóstico novamente.",
      ],
    });
  }

  const dimensionScores = READINESS_DIMENSIONS.map((dimension) => {
    const scored = scoreDimension(dimension, input.answers);
    return {
      dimension,
      score: scored.score,
      status: scored.status,
      knownAnswers: scored.knownAnswers,
    };
  });

  const evaluated = dimensionScores.filter((item) => item.status !== "INSUFFICIENT_INFORMATION").length;
  const assessmentCoverage = { evaluated, total: 8 as const };

  if (evaluated < 3) {
    return conversionPageReadinessSchema.parse({
      pageExists: input.pageExists,
      context,
      answers: input.answers,
      dimensionScores,
      assessmentCoverage,
      overallScore: null,
      overallReadiness: "INSUFFICIENT_INFORMATION",
      primaryBottleneck: "INSUFFICIENT_INFORMATION",
      priorities: [],
      caveats: [...caveats, "Algumas dimensões não puderam ser avaliadas.", "Há informação demais indefinida para um diagnóstico útil."],
    });
  }

  let weightSum = 0;
  let weighted = 0;
  for (const item of dimensionScores) {
    if (item.score == null) continue;
    weightSum += DIMENSION_WEIGHTS[item.dimension];
    weighted += item.score * DIMENSION_WEIGHTS[item.dimension];
  }
  const overallScore = weightSum > 0 ? Math.round(weighted / weightSum) : null;

  const criticalCore = dimensionScores.some(
    (item) =>
      CRITICAL_OVERRIDE_DIMENSIONS.includes(item.dimension as (typeof CRITICAL_OVERRIDE_DIMENSIONS)[number]) &&
      item.status === "CRITICAL",
  );

  let overallReadiness: (typeof OVERALL_READINESS)[number];
  if (criticalCore) {
    overallReadiness = "NEEDS_PREPARATION";
  } else if (
    dimensionScores.every((item) => item.status === "STRONG" || item.status === "INSUFFICIENT_INFORMATION") &&
    evaluated >= 6 &&
    (overallScore ?? 0) >= DIMENSION_THRESHOLDS.STRONG_MIN
  ) {
    overallReadiness = "READY_TO_VALIDATE";
    caveats.push(
      "Pronto para validar não significa pronto para performar. O comportamento real dos visitantes é que permitirá avaliar o resultado.",
    );
  } else if ((overallScore ?? 0) >= DIMENSION_THRESHOLDS.ATTENTION_MIN && !criticalCore) {
    overallReadiness = "READY_TO_IMPROVE";
  } else {
    overallReadiness = "NEEDS_PREPARATION";
  }

  caveats.push("Prontidão não representa taxa de conversão futura.");
  if (evaluated < 8) caveats.push("Algumas dimensões não puderam ser avaliadas.");
  if (input.pageExists === "PARTIALLY") {
    caveats.push("Como a estrutura ainda é parcial, evite interpretar a nota como validação completa.");
  }

  const primaryBottleneck = pickPrimaryBottleneck(dimensionScores);
  const priorities = buildPriorities(dimensionScores);

  return conversionPageReadinessSchema.parse({
    pageExists: input.pageExists,
    context,
    answers: input.answers,
    dimensionScores,
    assessmentCoverage,
    overallScore,
    overallReadiness,
    primaryBottleneck,
    priorities,
    caveats: [...new Set(caveats)].slice(0, 6),
  });
}

function pickPrimaryBottleneck(
  scores: ConversionPageReadiness["dimensionScores"],
): (typeof BOTTLENECKS)[number] {
  const critical = READINESS_DIMENSIONS.filter((dimension) => scores.find((item) => item.dimension === dimension)?.status === "CRITICAL");
  if (critical.length > 0) {
    return critical.sort((a, b) => DIMENSION_WEIGHTS[b] - DIMENSION_WEIGHTS[a] || READINESS_DIMENSIONS.indexOf(a) - READINESS_DIMENSIONS.indexOf(b))[0]!;
  }
  const attention = READINESS_DIMENSIONS.filter((dimension) => scores.find((item) => item.dimension === dimension)?.status === "ATTENTION");
  if (attention.length > 0) {
    return attention.sort((a, b) => DIMENSION_WEIGHTS[b] - DIMENSION_WEIGHTS[a] || READINESS_DIMENSIONS.indexOf(a) - READINESS_DIMENSIONS.indexOf(b))[0]!;
  }
  if (scores.every((item) => item.status === "INSUFFICIENT_INFORMATION")) return "INSUFFICIENT_INFORMATION";
  return "NONE";
}

function buildPriorities(scores: ConversionPageReadiness["dimensionScores"]) {
  const ranked = [...scores]
    .filter((item) => item.status === "CRITICAL" || item.status === "ATTENTION")
    .sort((a, b) => {
      const rank = (status: string) => (status === "CRITICAL" ? 0 : 1);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      const byWeight = DIMENSION_WEIGHTS[b.dimension] - DIMENSION_WEIGHTS[a.dimension];
      if (byWeight !== 0) return byWeight;
      return READINESS_DIMENSIONS.indexOf(a.dimension) - READINESS_DIMENSIONS.indexOf(b.dimension);
    })
    .slice(0, 3);

  return ranked.map((item) => {
    const template = PRIORITY_TEMPLATES[item.dimension];
    const copy = item.status === "CRITICAL" ? template.critical : template.attention;
    return {
      dimension: item.dimension,
      status: item.status,
      reason: copy.reason,
      nextStep: copy.nextStep,
    };
  });
}

export function parsePageReadinessForm(input: {
  pageExists: string;
  answers: Record<string, string>;
  context?: {
    offer?: string;
    currentDestination?: string;
    recommendedStructure?: string;
    primaryAction?: string;
  };
  projectId?: string;
}): { ok: true; readiness: ConversionPageReadiness; projectId: string | null } | { ok: false; message: string } {
  const pageExists = z.enum(PAGE_EXISTS).safeParse(input.pageExists);
  if (!pageExists.success) return { ok: false, message: "Informe se você já possui a estrutura a avaliar." };

  if (pageExists.data === "NO") {
    const readiness = decidePageReadiness({ pageExists: "NO", answers: {}, context: input.context });
    return { ok: true, readiness, projectId: input.projectId?.trim() || null };
  }

  const answersDraft: Record<string, (typeof ANSWER_VALUES)[number]> = {};
  for (const question of READINESS_QUESTIONS) {
    const raw = input.answers[question.id];
    if (!raw) continue;
    const parsed = answerEnum.safeParse(raw);
    if (!parsed.success) return { ok: false, message: "Revise as respostas do diagnóstico." };
    answersDraft[question.id] = parsed.data;
  }
  const answersParsed = answersRecordSchema.safeParse(answersDraft);
  if (!answersParsed.success) return { ok: false, message: "Revise as respostas do diagnóstico." };
  const answers = answersParsed.data;

  const answered = Object.keys(answers).length;
  if (answered < 4) return { ok: false, message: "Responda pelo menos algumas dimensões para gerar o diagnóstico." };

  const readiness = decidePageReadiness({ pageExists: pageExists.data, answers, context: input.context });
  return { ok: true, readiness, projectId: input.projectId?.trim() || null };
}

export function contextFromLessons(input: {
  journey?: ConversionJourneyMap | null;
  presence?: DigitalPresenceDecision | null;
}): z.infer<typeof pageReadinessContextSchema> {
  const offer = input.journey?.offer ?? input.presence?.offer ?? null;
  const currentDestination = input.journey?.destinationDescription ?? null;
  const recommendedStructure = input.presence?.recommendedStructure
    ? RECOMMENDED_STRUCTURE_LABELS[input.presence.recommendedStructure]
    : null;
  const primaryAction = input.journey?.primaryAction ?? input.presence?.inputs.primaryAction ?? null;
  return {
    offer,
    currentDestination,
    recommendedStructure,
    primaryAction,
  };
}

export function readLocalPageReadiness(storageKey = pageReadinessLocalKey()): ConversionPageReadiness | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = conversionPageReadinessSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeLocalPageReadiness(readiness: ConversionPageReadiness, storageKey = pageReadinessLocalKey()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(readiness));
}

/** Prefill anônimo a partir dos resultados locais das Aulas 1 e 2 (mesmo namespace de curso). */
export function conversionJourneyLocalPrefill(): z.infer<typeof pageReadinessContextSchema> {
  if (typeof window === "undefined") return {};
  try {
    const journeyRaw = window.localStorage.getItem(conversionJourneyLocalKey());
    const presenceRaw = window.localStorage.getItem(digitalPresenceLocalKey());
    const journey = journeyRaw ? conversionJourneyMapSchema.safeParse(JSON.parse(journeyRaw)) : null;
    const presence = presenceRaw ? digitalPresenceDecisionSchema.safeParse(JSON.parse(presenceRaw)) : null;
    return contextFromLessons({
      journey: journey?.success ? journey.data : null,
      presence: presence?.success ? presence.data : null,
    });
  } catch {
    return {};
  }
}
