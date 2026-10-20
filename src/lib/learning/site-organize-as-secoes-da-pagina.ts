import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_WIREFRAME_TOOL, SITE_WIREFRAME_SLUG } from "@/lib/learning/landing-page-wireframe";

export const SITE_LESSON_06_SLUG = SITE_WIREFRAME_SLUG;

export const siteLesson06Meta = {
  title: "Monte a estrutura da sua landing page",
  summary: "Transforme a estratégia e a jornada em uma estrutura real de seções, ainda sem a copy final.",
  publicPreview:
    "A estrutura da página nasce das decisões que você já registrou. Nesta aula você vê, ajusta e visualiza o esqueleto da sua landing page.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson06Block = {
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
): SiteLesson06Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson06Blocks: SiteLesson06Block[] = [
  heading(1, "sai-do-planejamento", "Agora a página sai do planejamento"),
  block(2, "abertura-estrutura", true, false, {
    type: "TEXT",
    body: `Agora sua landing page vai deixar de existir apenas como planejamento.

As decisões das aulas anteriores — oferta, público, ação principal e jornada do visitante — viram a primeira estrutura da página. Você ainda não escreve a mensagem final. Você define quais informações precisam aparecer e em que ordem.`,
  }),
  block(3, "callout-esqueleto", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Estrutura, ainda não acabamento",
    body: "Wireframe é o esqueleto. Cores, fontes, imagens e texto comercial ficam para as próximas etapas.",
  }),
  heading(4, "o-que-e-wireframe", "O que é um wireframe"),
  block(5, "esqueleto-da-pagina", true, false, {
    type: "TEXT",
    body: `O wireframe define quais seções existem, a ordem delas, a função de cada uma e o caminho até a ação.

Ele não escolhe a cor do botão, a foto do serviço nem a frase que vai no topo. Responde só a uma pergunta: que informações precisam aparecer, e em que ordem, para o visitante decidir?`,
  }),
  heading(6, "nao-e-template", "Não é o mesmo modelo para todo mundo"),
  block(7, "recomendacao-considera", true, false, {
    type: "TEXT",
    body: `A plataforma não escolhe a mesma estrutura para todos.

A recomendação considera a oferta, o público, a necessidade de explicação, a complexidade da decisão, a confiança, as objeções, o processo, a prova, o contato e a ação principal. Dois negócios podem vender algo parecido e ainda assim precisar de páginas diferentes.`,
  }),
  heading(8, "secao-com-funcao", "Uma seção precisa de função"),
  block(9, "processo-nao-e-obrigatorio", true, false, {
    type: "TEXT",
    body: `Uma seção só deveria ocupar espaço quando cumpre algum papel.

Processo, por exemplo, não existe porque “landing pages precisam ter Como funciona”. Existe quando o visitante precisa compreender o processo antes de decidir. Se isso não reduz incerteza, a seção não entra.`,
  }),
  block(10, "checkpoint-secao-comum", true, true, {
    type: "CHECKPOINT",
    question: "Uma seção deve entrar apenas porque é comum em landing pages?",
    options: [
      { id: "sim", label: "Sim — se a maioria das páginas tem, a sua também precisa" },
      { id: "nao", label: "Não — a seção entra quando tem uma função nesta decisão" },
    ],
    correctOptionId: "nao",
    explanation: "Espaço na página se justifica pelo que o visitante ainda precisa entender, acreditar ou responder.",
  }),
  heading(11, "abertura-contexto-valor", "Abertura, contexto, solução e valor"),
  block(12, "funcoes-iniciais", true, false, {
    type: "TEXT",
    body: `A abertura responde rápido: o que é isso, é para mim, o que faço agora. A headline final ainda não é escrita aqui.

O contexto ajuda o visitante a reconhecer a situação, a necessidade e o momento. Não dramatiza dor e não usa medo artificial.

A solução conecta esse contexto à oferta apresentada.

Os benefícios mostram por que a oferta pode ser relevante. Não são uma lista de funcionalidades, e os benefícios finais ainda não são gerados nesta aula.`,
  }),
  heading(13, "processo-confianca-duvidas", "Processo, confiança e dúvidas"),
  block(14, "funcoes-de-incerteza", true, false, {
    type: "TEXT",
    body: `Processo explica “como funciona?” quando isso reduz incerteza. Não é obrigatório em toda página.

Confiança reduz insegurança. No futuro pode reunir provas reais, credenciais, portfólio ou informações verificáveis. Nenhuma prova deve ser inventada.

Dúvidas resolvem objeções importantes. Um bloco de perguntas não existe para encher a página.`,
  }),
  heading(15, "acao-contato-rodape", "Ação, formulário, contato e rodapé"),
  block(16, "caminhos-de-acao", true, false, {
    type: "TEXT",
    body: `O convite para ação pede o próximo passo. O formulário é o mecanismo de captura. O contato mostra canais e informações para falar com você.

Dependendo da jornada, um ou mais desses caminhos fazem sentido. O rodapé identifica o negócio. Não precisa ser uma navegação institucional enorme.`,
  }),
  heading(17, "pagina-longa-ou-curta", "Página longa ou curta"),
  block(18, "comprimento-deriva-da-decisao", true, false, {
    type: "TEXT",
    body: `Não existe a regra “landing page curta converte mais” nem “landing page longa converte mais”.

O comprimento deriva do que precisa ser entendido, acreditado e respondido antes da ação. Uma oferta simples pode pedir poucas seções. Um serviço que exige confiança pode pedir mais.`,
  }),
  block(19, "checkpoint-pagina-longa", true, true, {
    type: "CHECKPOINT",
    question: "Uma página mais longa é necessariamente melhor?",
    options: [
      { id: "sim", label: "Sim — quanto mais seções, mais completa é a decisão" },
      { id: "nao", label: "Não — o tamanho segue o que a decisão realmente exige" },
    ],
    correctOptionId: "nao",
    explanation: "Seção a mais sem função aumenta a página sem ajudar o visitante a agir.",
  }),
  heading(20, "ordem-conceitual", "A ordem conceitual"),
  block(21, "entender-valorar-agir", true, false, {
    type: "TEXT",
    body: `Uma lógica útil é: entender, perceber valor, reduzir incerteza e agir.

Isso organiza o raciocínio. Não é uma sequência obrigatória. A recomendação pode adiantar a ação, enxugar o meio da página ou dar mais espaço à confiança quando a jornada pede.`,
  }),
  heading(22, "dois-cenarios", "Dois negócios, duas estruturas"),
  block(23, "cenario-simples-e-complexo", true, false, {
    type: "TEXT",
    body: `Cenário A: oferta simples, pouca explicação, próximo passo no WhatsApp. A estrutura tende a ser menor. O visitante já entende o que é e precisa de um caminho claro para conversar.

Cenário B: serviço complexo, alta confiança, várias objeções e formulário. A estrutura tende a ser maior, porque processo, prova e dúvidas participam da decisão.

Não existe um tamanho universal.`,
  }),
  block(24, "checkpoint-processo", true, true, {
    type: "CHECKPOINT",
    question: "Se o processo é importante para a decisão, explicá-lo pode justificar uma seção própria?",
    options: [
      { id: "sim", label: "Sim — a seção existe para reduzir essa incerteza" },
      { id: "nao", label: "Não — processo só entra se todas as páginas tiverem" },
    ],
    correctOptionId: "sim",
    explanation: "A função da seção é explicar o caminho quando o visitante precisa dele para decidir.",
  }),
  block(25, "checkpoint-nao-e-design", true, true, {
    type: "CHECKPOINT",
    question: "O wireframe define o design final da página?",
    options: [
      { id: "sim", label: "Sim — estrutura, cores e imagens ficam fechadas juntas" },
      { id: "nao", label: "Não — o wireframe define informações e ordem, não o acabamento" },
    ],
    correctOptionId: "nao",
    explanation: "Cores, fontes, imagens e copy final não são o trabalho desta aula.",
  }),
  heading(26, "monte-a-estrutura", "Monte a estrutura"),
  block(27, "ferramenta-wireframe", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_WIREFRAME_TOOL,
    title: "Estrutura da minha landing page",
    description: "Veja a recomendação, entenda por que cada seção entrou e aplique a estrutura na sua página.",
  }),
  block(28, "atividade-funcao", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: "Escolha uma seção da estrutura recomendada e escreva, em uma frase, a função dela para o seu visitante. Ainda não escreva o texto que vai aparecer na página.",
  }),
  block(29, "resultado-estrutura", false, true, {
    type: "RESULT",
    title: "Estrutura da minha landing page",
    prompt: "O resumo fica no resultado da aula. A estrutura visual fica nas seções do projeto.",
    fields: [
      { key: "estrutura", label: "Tipo de estrutura" },
      { key: "recomendacao", label: "Base da recomendação" },
      { key: "secoes", label: "Quantidade de seções" },
    ],
  }),
  heading(30, "o-que-voce-tem", "O que você tem agora"),
  block(31, "conclusao-estrutura-real", true, false, {
    type: "CONCLUSION",
    body: `Agora sua landing page já possui uma estrutura real.

Você consegue visualizar o caminho que o visitante percorrerá e entender por que cada seção está ali.

Na próxima aula, vamos transformar esses blocos em mensagens reais.`,
  }),
  block(32, "proxima-mensagem", true, false, {
    type: "TEXT",
    body: `Próxima aula: Escreva uma mensagem que deixa sua oferta clara.

É aqui que sua página começa a falar com o visitante. Os blocos que você acabou de ver ainda estão com conteúdo provisório. A mensagem real começa na próxima aula.`,
  }),
];
