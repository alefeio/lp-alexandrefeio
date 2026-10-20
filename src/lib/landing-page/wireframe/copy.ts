export const WIREFRAME_REASON_CODES = [
  "HERO_OFFER_AND_ACTION",
  "PROBLEM_EXPLANATION_NEED",
  "SOLUTION_CONNECTS_OFFER",
  "BENEFITS_CLARIFY_VALUE",
  "PROCESS_NEEDS_EXPLANATION",
  "PROCESS_HIGH_COMPLEXITY",
  "HIGH_TRUST_NEED",
  "MEDIUM_TRUST_NEED",
  "NEEDS_REAL_PROOF",
  "HAS_OBJECTIONS",
  "HIGH_EXPLANATION_NEED",
  "HIGH_DECISION_COMPLEXITY",
  "FORM_PRIMARY_ACTION",
  "CONVERSATIONAL_PRIMARY_ACTION",
  "CONTACT_IMPORTANCE",
  "CLOSING_ACTION",
  "FOOTER_REQUIRED",
] as const;

export type WireframeReasonCode = (typeof WIREFRAME_REASON_CODES)[number];

export const WIREFRAME_REASON_TEXT: Record<WireframeReasonCode, string> = {
  HERO_OFFER_AND_ACTION: "A página precisa abrir com a oferta e a ação principal que você definiu.",
  PROBLEM_EXPLANATION_NEED: "Você informou que o visitante precisa entender o contexto antes de avançar.",
  SOLUTION_CONNECTS_OFFER: "A oferta precisa aparecer ligada ao problema, sem uma promessa solta.",
  BENEFITS_CLARIFY_VALUE: "A oferta precisa ser entendida pelo valor, e esses pontos ainda serão escritos por você.",
  PROCESS_NEEDS_EXPLANATION: "Você informou que o funcionamento precisa ser explicado.",
  PROCESS_HIGH_COMPLEXITY: "Você informou que a decisão é complexa, então o caminho precisa ficar visível.",
  HIGH_TRUST_NEED: "Você informou que a decisão exige alto nível de confiança.",
  MEDIUM_TRUST_NEED: "Você informou que a confiança pesa na decisão, mesmo sem ser o único fator.",
  NEEDS_REAL_PROOF: "A página reserva espaço para prova, e você ainda precisa adicionar provas reais.",
  HAS_OBJECTIONS: "Você informou objeções que a página precisa endereçar.",
  HIGH_EXPLANATION_NEED: "Você informou alta necessidade de explicação antes da ação.",
  HIGH_DECISION_COMPLEXITY: "Você informou que a decisão é complexa e pede esclarecimento.",
  FORM_PRIMARY_ACTION: "A ação principal é um formulário, então a captura fica na própria página.",
  CONVERSATIONAL_PRIMARY_ACTION: "A ação principal é uma conversa, então o contato fica explícito.",
  CONTACT_IMPORTANCE: "Você informou que o canal de contato importa nesta página.",
  CLOSING_ACTION: "A página fecha com um convite único para a ação principal, separado do hero.",
  FOOTER_REQUIRED: "O rodapé fecha a página com a identificação do negócio, ainda por preencher.",
};

export const WIREFRAME_PURPOSE: Record<string, string> = {
  HERO: "Apresentar a oferta e a ação principal.",
  PROBLEM: "Ajudar o visitante a reconhecer o problema real.",
  SOLUTION: "Conectar a oferta ao problema informado.",
  BENEFITS: "Organizar o valor da oferta em pontos que você vai escrever.",
  PROCESS: "Mostrar como o trabalho acontece.",
  TRUST: "Reduzir insegurança antes do contato.",
  FAQ: "Reservar espaço para as dúvidas reais.",
  FORM: "Capturar o contato combinado com a ação principal.",
  CTA: "Convidar para a ação principal perto do fim da página.",
  CONTACT: "Mostrar os canais reais de contato.",
  FOOTER: "Encerrar a página com a identificação do negócio.",
};

