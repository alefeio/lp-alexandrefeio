import { z } from "zod";
import {
  BOTTLENECK_ORDER,
  DIAGNOSTIC_VERSION,
  DIMENSIONS,
  DIMENSION_LABEL,
  DIMENSION_WEIGHT,
  LESSON_BY_DIMENSION,
  QUESTIONS,
  type Dimension,
  type Question,
} from "@/lib/diagnostic/definition";

const choice = (question: Question) => z.enum(question.options.map((option) => option.id) as [string, ...string[]]);

export const answersSchema = z
  .object({
    q1: choice(QUESTIONS[0]).optional(),
    q2: choice(QUESTIONS[1]).optional(),
    q3: choice(QUESTIONS[2]).optional(),
    q4: choice(QUESTIONS[3]).optional(),
    q5: choice(QUESTIONS[4]).optional(),
    q5Note: z.string().trim().max(280).optional(),
    q6: choice(QUESTIONS[5]).optional(),
    q7: choice(QUESTIONS[6]).optional(),
    q8: choice(QUESTIONS[7]).optional(),
    q9: choice(QUESTIONS[8]).optional(),
    q10: choice(QUESTIONS[9]).optional(),
    q11: choice(QUESTIONS[10]).optional(),
    q12: choice(QUESTIONS[11]).optional(),
    q13: choice(QUESTIONS[12]).optional(),
    q14: choice(QUESTIONS[13]).optional(),
    q15: choice(QUESTIONS[14]).optional(),
  })
  .strict();

export type DiagnosticAnswers = z.infer<typeof answersSchema>;

export type ResultBand = "ready" | "base" | "incomplete" | "foundations";
export type ChannelHint = "google" | "meta" | "both" | "none";

export type DiagnosticResult = {
  version: typeof DIAGNOSTIC_VERSION;
  overallScore: number;
  band: ResultBand;
  bandLabel: string;
  dimensionScores: Record<Dimension, number>;
  primaryBottleneck: Dimension | null;
  strengths: Dimension[];
  attention: Dimension[];
  channelHint: ChannelHint;
  channelExplanation: string;
  nextStepTitle: string;
  nextStepDescription: string;
  recommendationType: "LEARN" | "EXECUTE" | "ANALYZE" | "WAIT";
  recommendationPriority: "HIGH" | "MEDIUM" | "LOW";
  lessonSlug: string | null;
};

const SCORED_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13", "q14", "q15"] as const;

export function parseAnswers(value: unknown): DiagnosticAnswers | null {
  const parsed = answersSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function answersComplete(answers: DiagnosticAnswers): boolean {
  return SCORED_KEYS.every((key) => Boolean(answers[key]));
}

function pointsFor(question: Question, answers: DiagnosticAnswers): number {
  const selected = answers[question.id as keyof DiagnosticAnswers];
  const option = question.options.find((item) => item.id === selected);
  return option?.points ?? 0;
}

function dimensionPoints(dimension: Dimension, answers: DiagnosticAnswers) {
  const questions = QUESTIONS.filter((question) => question.dimension === dimension);
  const earned = questions.reduce((sum, question) => sum + pointsFor(question, answers), 0);
  const max = questions.reduce((sum, question) => sum + Math.max(...question.options.map((option) => option.points)), 0);
  return { earned, max };
}

/** Pontos da dimensão / máximo, em inteiro de 0 a 100. `Math.round` arredonda metade para cima. */
export function dimensionScore(dimension: Dimension, answers: DiagnosticAnswers): number {
  const { earned, max } = dimensionPoints(dimension, answers);
  if (max <= 0) return 0;
  return Math.round((earned / max) * 100);
}

/**
 * Soma ponderada das notas já arredondadas.
 * Pesos em inteiros (10, 20, 10, 20, 20, 20) e `Math.round(soma / 100)`.
 */
export function overallScore(scores: Record<Dimension, number>): number {
  const weighted = DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension] * DIMENSION_WEIGHT[dimension], 0);
  return Math.round(weighted / 100);
}

