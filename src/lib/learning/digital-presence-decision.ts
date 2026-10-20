import { z } from "zod";
import {
  PRIMARY_ACTIONS,
  PRIMARY_ACTION_LABELS,
  TRAFFIC_SOURCES,
  TRAFFIC_SOURCE_LABELS,
  conversionJourneyLocalKey,
  conversionJourneyMapSchema,
  type ConversionJourneyMap,
} from "@/lib/learning/conversion-journey-map";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export const DIGITAL_PRESENCE_DECISION_TOOL = "DIGITAL_PRESENCE_DECISION_V1" as const;
export const SITE_LANDING_WHATSAPP_SLUG = "site-landing-page-ou-whatsapp";

export const OFFER_COUNTS = ["ONE", "FEW", "MANY", "UNKNOWN"] as const;
export const NEED_LEVELS = ["LOW", "MEDIUM", "HIGH", "UNKNOWN"] as const;
export const CURRENT_STRUCTURES = [
  "NO_STRUCTURE",
  "WEBSITE",
  "LANDING_PAGE",
  "WHATSAPP_ONLY",
  "SOCIAL_ONLY",
  "MIXED",
  "OTHER",
  "UNKNOWN",
] as const;
export const RECOMMENDED_STRUCTURES = [
  "LANDING_PAGE",
  "INSTITUTIONAL_SITE",
  "SERVICE_PAGE",
  "WHATSAPP_FIRST",
  "MIXED",
  "NEEDS_MORE_CONTEXT",
] as const;
export const SECONDARY_STRUCTURES = ["LANDING_PAGE", "INSTITUTIONAL_SITE", "SERVICE_PAGE", "WHATSAPP", "MIXED"] as const;
export const CONFIDENCE_LEVELS = ["STRONG", "MODERATE", "LIMITED"] as const;

export const OFFER_COUNT_LABELS: Record<(typeof OFFER_COUNTS)[number], string> = {
  ONE: "Uma oferta principal",
  FEW: "Poucas ofertas",
  MANY: "Várias ofertas",
  UNKNOWN: "Ainda não sei",
};

export const NEED_LEVEL_LABELS: Record<(typeof NEED_LEVELS)[number], string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  UNKNOWN: "Ainda não sei",
};

export const CURRENT_STRUCTURE_LABELS: Record<(typeof CURRENT_STRUCTURES)[number], string> = {
  NO_STRUCTURE: "Ainda não tenho estrutura",
  WEBSITE: "Site",
  LANDING_PAGE: "Landing page",
  WHATSAPP_ONLY: "Só WhatsApp",
  SOCIAL_ONLY: "Só redes sociais",
  MIXED: "Combinação",
  OTHER: "Outra",
  UNKNOWN: "Ainda não sei",
};

export const RECOMMENDED_STRUCTURE_LABELS: Record<(typeof RECOMMENDED_STRUCTURES)[number], string> = {
  LANDING_PAGE: "Landing page",
  INSTITUTIONAL_SITE: "Site institucional",
  SERVICE_PAGE: "Página de serviço",
  WHATSAPP_FIRST: "WhatsApp como estrutura principal",
  MIXED: "Combinação de estruturas",
  NEEDS_MORE_CONTEXT: "Ainda falta contexto para decidir",
};

export const SECONDARY_STRUCTURE_LABELS: Record<(typeof SECONDARY_STRUCTURES)[number], string> = {
  LANDING_PAGE: "Landing page",
  INSTITUTIONAL_SITE: "Site institucional",
  SERVICE_PAGE: "Páginas de serviço",
  WHATSAPP: "WhatsApp",
  MIXED: "Combinação",
};

export const CONFIDENCE_LABELS: Record<(typeof CONFIDENCE_LEVELS)[number], string> = {
  STRONG: "Alta consistência das informações",
  MODERATE: "Consistência moderada",
  LIMITED: "Informações ainda limitadas",
};

const inputsSchema = z
  .object({
    offer: z.string().trim().min(1).max(160),
    numberOfOffers: z.enum(OFFER_COUNTS),
    explanationNeed: z.enum(NEED_LEVELS),
    trustNeed: z.enum(NEED_LEVELS),
    trafficSources: z.array(z.enum(TRAFFIC_SOURCES)).min(1).max(8),
    primaryAction: z.enum(PRIMARY_ACTIONS),
    currentStructure: z.enum(CURRENT_STRUCTURES),
    contentNeed: z.enum(NEED_LEVELS),
  })
  .strict();

