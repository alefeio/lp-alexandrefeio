import type { LessonBlockData } from "@/lib/learning/blocks";
import { SITE_VISITOR_JOURNEY_SLUG, VISITOR_DECISION_JOURNEY_TOOL } from "@/lib/learning/visitor-decision";

export const SITE_LESSON_05_SLUG = SITE_VISITOR_JOURNEY_SLUG;

export const siteLesson05Meta = {
  title: "Planeje a jornada do visitante",
  summary: "Registre o que o visitante precisa entender, acreditar e superar antes de agir.",
  publicPreview:
    "A página é uma sequência de decisões. Nesta aula você registra o caminho do visitante até a ação, no mesmo projeto da sua landing page.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson05Block = {
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
): SiteLesson05Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson05Blocks: SiteLesson05Block[] = [
  heading(1, "duas-pessoas-mesma-pagina", "Duas pessoas, a mesma página"),
  block(2, "abertura-duas-pessoas", true, false, {
    type: "TEXT",
    body: `Imagine duas pessoas chegando à mesma página.

Uma já conhece sua empresa e quer apenas falar com alguém. A outra nunca ouviu falar de você e ainda nem sabe se sua solução serve para ela.

As duas precisam da mesma página? Não necessariamente. A estrutura depende do estado de decisão de quem chega.`,
  }),
  block(3, "callout-sequencia-de-decisoes", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "A página é uma sequência de decisões",
    body: "Cheguei, entendi, isso é para mim, confio o suficiente, minhas principais dúvidas foram respondidas, sei o que fazer, ajo. Isso é uma estrutura pedagógica, não um funil rígido.",
  }),
  heading(4, "nao-comeca-do-zero", "A página não começa do zero"),
  block(5, "chegada-da-aula-4", true, false, {
    type: "TEXT",
    body: `Na aula anterior você registrou de onde a pessoa pode chegar e o que ela já pode saber.

Ela traz conhecimento, expectativa, intenção, dúvida, comparação e contexto. O que veio antes muda o que a página precisa fazer agora.`,
  }),
  heading(6, "o-que-o-visitante-ja-sabe", "O que o visitante já sabe"),
  block(7, "niveis-de-conhecimento", true, false, {
    type: "TEXT",
    body: `Use um nível simples, em linguagem humana:

quase nada; já conhece o problema; já conhece esse tipo de solução; já conhece a sua oferta; já está pronto para agir; ou ainda não dá para saber.

Não é preciso montar uma teoria de persona. O nível só indica quanto a página precisa explicar antes da ação.`,
  }),
  block(8, "exemplo-moveis", true, false, {
    type: "EXAMPLE",
    title: "Móveis planejados",
    body: `O visitante já sabe que quer móveis sob medida. A explicação pode ser média, mas a decisão é alta: valor, prazo e confiança pesam. O processo de orçamento precisa ser explicado. Provas reais ajudam, se existirem. A ação continua sendo pedir orçamento ou falar no WhatsApp.

Isso pede uma página que sustente a decisão. Ainda não é hora de montar as seções.`,
  }),
  heading(9, "explicar-e-decidir", "Explicar não é o mesmo que decidir"),
  block(10, "complexidade-da-decisao", true, false, {
    type: "TEXT",
    body: `“Quanto a pessoa precisa entender antes de agir?” pode ser pouco, médio, muito ou ainda incerto.

Uma oferta pode ser fácil de explicar e difícil de decidir. Um procedimento particular pode ser compreensível e, ainda assim, pedir confiança e informação. Você avalia o seu cenário. O sistema não infere isso pelo setor.`,
  }),
  block(11, "exemplo-servico", true, false, {
    type: "EXAMPLE",
    title: "Serviço profissional",
    body: `A pessoa conhece o problema e precisa confiar no profissional. A confiança necessária é alta e o contato humano faz parte da decisão. Pode ser preciso explicar como o atendimento começa e o que acontece depois do primeiro contato.`,
  }),
  heading(12, "confianca-e-duvidas", "Confiança, dúvidas e processo"),
  block(13, "de-onde-vem-a-confianca", true, false, {
    type: "TEXT",
    body: `Confiança pode vir de identificação, processo, credenciais, provas reais, clareza, contato ou transparência.

As objeções que você anotou na estratégia continuam sendo a lista factual. Aqui você pode editá-las, removê-las ou acrescentar uma dúvida que precise ser resolvida antes do avanço. A lista canônica continua no brief. A jornada só classifica essa mesma lista, por exemplo preço, confiança, prazo, encaixe, processo, risco, localização ou comparação. Nada é categorizado sozinho.`,
  }),
  block(14, "processo-provas-contato", true, false, {
    type: "TEXT",
    body: `Pergunte se o visitante precisa entender como funciona antes de agir: etapas, atendimento, orçamento ou o que acontece depois do cadastro.

Depois, diga se você já tem elementos reais de confiança: portfólio, depoimento verdadeiro, case, credencial, experiência, resultado verificável, processo documentado ou demonstração. Se ainda não tem, o estado é “precisam ser preparadas”. Não invente prova para preencher a página. A coleta completa fica para uma aula posterior.

Por fim, avalie se falar com uma pessoa faz parte da decisão. Em consulta e orçamento, o contato costuma ser importante. Em um cadastro simples, pode ser pouco.`,
  }),
  block(15, "callout-nao-inventar-prova", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Prova se inventa depois",
    body: "Sem depoimento, case ou credencial real, a página não ganha um exemplo fabricado. O mapa só registra a situação atual.",
  }),
  block(16, "exemplo-oferta-digital", true, false, {
    type: "EXAMPLE",
    title: "Oferta digital simples",
    body: `A pessoa já entende o formato. A explicação pode ser baixa ou média, a decisão baixa e a confiança média. A ação pode ser inscrição ou compra, conforme o que já foi definido. A jornada fica mais curta porque a decisão que precisa ser sustentada é menor.

Página longa não é melhor. Página curta também não. O comprimento deriva da decisão.`,
  }),
  block(17, "metodo-de-avanco", true, false, {
    type: "TEXT",
    body: `A ação principal veio da aula anterior. Confirme se ela continua adequada: WhatsApp, formulário, agendamento, compra, inscrição, link ou outro caminho.

Se você mudar o método, a ação do projeto só muda com a sua confirmação. Oferta, público e objetivo da página permanecem os que você já definiu.`,
  }),
  block(18, "jornada-editavel", true, false, {
    type: "TEXT",
    body: `O mapa pede frases de trabalho, não texto final de página:

quando chega, o visitante…; primeiro precisa entender…; depois precisa perceber…; pode hesitar porque…; precisa confiar em…; então deve saber…; a ação esperada é…

Um cenário simples pode ter menos etapas. Nem toda página precisa das seis.`,
  }),
  block(19, "checkpoint-explicacao", true, true, {
    type: "CHECKPOINT",
    question: "Duas pessoas chegando à mesma oferta podem precisar de níveis diferentes de explicação?",
    options: [
      { id: "sim", label: "Sim — o que cada uma já sabe muda o que a página precisa explicar" },
      { id: "nao", label: "Não — a mesma oferta pede sempre a mesma explicação" },
    ],
    correctOptionId: "sim",
    explanation: "Quem já conhece a empresa e quem nunca ouviu falar dela não chegam no mesmo ponto da decisão.",
  }),
  block(20, "checkpoint-decisao", true, true, {
    type: "CHECKPOINT",
    question: "Uma oferta fácil de entender significa necessariamente uma decisão fácil?",
    options: [
      { id: "sim", label: "Sim — se a ideia é clara, a decisão também é" },
      { id: "nao", label: "Não — entender a oferta e decidir são coisas diferentes" },
    ],
    correctOptionId: "nao",
    explanation: "Um serviço pode ser simples de explicar e ainda pedir confiança, prazo ou comparação antes da ação.",
  }),
  block(21, "checkpoint-prova", true, true, {
    type: "CHECKPOINT",
    question: "Se não possuo depoimentos, devo criar exemplos para preencher a página?",
    options: [
      { id: "sim", label: "Sim — a página precisa parecer completa" },
      { id: "nao", label: "Não — só entra prova que você possa sustentar" },
    ],
    correctOptionId: "nao",
    explanation: "A falta de prova é um fato do projeto. Inventar depoimento ou resultado não resolve a decisão do visitante.",
  }),
  block(22, "checkpoint-complexidade", true, true, {
    type: "CHECKPOINT",
    question: "Quanto mais complexa a decisão, maior pode ser a necessidade de explicar processo, confiança e objeções?",
    options: [
      { id: "sim", label: "Sim — a página sustenta a decisão que a pessoa precisa tomar" },
      { id: "nao", label: "Não — complexidade não muda o que a página explica" },
    ],
    correctOptionId: "sim",
    explanation: "O tamanho da página deriva do que precisa ser compreendido, acreditado e resolvido antes da ação.",
  }),
  block(23, "atividade-jornada", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: "Em uma frase de trabalho: o que o visitante já sabe ao chegar, o que precisa entender e o que pode fazê-lo hesitar. Ainda não escreva o texto da página.",
  }),
  block(24, "ferramenta-jornada", true, true, {
    type: "TOOL",
    toolKey: VISITOR_DECISION_JOURNEY_TOOL,
    title: "Mapa de decisão do visitante",
    description: "Use o projeto da landing page que já tem oferta, público e ação. Registre o caminho até essa ação.",
  }),
  block(25, "resultado-jornada", false, true, {
    type: "RESULT",
    title: "Mapa de decisão do visitante",
    prompt: "O resumo desta etapa fica no resultado da aula. A jornada completa fica no projeto da landing page.",
    fields: [
      { key: "consciencia", label: "O que a pessoa já sabe" },
      { key: "explicacao", label: "Necessidade de explicação" },
      { key: "confianca", label: "Confiança necessária" },
    ],
  }),
  block(26, "conclusao-caminho", true, false, {
    type: "CONCLUSION",
    body: `Agora sabemos não apenas o que sua página precisa oferecer, mas também o caminho que o visitante precisa percorrer para chegar à ação.

Na próxima aula, a plataforma vai usar essas decisões para montar a primeira estrutura visual da sua landing page. As seções ainda não foram geradas.`,
  }),
  block(27, "proxima-estrutura", true, false, {
    type: "TEXT",
    body: `Próxima aula: Organize as seções da página.

Veja sua landing page ganhar estrutura. Essa etapa usa a oferta e a jornada que você acabou de registrar. Ela ainda não começa nesta aula.`,
  }),
  heading(28, "o-que-voce-leva", "O que você leva desta aula"),
  block(29, "leva-mapa", true, false, {
    type: "TEXT",
    body: "Você leva o mapa no mesmo projeto da aula anterior: conhecimento de chegada, explicação, complexidade, confiança, dúvidas, processo, situação das provas, contato humano, método de avanço e a sequência da decisão.",
  }),
  block(30, "callout-acesso-e-dados", true, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "A aula abre sem a anterior",
    body: "Você pode entrar nesta aula sem ter concluído a anterior. A ferramenta, porém, precisa do brief da mesma landing page. Se ele ainda não existe, o caminho é preparar a página na Aula 4. A navegação é independente; o artefato é o mesmo.",
  }),
  block(31, "revisao-do-mapa", true, false, {
    type: "TEXT",
    body: "Antes de salvar, confira o caminho aplicável: chega, precisa entender, precisa perceber valor, precisa confiar, precisa resolver dúvidas e age. Só entram as etapas que fazem sentido no seu caso.",
  }),
];