export function scoreBand(score: number): { band: ResultBand; bandLabel: string } {
  if (score >= 80) return { band: "ready", bandLabel: "Boa prontidão, com ajustes pontuais." };
  if (score >= 60) return { band: "base", bandLabel: "Boa base, mas há pontos importantes antes de escalar." };
  if (score >= 40) return { band: "incomplete", bandLabel: "Preparação incompleta." };
  return { band: "foundations", bandLabel: "Há fundamentos importantes para resolver antes de investir mais." };
}

export function isCritical(dimension: Dimension, answers: DiagnosticAnswers): boolean {
  if (dimension === "OBJECTIVE") return answers.q1 === "unknown" || answers.q2 === "no";
  if (dimension === "OFFER") return answers.q3 === "no";
  if (dimension === "AUDIENCE") return answers.q6 === "no";
  if (dimension === "DESTINATION") return answers.q8 === "undefined" || answers.q9 === "no" || answers.q9 === "unsure";
  if (dimension === "MEASUREMENT") return answers.q11 === "no" || answers.q12 === "none" || answers.q12 === "unknown";
  return answers.q14 === "none";
}

export function primaryBottleneck(answers: DiagnosticAnswers, scores: Record<Dimension, number>): Dimension | null {
  for (const dimension of BOTTLENECK_ORDER) {
    if (isCritical(dimension, answers)) return dimension;
  }
  const weakest = [...BOTTLENECK_ORDER].sort((a, b) => scores[a] - scores[b] || BOTTLENECK_ORDER.indexOf(a) - BOTTLENECK_ORDER.indexOf(b))[0];
  if (!weakest || scores[weakest] >= 80) return null;
  return weakest;
}

const NEXT_STEP: Record<Dimension, { title: string; description: string; type: DiagnosticResult["recommendationType"] }> = {
  OBJECTIVE: {
    title: "Defina o objetivo principal da campanha.",
    description: "Escolha um resultado principal antes de aumentar o investimento.",
    type: "EXECUTE",
  },
  OFFER: {
    title: "Estruture uma oferta clara antes de anunciar.",
    description: "Escolha o que vai anunciar primeiro e deixe a proposta clara para o cliente.",
    type: "EXECUTE",
  },
  AUDIENCE: {
    title: "Descreva o cliente com maior chance de comprar sua oferta.",
    description: "Escreva quem provavelmente compra e o que essa pessoa já procura.",
    type: "EXECUTE",
  },
  DESTINATION: {
    title: "Prepare o destino e a mensuração.",
    description: "Defina para onde o clique vai e se a pessoa entende o que fazer ali.",
    type: "LEARN",
  },
  MEASUREMENT: {
    title: "Prepare o destino e a mensuração.",
    description: "Configure como os contatos serão medidos antes de aumentar o investimento.",
    type: "LEARN",
  },
  OPERATIONS: {
    title: "Organize o processo de atendimento antes de aumentar o tráfego.",
    description: "Combine quem atende o contato e em quanto tempo.",
    type: "EXECUTE",
  },
};

export function channelHint(answers: DiagnosticAnswers): { hint: ChannelHint; explanation: string } {
  const base =
    "A indicação é inicial. O canal também depende do mercado, do orçamento e da oferta.";
  const whatsapp = answers.q1 === "whatsapp" ? " Objetivo no WhatsApp não escolhe o canal sozinho." : "";
  if (answers.q7 === "searches") {
    return { hint: "google", explanation: `Indicação inicial: Google Ads tende a ser um bom ponto de partida, porque o cliente já procura o que você vende. ${base}${whatsapp}` };
  }
  if (answers.q7 === "discovers") {
    return { hint: "meta", explanation: `Indicação inicial: Meta Ads tende a ser um bom ponto de partida, porque o cliente ainda precisa descobrir a oferta. ${base}${whatsapp}` };
  }
  if (answers.q7 === "both") {
    return { hint: "both", explanation: `Indicação inicial: Google Ads e Meta Ads podem fazer sentido. ${base}${whatsapp}` };
  }
  return { hint: "none", explanation: `Ainda não há indicação de canal. Primeiro vale esclarecer como o cliente encontra a oferta. ${base}${whatsapp}` };
}