export const digitalPresenceDecisionSchema = z
  .object({
    offer: z.string().trim().min(1).max(160),
    inputs: inputsSchema,
    recommendedStructure: z.enum(RECOMMENDED_STRUCTURES),
    secondaryStructures: z.array(z.enum(SECONDARY_STRUCTURES)).max(3),
    reasons: z.array(z.string().trim().min(1).max(280)).min(1).max(5),
    caveats: z.array(z.string().trim().min(1).max(280)).max(4),
    confidenceLevel: z.enum(CONFIDENCE_LEVELS),
    nextStep: z.string().trim().min(1).max(280),
  })
  .strict();

export type DigitalPresenceDecision = z.infer<typeof digitalPresenceDecisionSchema>;
export type DigitalPresenceInputs = z.infer<typeof inputsSchema>;

export const digitalPresenceResponseSchema = z
  .object({
    kind: z.enum(["personal", "project"]),
    projectId: z.string().trim().min(1).max(80).optional().nullable(),
    decision: digitalPresenceDecisionSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "project" && !value.projectId) {
      ctx.addIssue({ code: "custom", path: ["projectId"], message: "Escolha um projeto." });
    }
  });

export type DigitalPresenceResponse = z.infer<typeof digitalPresenceResponseSchema>;

export function digitalPresenceLocalKey(courseSlug = SITES_COURSE_SLUG, lessonSlug = SITE_LANDING_WHATSAPP_SLUG): string {
  return `af_${courseSlug}_${lessonSlug}_digital_presence_decision_v1`;
}

export function parseDigitalPresenceForm(input: {
  offer: string;
  numberOfOffers: string;
  explanationNeed: string;
  trustNeed: string;
  trafficSources: string[];
  primaryAction: string;
  currentStructure: string;
  contentNeed: string;
  projectId?: string;
}): { ok: true; decision: DigitalPresenceDecision; projectId: string | null } | { ok: false; message: string } {
  const inputs = inputsSchema.safeParse({
    offer: input.offer,
    numberOfOffers: input.numberOfOffers,
    explanationNeed: input.explanationNeed,
    trustNeed: input.trustNeed,
    trafficSources: input.trafficSources,
    primaryAction: input.primaryAction,
    currentStructure: input.currentStructure,
    contentNeed: input.contentNeed,
  });
  if (!inputs.success) return { ok: false, message: "Revise os campos da decisão." };
  const decision = decideDigitalPresence(inputs.data);
  const checked = digitalPresenceDecisionSchema.safeParse(decision);
  if (!checked.success) return { ok: false, message: "Não foi possível montar a recomendação." };
  return { ok: true, decision: checked.data, projectId: input.projectId?.trim() || null };
}

export type PresenceScores = {
  landing: number;
  institutional: number;
  service: number;
  whatsapp: number;
  mixed: number;
};

