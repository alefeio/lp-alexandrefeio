import type { LessonBlockData } from "@/lib/learning/blocks";
import { CONVERSION_PAGE_READINESS_TOOL, SITE_PAGE_READINESS_SLUG } from "@/lib/learning/conversion-page-readiness";

export const SITE_LESSON_03_SLUG = SITE_PAGE_READINESS_SLUG;

export const siteLesson03Meta = {
  title: "Sua página está pronta para converter?",
  summary: "Diagnostique o ponto de partida da página antes de planejar mudanças.",
  publicPreview:
    "Você já sabe a jornada e a estrutura. Nesta aula você avalia clareza, oferta, ação, confiança e outros fundamentos — para priorizar o que importa antes de investir em design ou tráfego.",
  estimatedMinutes: 25,
  accessType: "FREE" as const,
  priceCents: null,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson03Block = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

function block(
  position: number,
  blockKey: string,
  countsForProgress: boolean,
  required: boolean,
  data: LessonBlockData,
): SiteLesson03Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson03Blocks: SiteLesson03Block[] = [
  heading(1, "visitante-consegue-avancar", "O visitante consegue entender, confiar e avançar?"),
  block(2, "abertura-caminho-estrutura", true, false, {
    type: "TEXT",
    body: `Você já sabe qual caminho quer criar e qual estrutura faz sentido.

Agora vem uma pergunta mais importante do que “o site está bonito?”:

o visitante consegue entender, confiar e avançar?

Esta aula avalia os fundamentos da página ou estrutura atual — não promete taxa de conversão.`,
  }),
  block(3, "callout-nao-existe-perfeita", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não existe página perfeita",
    body: `O objetivo não é obter 100 pontos.

O objetivo é encontrar fundamentos ausentes, fricções e prioridades.

Um diagnóstico é ponto de partida — não um selo de performance.`,
  }),
  heading(4, "oito-dimensoes", "Oito fundamentos para olhar"),
  block(5, "dimensoes-lista", true, false, {
    type: "TEXT",
    body: `Vamos avaliar oito dimensões:

1. Clareza — em poucos segundos, a pessoa entende o que você oferece?
2. Oferta — está definida o suficiente para alguém decidir avançar?
3. Ação — está claro o que fazer agora?
4. Confiança — há informação suficiente para reduzir insegurança?
5. Estrutura — a ordem das informações ajuda a entender e avançar?
6. Mobile — a experiência funciona bem no celular?
7. Experiência — há fricções que atrapalham o próximo passo?
8. Mensuração — você consegue saber quando a ação importante aconteceu?

Não avaliamos estética. Não fazemos auditoria automática da URL nesta versão.`,
  }),
  heading(6, "clareza-e-oferta", "Clareza e oferta"),
  block(7, "clareza-oferta-texto", true, false, {
    type: "TEXT",
    body: `Clareza: o que é oferecido, para quem, benefício ou contexto, sem ambiguidade.

Oferta: serviço ou produto claro, escopo compreensível, proposta e próximo passo.

Preço público não é obrigatório. Ausência de preço não é automaticamente um problema.`,
  }),
  heading(8, "acao-e-confianca", "Ação e confiança"),
  block(9, "cta-trust-texto", true, false, {
    type: "TEXT",
    body: `Ação: existe ação principal, ela é visível, coerente, e não compete com excesso de ações iguais?

Não existe regra de “apenas um CTA por página” — o que importa é hierarquia.

Confiança: identificação, informações verificáveis, processo, portfólio, depoimentos reais, credenciais reais, contato, políticas quando aplicáveis.

Não exige tudo. Não invente prova.`,
  }),
  heading(10, "estrutura-mobile-experiencia", "Estrutura, mobile e experiência"),
  block(11, "estrutura-mobile-exp", true, false, {
    type: "TEXT",
    body: `Estrutura: sequência, agrupamento, hierarquia, informação relevante antes da ação. Ainda não vamos desenhar wireframe completo — isso vem depois.

Mobile: leitura, botões, formulário, navegação, imagens, elementos cortados — pela sua percepção, não por Lighthouse.

Experiência: texto confuso, formulário excessivo, navegação difícil, lentidão percebida, distrações. Não confundir com mobile.`,
  }),
  heading(12, "mensuracao", "Mensuração"),
  block(13, "mensuracao-principio", true, false, {
    type: "TEXT",
    body: `A pergunta é: você consegue saber quando a ação importante aconteceu?

Exemplos: clique no WhatsApp, envio de formulário, agendamento, compra, lead.

Não exigimos GA4, GTM ou Meta Pixel nesta aula. São tecnologias. O princípio é: o resultado digital consegue ser registrado?

Mensuração fraca limita aprendizado futuro — mas não significa, sozinha, que a página seja incapaz de orientar uma ação.`,
  }),
  block(14, "callout-nao-auditoria", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Diagnóstico ≠ auditoria automática",
    body: `Nesta V1, o diagnóstico é baseado nas suas respostas.

Não usamos crawler, Lighthouse, PageSpeed, análise de screenshot nem IA olhando o site.

Isso pode existir no futuro. Hoje, honestidade nas respostas vale mais do que nota alta.`,
  }),
  block(15, "checkpoint-nota-garante-conversao", true, true, {
    type: "CHECKPOINT",
    question: "Uma página com nota alta tem conversão garantida?",
    options: [
      { id: "sim", label: "Sim — nota alta garante conversão" },
      { id: "nao", label: "Não — a nota avalia fundamentos, não performance" },
    ],
    correctOptionId: "nao",
    explanation: "Conversão real só pode ser validada com comportamento e dados. O diagnóstico olha preparação, não promete resultado.",
  }),
  block(16, "checkpoint-cta-esconde", true, true, {
    type: "CHECKPOINT",
    question: "Se a ação principal não está clara, outros pontos fortes podem esconder esse problema?",
    options: [
      { id: "nao", label: "Não — a média já mostra tudo" },
      { id: "sim", label: "Sim — por isso gargalos críticos precisam aparecer" },
    ],
    correctOptionId: "sim",
    explanation: "Clareza, oferta e ação são críticas. Se uma delas está crítica, o diagnóstico deixa isso evidente mesmo com média alta.",
  }),
  block(17, "exemplo-score-cta", true, false, {
    type: "EXAMPLE",
    title: "Nota 72, mas ação crítica",
    body: `Imagine uma pontuação 72/100.

Mas a dimensão Ação está crítica: ninguém sabe o que fazer agora.

Resultado: precisa de preparação.

Prioridade: definir uma ação principal clara.

A nota é contexto. O gargalo é a mensagem principal.`,
  }),
  block(18, "checkpoint-mensuracao-contatos", true, true, {
    type: "CHECKPOINT",
    question: "Não ter mensuração significa automaticamente que a página não consegue gerar contatos?",
    options: [
      { id: "sim", label: "Sim — sem mensuração não há contato" },
      { id: "nao", label: "Não — pode gerar contato, mas você aprende menos" },
    ],
    correctOptionId: "nao",
    explanation: "Mensuração limita o aprendizado futuro. Não prova, sozinha, que a página seja incapaz de orientar uma ação.",
  }),
  heading(19, "sem-pagina", "E se ainda não houver página?"),
  block(20, "sem-pagina-ok", true, false, {
    type: "TEXT",
    body: `Você pode ainda não ter a estrutura pronta. Isso é um resultado válido.

Se ainda não existe página para avaliar, não force respostas artificiais sobre mobile, CTA ou mensuração.

O diagnóstico pode concluir: você ainda está na fase de construção — e o próximo passo é estruturar os fundamentos (com base na Aula 2, se você já escolheu a estrutura).`,
  }),
  block(21, "checkpoint-sem-pagina", true, true, {
    type: "CHECKPOINT",
    question: "Se ainda não tenho uma página, devo responder o diagnóstico como se tivesse?",
    options: [
      { id: "sim", label: "Sim — invente respostas para tirar nota" },
      { id: "nao", label: "Não — indique que ainda não há estrutura" },
    ],
    correctOptionId: "nao",
    explanation: "Responder como se existisse página gera falsa certeza. O resultado “fase de construção” é válido e útil.",
  }),
  block(22, "atividade-olhar-pagina", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: `Antes do diagnóstico, abra a página ou estrutura que quer avaliar (se existir).

Anote rapidamente:

1. Em 5 segundos, o que fica claro?
2. Qual ação principal você espera?
3. O que gera mais dúvida hoje?
4. Você consegue saber quando alguém age?

Se ainda não tem página, escreva o que pretende construir.`,
    placeholder: "Clareza, ação, dúvida principal e mensuração — em poucas linhas.",
  }),
  block(23, "tool-prontidao-pagina", true, true, {
    type: "TOOL",
    toolKey: CONVERSION_PAGE_READINESS_TOOL,
    title: "Diagnóstico de prontidão da página",
    description: `Responda com honestidade sobre a estrutura atual.

Se você já fez as Aulas 1 e 2 no mesmo projeto, usamos oferta, destino, ação e estrutura recomendada como contexto — sem responder o questionário por você.

Este diagnóstico não analisa a URL automaticamente.`,
  }),
  block(24, "callout-pronto-validar", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Pronto para validar ≠ pronto para performar",
    body: `Se o resultado for “pronto para validar”, isso significa que os fundamentos avaliados estão suficientemente preparados para começar validação real.

Não significa que a página vai converter.
Não significa que está otimizada.

O comportamento real dos visitantes é que permitirá avaliar o resultado.`,
  }),
  heading(25, "prioridades", "Prioridade antes de tráfego e design"),
  block(26, "prioridade-logica", true, false, {
    type: "TEXT",
    body: `Quando houver vários pontos de atenção, priorize o que bloqueia a jornada:

Clareza → Oferta → Ação → Confiança/Estrutura → Experiência/Mobile → Mensuração

Não otimize mensuração antes de a proposta sequer estar clara.

E não esconda um CTA crítico atrás de uma média “bonita”.`,
  }),
  block(27, "exemplo-fundacao", true, false, {
    type: "EXAMPLE",
    title: "Ainda sem página",
    body: `Situação: a Aula 2 sugeriu landing page + WhatsApp, mas a página ainda não foi publicada.

Resultado válido: ainda na fase de construção.

Não aparece 0/100 — isso comunicaria fracasso indevido.

Próximo passo: estruturar os fundamentos e voltar ao diagnóstico.`,
  }),
  block(28, "conclusao-bloco-gratuito", true, false, {
    type: "CONCLUSION",
    body: `Agora você sabe qual jornada quer criar, qual estrutura faz sentido e quais fundamentos precisam de atenção.

Nas próximas aulas, vamos transformar esse diagnóstico em uma página planejada de verdade — começando por oferta, público e ação principal.`,
  }),
  block(29, "proxima-etapa-brief", true, false, {
    type: "TEXT",
    body: `Próxima etapa: transformar o diagnóstico em um brief de página.

Você já diagnosticou o ponto de partida. O próximo passo da formação é planejar oferta, público e ação principal com mais precisão.`,
  }),
  block(30, "encerramento-gratis", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Fim do bloco gratuito",
    body: `Com as três primeiras aulas, você tem mapa de jornada, estrutura digital e diagnóstico de prontidão.

Isso fecha a base para decidir o que construir — sem confundir diagnóstico com garantia de conversão.`,
  }),
];