export function scoreDiagnostic(answers: DiagnosticAnswers): DiagnosticResult {
  const dimensionScores = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, dimensionScore(dimension, answers)])) as Record<Dimension, number>;
  const score = overallScore(dimensionScores);
  const band = scoreBand(score);
  const bottleneck = primaryBottleneck(answers, dimensionScores);
  const channel = channelHint(answers);
  const step = bottleneck ? NEXT_STEP[bottleneck] : null;
  const critical = bottleneck ? isCritical(bottleneck, answers) : false;

  return {
    version: DIAGNOSTIC_VERSION,
    overallScore: score,
    band: band.band,
    bandLabel: band.bandLabel,
    dimensionScores,
    primaryBottleneck: bottleneck,
    strengths: DIMENSIONS.filter((dimension) => dimensionScores[dimension] >= 80 && dimension !== bottleneck),
    attention: DIMENSIONS.filter((dimension) => dimensionScores[dimension] < 60 && dimension !== bottleneck),
    channelHint: channel.hint,
    channelExplanation: channel.explanation,
    nextStepTitle: step?.title ?? "Siga com ajustes pontuais.",
    nextStepDescription: step?.description ?? "Não há um gargalo crítico neste diagnóstico. Revise o que ainda está abaixo de uma base sólida antes de escalar.",
    recommendationType: step?.type ?? "WAIT",
    recommendationPriority: critical ? "HIGH" : bottleneck ? "MEDIUM" : "LOW",
    lessonSlug: bottleneck ? LESSON_BY_DIMENSION[bottleneck] : null,
  };
}

export function dimensionLabel(dimension: Dimension | null): string {
  return dimension ? DIMENSION_LABEL[dimension] : "Nenhum gargalo crítico";
}

export function knownDimension(value: string | null | undefined): Dimension | null {
  return DIMENSIONS.includes(value as Dimension) ? (value as Dimension) : null;
}

export function optionLabel(questionId: string, optionId: string | undefined): string {
  const question = QUESTIONS.find((item) => item.id === questionId);
  return question?.options.find((option) => option.id === optionId)?.label ?? "Sem resposta";
}

export const resultSnapshotSchema = z
  .object({
    version: z.literal(DIAGNOSTIC_VERSION),
    overallScore: z.number().int().min(0).max(100),
    band: z.enum(["ready", "base", "incomplete", "foundations"]),
    bandLabel: z.string().min(1).max(180),
    dimensionScores: z.object({
      OBJECTIVE: z.number().int().min(0).max(100),
      OFFER: z.number().int().min(0).max(100),
      AUDIENCE: z.number().int().min(0).max(100),
      DESTINATION: z.number().int().min(0).max(100),
      MEASUREMENT: z.number().int().min(0).max(100),
      OPERATIONS: z.number().int().min(0).max(100),
    }),
    primaryBottleneck: z.enum(DIMENSIONS).nullable(),
    strengths: z.array(z.enum(DIMENSIONS)),
    attention: z.array(z.enum(DIMENSIONS)),
    channelHint: z.enum(["google", "meta", "both", "none"]),
    channelExplanation: z.string().min(1).max(500),
    nextStepTitle: z.string().min(1).max(180),
    nextStepDescription: z.string().min(1).max(400),
    recommendationType: z.enum(["LEARN", "EXECUTE", "ANALYZE", "WAIT"]),
    recommendationPriority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    lessonSlug: z.string().max(80).nullable(),
  })
  .strict();
