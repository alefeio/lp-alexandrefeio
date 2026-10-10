export const DIAGNOSTIC_VERSION = "traffic-readiness-v1";
export const DIAGNOSTIC_TYPE = "traffic-readiness";
export const QUESTION_COUNT = 15;

export const DIMENSIONS = [
  "OBJECTIVE",
  "OFFER",
  "AUDIENCE",
  "DESTINATION",
  "MEASUREMENT",
  "OPERATIONS",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  OBJECTIVE: "Objetivo",
  OFFER: "Oferta",
  AUDIENCE: "Cliente",
  DESTINATION: "Destino",
  MEASUREMENT: "Mensuração",
  OPERATIONS: "Operação",
};

export const DIMENSION_WEIGHT: Record<Dimension, number> = {
  OBJECTIVE: 10,
  OFFER: 20,
  AUDIENCE: 10,
  DESTINATION: 20,
  MEASUREMENT: 20,
  OPERATIONS: 20,
};

/** Ordem de dependência: não tratar mensuração antes de existir objetivo e oferta. */
export const BOTTLENECK_ORDER: readonly Dimension[] = DIMENSIONS;

export type Option = { id: string; label: string; points: number };

export type Question = {
  id: string;
  dimension: Dimension;
  prompt: string;
  options: readonly Option[];
  note?: { key: "q5Note"; label: string };
};