/** Regras determinísticas e explicáveis — sem LLM e sem score opaco final. */
export function decideDigitalPresence(inputs: DigitalPresenceInputs): DigitalPresenceDecision {
  const unknownCore =
    inputs.numberOfOffers === "UNKNOWN" ||
    inputs.explanationNeed === "UNKNOWN" ||
    inputs.trustNeed === "UNKNOWN" ||
    inputs.trafficSources.includes("UNKNOWN") ||
    inputs.trafficSources.length === 0;

  if (unknownCore) {
    return {
      offer: inputs.offer,
      inputs,
      recommendedStructure: "NEEDS_MORE_CONTEXT",
      secondaryStructures: [],
      reasons: [
        "Algumas informações essenciais ainda estão indefinidas.",
        "Sem esse contexto, qualquer escolha de estrutura ficaria forçada.",
      ],
      caveats: ["Revise as respostas UNKNOWN ou complete o mapa da Aula 1 para decidir com mais segurança."],
      confidenceLevel: "LIMITED",
      nextStep: "Esclareça ofertas, necessidade de explicação e confiança antes de investir em uma estrutura.",
    };
  }

  const scores: PresenceScores = { landing: 0, institutional: 0, service: 0, whatsapp: 0, mixed: 0 };
  const reasons: string[] = [];
  const caveats: string[] = [];
  const secondary = new Set<(typeof SECONDARY_STRUCTURES)[number]>();

  if (inputs.numberOfOffers === "ONE") {
    scores.landing += 3;
    scores.whatsapp += 1;
    reasons.push("Você quer promover uma oferta principal, o que favorece uma estrutura mais focada.");
  }
  if (inputs.numberOfOffers === "FEW") {
    scores.institutional += 2;
    scores.service += 2;
    scores.mixed += 2;
    reasons.push("Poucas ofertas ainda pedem clareza por oferta, sem necessariamente uma presença enorme.");
  }
  if (inputs.numberOfOffers === "MANY") {
    scores.institutional += 4;
    scores.service += 3;
    scores.mixed += 3;
    scores.landing -= 1;
    reasons.push("Várias ofertas pedem uma arquitetura em que o visitante possa explorar o que faz sentido para ele.");
  }

  if (inputs.explanationNeed === "LOW") {
    scores.whatsapp += 3;
    scores.landing += 1;
  }
  if (inputs.explanationNeed === "MEDIUM") {
    scores.landing += 2;
    scores.service += 2;
    scores.mixed += 1;
    reasons.push("O visitante precisa de algum contexto antes de agir, então a página ajuda a preparar essa decisão.");
  }
  if (inputs.explanationNeed === "HIGH") {
    scores.institutional += 3;
    scores.service += 3;
    scores.landing += 1;
    scores.whatsapp -= 3;
    reasons.push("Quanto mais a pessoa precisa entender antes de agir, mais importante fica a estrutura que prepara essa decisão.");
  }

  if (inputs.trustNeed === "LOW") scores.whatsapp += 1;
  if (inputs.trustNeed === "MEDIUM") {
    scores.service += 1;
    scores.landing += 1;
    scores.institutional += 1;
  }
  if (inputs.trustNeed === "HIGH") {
    scores.institutional += 3;
    scores.service += 2;
    scores.mixed += 2;
    scores.whatsapp -= 3;
    reasons.push("A decisão exige demonstrar confiança antes do pedido de ação.");
  }

  if (inputs.contentNeed === "HIGH") {
    scores.institutional += 3;
    scores.mixed += 1;
    reasons.push("Há necessidade de apresentar informações e conteúdos variados ao longo do tempo.");
  }
  if (inputs.contentNeed === "MEDIUM") scores.institutional += 1;

  const focusedSource = inputs.trafficSources.some((source) => source === "GOOGLE_ADS" || source === "META_ADS" || source === "GOOGLE_ORGANIC");
  if (focusedSource && inputs.numberOfOffers === "ONE") {
    scores.landing += 2;
    reasons.push("A origem e a oferta apontam para uma mensagem concentrada em torno de um próximo passo.");
  }

  const chatAction = inputs.primaryAction === "WHATSAPP" || inputs.primaryAction === "CONTACT" || inputs.primaryAction === "CALL";
  if (chatAction) {
    scores.whatsapp += 2;
    secondary.add("WHATSAPP");
  }
  if (inputs.primaryAction === "FORM_SUBMIT" || inputs.primaryAction === "QUOTE_REQUEST" || inputs.primaryAction === "BOOKING" || inputs.primaryAction === "PURCHASE" || inputs.primaryAction === "SIGN_UP") {
    scores.landing += 1;
    scores.service += 1;
  }

  if (inputs.currentStructure === "WEBSITE" || inputs.currentStructure === "MIXED") {
    scores.service += 2;
    scores.institutional += 1;
    secondary.add("SERVICE_PAGE");
  }
  if (inputs.currentStructure === "WHATSAPP_ONLY" && (inputs.explanationNeed === "HIGH" || inputs.trustNeed === "HIGH")) {
    scores.mixed += 2;
    caveats.push("Mandar todo mundo direto ao WhatsApp pode fazer a conversa carregar explicações que uma página poderia preparar antes.");
  }

  if (inputs.explanationNeed === "HIGH" || inputs.trustNeed === "HIGH") {
    scores.whatsapp = Math.min(scores.whatsapp, 1);
  }

  const complementary =
    (scores.institutional >= 3 && (chatAction || scores.service >= 2)) ||
    (scores.landing >= 3 && chatAction) ||
    (scores.service >= 3 && scores.institutional >= 2);
  if (complementary) {
    scores.mixed += 3;
  }

  type Candidate = { key: DigitalPresenceDecision["recommendedStructure"]; score: number };
  const candidates: Candidate[] = [
    { key: "LANDING_PAGE", score: scores.landing },
    { key: "INSTITUTIONAL_SITE", score: scores.institutional },
    { key: "SERVICE_PAGE", score: scores.service },
    { key: "WHATSAPP_FIRST", score: scores.whatsapp },
    { key: "MIXED", score: scores.mixed },
  ];
  candidates.sort((a, b) => b.score - a.score);
  let recommended = candidates[0]!.key;
  const top = candidates[0]!.score;
  const second = candidates[1]?.score ?? 0;

  if (recommended === "WHATSAPP_FIRST" && (inputs.explanationNeed === "HIGH" || inputs.trustNeed === "HIGH")) {
    recommended = scores.mixed >= scores.landing ? "MIXED" : "LANDING_PAGE";
    caveats.push("WhatsApp sozinho tende a ficar frágil quando a pessoa ainda precisa de muita explicação ou confiança.");
  }

  if (recommended === "SERVICE_PAGE" && inputs.currentStructure !== "WEBSITE" && inputs.currentStructure !== "MIXED") {
    if (scores.institutional >= scores.landing) {
      recommended = "INSTITUTIONAL_SITE";
      secondary.add("SERVICE_PAGE");
    } else {
      recommended = "LANDING_PAGE";
    }
  }

  if (recommended === "INSTITUTIONAL_SITE") {
    if (inputs.numberOfOffers === "ONE" || inputs.numberOfOffers === "FEW") secondary.add("SERVICE_PAGE");
    if (chatAction) secondary.add("WHATSAPP");
  }
  if (recommended === "LANDING_PAGE" && chatAction) secondary.add("WHATSAPP");
  if (recommended === "MIXED") {
    if (scores.institutional >= scores.landing) {
      secondary.add("INSTITUTIONAL_SITE");
      secondary.add("SERVICE_PAGE");
    } else {
      secondary.add("LANDING_PAGE");
    }
    if (chatAction) secondary.add("WHATSAPP");
  }
  if (recommended === "WHATSAPP_FIRST" && inputs.explanationNeed !== "LOW") {
    secondary.add("LANDING_PAGE");
  }

  const uniqueReasons = [...new Set(reasons)].slice(0, 4);
  if (uniqueReasons.length === 0) {
    uniqueReasons.push("A recomendação segue o equilíbrio entre oferta, contexto necessário e ação desejada.");
  }

  if (recommended === "LANDING_PAGE") {
    uniqueReasons.unshift("Faz mais sentido concentrar a mensagem em torno de uma oferta e uma ação principal.");
  } else if (recommended === "INSTITUTIONAL_SITE") {
    uniqueReasons.unshift("Uma presença com várias páginas tende a oferecer estrutura mais adequada para explorar ofertas e confiança.");
  } else if (recommended === "SERVICE_PAGE") {
    uniqueReasons.unshift("Uma página de serviço ajuda a dar mensagem específica sem abandonar a estrutura maior.");
  } else if (recommended === "WHATSAPP_FIRST") {
    uniqueReasons.unshift("No cenário informado, a conversa pode ser o principal ponto de avanço.");
  } else if (recommended === "MIXED") {
    uniqueReasons.unshift("Estruturas complementares tendem a sustentar melhor a jornada do que uma escolha isolada.");
  }

  const knownAnswers = [inputs.numberOfOffers, inputs.explanationNeed, inputs.trustNeed, inputs.contentNeed].filter((value) => value !== "UNKNOWN").length;
  const confidenceLevel: DigitalPresenceDecision["confidenceLevel"] =
    knownAnswers >= 4 && top >= second + 2 ? "STRONG" : knownAnswers >= 3 ? "MODERATE" : "LIMITED";

  const secondaryStructures = [...secondary]
    .filter((item) => {
      if (recommended === "LANDING_PAGE" && item === "LANDING_PAGE") return false;
      if (recommended === "INSTITUTIONAL_SITE" && item === "INSTITUTIONAL_SITE") return false;
      if (recommended === "SERVICE_PAGE" && item === "SERVICE_PAGE") return false;
      if (recommended === "WHATSAPP_FIRST" && item === "WHATSAPP") return false;
      if (recommended === "MIXED" && item === "MIXED") return false;
      return true;
    })
    .slice(0, 3);

  return {
    offer: inputs.offer,
    inputs,
    recommendedStructure: recommended,
    secondaryStructures,
    reasons: [...new Set(uniqueReasons)].slice(0, 4),
    caveats: [...new Set(caveats)].slice(0, 3),
    confidenceLevel,
    nextStep: "Na próxima aula, avalie se a página escolhida está pronta para converter.",
  };
}