export const WIREFRAME_WARNING_CODES = ["NEEDS_MORE_CONTEXT", "ADD_REAL_PROOF", "PARTIAL_CONTEXT"] as const;
export type WireframeWarningCode = (typeof WIREFRAME_WARNING_CODES)[number];

export const WIREFRAME_WARNING_TEXT: Record<WireframeWarningCode, string> = {
  NEEDS_MORE_CONTEXT: "Precisamos de mais contexto para recomendar uma estrutura mais específica.",
  ADD_REAL_PROOF: "Adicione provas reais. Esta estrutura não cria depoimentos, clientes ou números.",
  PARTIAL_CONTEXT: "Parte do contexto ainda está em aberto. A estrutura pode ser refinada quando você completar as respostas.",
};

export const WIREFRAME_RATIONALE_CODES = [
  "STRATEGY_FOCUSED",
  "STRATEGY_EXPLANATORY",
  "STRATEGY_TRUST_HEAVY",
  "STRATEGY_CONVERSATIONAL",
  "STRATEGY_BALANCED",
  "STRATEGY_LIMITED_CONTEXT",
] as const;

export type WireframeRationaleCode = (typeof WIREFRAME_RATIONALE_CODES)[number];

export const WIREFRAME_RATIONALE_TEXT: Record<WireframeRationaleCode, string> = {
  STRATEGY_FOCUSED: "A oferta está específica, a explicação é baixa e a decisão é simples, então a página fica curta.",
  STRATEGY_EXPLANATORY: "A explicação ou a complexidade da decisão pedem uma página que mostre o caminho.",
  STRATEGY_TRUST_HEAVY: "A confiança é o sinal dominante, então a prova fica antes da ação.",
  STRATEGY_CONVERSATIONAL: "A ação principal é uma conversa e a página não precisa de uma explicação longa.",
  STRATEGY_BALANCED: "Nenhum sinal isolado domina, então a estrutura equilibra entendimento, valor e ação.",
  STRATEGY_LIMITED_CONTEXT: "O contexto informado não basta para uma estrutura específica.",
};

export const WIREFRAME_PLACEHOLDERS = {
  heroHeadline: "Defina a principal promessa desta página",
  heroSubheadline: "Descreva para quem é esta oferta e qual é o próximo passo.",
  problemHeading: "Explique o problema que esta oferta ajuda a resolver",
  problemDescription: "Use apenas o contexto real do seu negócio. Não invente uma dor.",
  solutionHeading: "Apresente a solução que você oferece",
  solutionDescription: "Conecte a oferta ao problema, sem afirmações que você ainda não confirmou.",
  benefitsHeading: "Adicione benefícios reais da sua oferta",
  benefitsItemTitle: "Benefício a definir",
  benefitsItemDescription: "Descreva um resultado real, sem inventar números ou promessas.",
  processHeading: "Explique como funciona",
  processStepTitle: "Etapa a definir",
  processStepDescription: "Descreva um passo real do seu processo.",
  trustHeading: "Adicione provas reais",
  trustIntro: "Inclua apenas provas que você possa comprovar.",
  faqHeading: "Responda as dúvidas reais",
  faqQuestion: "Qual objeção você precisa responder?",
  faqAnswer: "Escreva a resposta com base no que o visitante realmente pergunta.",
  formHeading: "Peça apenas o contato necessário",
  formIntro: "Explique o que acontece depois do envio.",
  formConsent: "Explique como estes dados serão usados antes de pedir o envio.",
  ctaHeading: "Defina o convite para a ação principal",
  ctaDescription: "O visitante precisa saber qual é o próximo passo.",
  contactHeading: "Informe os canais reais de contato",
  footerBrand: "Nome do negócio",
  footerCopyright: "Complete o rodapé com as informações reais.",
  actionLabel: "Defina a ação principal",
} as const;