export const QUESTIONS: readonly Question[] = [
  {
    id: "q1",
    dimension: "OBJECTIVE",
    prompt: "Qual é o principal resultado que você espera das campanhas?",
    options: [
      { id: "leads", label: "Receber contatos/leads", points: 2 },
      { id: "sales", label: "Vender diretamente", points: 2 },
      { id: "whatsapp", label: "Receber mensagens no WhatsApp", points: 2 },
      { id: "store", label: "Levar pessoas até uma loja/local", points: 2 },
      { id: "awareness", label: "Aumentar reconhecimento", points: 2 },
      { id: "unknown", label: "Ainda não sei", points: 0 },
    ],
  },
  {
    id: "q2",
    dimension: "OBJECTIVE",
    prompt: "Você consegue definir o que seria uma conversão para sua empresa?",
    options: [
      { id: "clear", label: "Sim, claramente", points: 2 },
      { id: "partial", label: "Tenho uma ideia, mas ainda não está bem definido", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
  },
  {
    id: "q3",
    dimension: "OFFER",
    prompt: "Você sabe exatamente qual produto ou serviço vai anunciar primeiro?",
    options: [
      { id: "yes", label: "Sim", points: 2 },
      { id: "several", label: "Tenho várias opções e ainda não escolhi", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
  },
  {
    id: "q4",
    dimension: "OFFER",
    prompt: "Sua oferta possui uma proposta clara para o cliente?",
    options: [
      { id: "yes", label: "Sim", points: 2 },
      { id: "partial", label: "Parcialmente", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
  },
  {
    id: "q5",
    dimension: "OFFER",
    prompt: "Você consegue explicar por que alguém deveria escolher sua empresa?",
    options: [
      { id: "clear", label: "Sim, de forma clara", points: 2 },
      { id: "partial", label: "Mais ou menos", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
    note: { key: "q5Note", label: "Descreva em uma frase, se quiser. Isso não entra na nota." },
  },
  {
    id: "q6",
    dimension: "AUDIENCE",
    prompt: "Você consegue descrever quem provavelmente compraria sua oferta?",
    options: [
      { id: "clear", label: "Sim, com boa clareza", points: 2 },
      { id: "partial", label: "Mais ou menos", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
  },
  {
    id: "q7",
    dimension: "AUDIENCE",
    prompt: "Seu cliente normalmente procura ativamente pelo que você vende ou precisa ser impactado pela oferta?",
    options: [
      { id: "searches", label: "Normalmente já procura", points: 2 },
      { id: "discovers", label: "Normalmente precisa descobrir", points: 2 },
      { id: "both", label: "Acontecem os dois", points: 2 },
      { id: "unknown", label: "Não sei", points: 0 },
    ],
  },
  {
    id: "q8",
    dimension: "DESTINATION",
    prompt: "Para onde a pessoa será enviada depois do anúncio?",
    options: [
      { id: "landing", label: "Landing page", points: 2 },
      { id: "website", label: "Site", points: 2 },
      { id: "whatsapp", label: "WhatsApp", points: 2 },
      { id: "instagram", label: "Instagram", points: 2 },
      { id: "marketplace", label: "Marketplace", points: 2 },
      { id: "other", label: "Outro", points: 2 },
      { id: "undefined", label: "Ainda não defini", points: 0 },
    ],
  },
  {
    id: "q9",
    dimension: "DESTINATION",
    prompt: "Esse destino apresenta claramente o que você oferece e o que a pessoa deve fazer?",
    options: [
      { id: "yes", label: "Sim", points: 2 },
      { id: "partial", label: "Parcialmente", points: 1 },
      { id: "no", label: "Não", points: 0 },
      { id: "unsure", label: "Não sei avaliar", points: 0 },
    ],
  },
  {
    id: "q10",
    dimension: "DESTINATION",
    prompt: "Você já testou esse destino no celular?",
    options: [
      { id: "works", label: "Sim e funciona bem", points: 2 },
      { id: "problems", label: "Sim, mas há problemas", points: 1 },
      { id: "no", label: "Não", points: 0 },
      { id: "missing", label: "Ainda não existe", points: 0 },
    ],
  },
  {
    id: "q11",
    dimension: "MEASUREMENT",
    prompt: "Você consegue saber quando um anúncio gera um contato ou venda?",
    options: [
      { id: "yes", label: "Sim", points: 2 },
      { id: "partial", label: "Parcialmente", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
  },
  {
    id: "q12",
    dimension: "MEASUREMENT",
    prompt: "Você possui alguma configuração de acompanhamento?",
    options: [
      { id: "google", label: "Google Ads / GA4", points: 1 },
      { id: "meta", label: "Meta Pixel", points: 1 },
      { id: "both", label: "Ambos", points: 2 },
      { id: "other", label: "Outro", points: 1 },
      { id: "none", label: "Não possuo", points: 0 },
      { id: "unknown", label: "Não sei", points: 0 },
    ],
  },
  {
    id: "q13",
    dimension: "OPERATIONS",
    prompt: "Quanto pretende investir inicialmente por mês em mídia?",
    options: [
      { id: "up-to-300", label: "Até R$ 300", points: 2 },
      { id: "301-600", label: "R$ 301 a R$ 600", points: 2 },
      { id: "601-1500", label: "R$ 601 a R$ 1.500", points: 2 },
      { id: "1501-3000", label: "R$ 1.501 a R$ 3.000", points: 2 },
      { id: "over-3000", label: "Mais de R$ 3.000", points: 2 },
      { id: "undefined", label: "Ainda não defini", points: 0 },
    ],
  },
  {
    id: "q14",
    dimension: "OPERATIONS",
    prompt: "Quando um lead chega, alguém consegue atendê-lo rapidamente?",
    options: [
      { id: "yes", label: "Sim", points: 2 },
      { id: "sometimes", label: "Às vezes", points: 1 },
      { id: "none", label: "Não existe processo definido", points: 0 },
    ],
  },
  {
    id: "q15",
    dimension: "OPERATIONS",
    prompt: "Você sabe aproximadamente quanto vale uma venda ou cliente para sua empresa?",
    options: [
      { id: "yes", label: "Sim", points: 2 },
      { id: "estimate", label: "Tenho uma estimativa", points: 1 },
      { id: "no", label: "Não", points: 0 },
    ],
  },
];

export const LESSON_BY_DIMENSION: Record<Dimension, string | null> = {
  OBJECTIVE: "objetivo-oferta-orcamento",
  OFFER: "objetivo-oferta-orcamento",
  AUDIENCE: "objetivo-publico-estrutura",
  DESTINATION: "destino-e-mensuracao",
  MEASUREMENT: "destino-e-mensuracao",
  OPERATIONS: null,
};