export function prefillFromJourneyMap(map: ConversionJourneyMap): Partial<DigitalPresenceInputs> & { offer: string } {
  return {
    offer: map.offer,
    trafficSources: [map.trafficSource],
    primaryAction: map.primaryAction,
  };
}

/** Prefill anônimo: lê o mapa da Aula 1 no localStorage do mesmo namespace de curso. */
export function anonymousJourneyPrefill(): Partial<DigitalPresenceInputs> & { offer?: string } {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(conversionJourneyLocalKey());
    if (!raw) return {};
    const parsed = conversionJourneyMapSchema.safeParse(JSON.parse(raw));
    return parsed.success ? prefillFromJourneyMap(parsed.data) : {};
  } catch {
    return {};
  }
}

export function readLocalDigitalPresence(storageKey = digitalPresenceLocalKey()): DigitalPresenceDecision | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = digitalPresenceDecisionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeLocalDigitalPresence(decision: DigitalPresenceDecision, storageKey = digitalPresenceLocalKey()): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(decision));
}

export function sourceLabels(sources: DigitalPresenceInputs["trafficSources"]): string {
  return sources.map((source) => TRAFFIC_SOURCE_LABELS[source]).join(", ");
}

export function actionLabel(action: DigitalPresenceInputs["primaryAction"]): string {
  return PRIMARY_ACTION_LABELS[action];
}
