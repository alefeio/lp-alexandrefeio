import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_PUBLICATION_TOOL, PUBLICATION_RESULT_TITLE, SITE_PUBLICATION_SLUG } from "@/lib/landing-page/publication/lesson-flow";

export const SITE_LESSON_12_SLUG = SITE_PUBLICATION_SLUG;

export const siteLesson12Meta = {
  title: "Revise e publique sua landing page",
  summary: "Faça a revisão final, corrija o que impede a publicação e coloque sua landing page no ar.",
  publicPreview:
    "Você não chegou até aqui apenas para terminar um curso. Você chegou até aqui para colocar uma página real no ar.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson12Block = {
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
): SiteLesson12Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

const yesNo = () => [
  { id: "sim", label: "Sim" },
  { id: "nao", label: "Não" },
];

export const siteLesson12Blocks: SiteLesson12Block[] = [
  heading(1, "abertura", "Uma página real no ar"),
  block(2, "chegou-para-publicar", true, false, {
    type: "TEXT",
    body: `Você não chegou até aqui apenas para terminar um curso. Você chegou até aqui para colocar uma página real no ar.

Antes do curso, a frase era: eu preciso de uma landing page. Agora o caminho é outro: eu planejei, construí, revisei e publiquei minha própria landing page.`,
  }),
  heading(3, "o-que-ja-esta-pronto", "O que você já construiu"),
  block(4, "retomada-das-aulas", true, false, {
    type: "TEXT",
    body: `A oferta, o público e a ação vieram da aula da oferta. A jornada mostrou o que a pessoa precisa entender antes de agir. A estrutura organizou as seções. A mensagem deixou a oferta clara. A direção visual conduziu a atenção. A confiança entrou antes do pedido. A experiência conferiu se dá para ler e agir. A mensuração escolheu o sinal que representa resultado.

Agora falta revisar e publicar.`,
  }),
  heading(5, "nao-e-um-botao-cego", "Publicar não é apertar um botão às cegas"),
  block(6, "a-plataforma-verifica", true, false, {
    type: "TEXT",
    body: `Antes de publicar, a plataforma verifica se existem problemas que impedem a página de funcionar adequadamente.

Essa verificação não dá nota. A página está pronta ou possui pendências.`,
  }),
  heading(7, "tres-grupos", "O que a verificação mostra"),
  block(8, "pronto-corrigir-revisar", true, false, {
    type: "TEXT",
    body: `O resultado aparece em três grupos.

Pronto para publicar: não há ponto que impeça a página de ir ao ar.
Precisa corrigir: um bloqueio impede a publicação. Não existe a opção de ignorar e publicar mesmo assim.
Vale revisar: um aviso merece atenção, mas não impede a publicação sozinho.

Zero bloqueios significa pronta para publicação. Isso não significa página perfeita.`,
  }),
  heading(9, "bloqueios", "O que precisa ser corrigido"),
  block(10, "bloqueio-impede", true, false, {
    type: "TEXT",
    body: `Um bloqueio impede a publicação. A ferramenta leva você de volta à etapa certa, sem abrir outro editor aqui.

Texto principal provisório ou ainda não aprovado volta para a aula da mensagem. Cor que dificulta a leitura volta para a direção visual. Prova ou depoimento sem autorização volta para a confiança. Revisão desatualizada volta para a experiência. Ação, formulário ou mensuração voltam para a aula do que precisa ser medido.

Se a página mudou depois da última revisão de experiência, a publicação fica bloqueada. O caminho é revisar novamente e voltar para esta aula.`,
  }),
  block(11, "exemplo-pronta-com-avisos", true, false, {
    type: "EXAMPLE",
    title: "Página pronta, com dois avisos",
    body: `Não há bloqueio. Há dois avisos: nenhum depoimento e uma imagem grande.

O aluno lê os dois pontos, marca que revisou e pode publicar. Inventar um depoimento não deixa a página melhor.`,
  }),
  block(12, "exemplo-whatsapp-sem-numero", true, false, {
    type: "EXAMPLE",
    title: "WhatsApp sem número",
    body: `A ação principal é WhatsApp, mas o número não está configurado. Isso é um bloqueio.

A página não pode ser publicada até a ação estar configurada.`,
  }),
  block(13, "exemplo-revisao-desatualizada", true, false, {
    type: "EXAMPLE",
    title: "A página mudou depois da revisão",
    body: `A revisão de experiência estava pronta. Depois, o formulário foi alterado na aula de mensuração.

A revisão ficou desatualizada. É preciso revisar novamente na aula de experiência e só então voltar para publicar.`,
  }),
  block(14, "checkpoint-rascunho", true, true, {
    type: "CHECKPOINT",
    question: "Depois que você publica uma versão, editar o rascunho muda automaticamente o que está no ar?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. O rascunho pode continuar sendo editado. O que está no ar só muda quando você publica uma nova versão.",
  }),
  heading(15, "avisos", "O que vale revisar"),
  block(16, "avisos-nao-bloqueiam", true, false, {
    type: "TEXT",
    body: `Um aviso não bloqueia necessariamente. Exemplos: nenhuma prova adicionada, um texto secundário ainda em revisão, uma imagem grande ou um ponto da experiência deixado para depois.

Antes de publicar, os avisos aparecem com clareza. Você pode marcar: revisei este ponto e quero continuar. Um bloqueio não pode ser marcado dessa forma.

A landing page não precisa obrigatoriamente de imagem. Também pode ir ao ar sem depoimento.`,
  }),
  block(17, "sem-inventar-prova", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Nenhuma prova ainda",
    body: `Se você ainda não possui provas reais, é melhor publicar sem inventá-las.`,
  }),
  block(18, "checkpoint-depoimento", true, true, {
    type: "CHECKPOINT",
    question: "Uma página pode ser publicada sem depoimentos, desde que não invente provas?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. A falta de depoimento é um aviso, não um bloqueio. Inventar prova não faz parte da publicação.",
  }),
  heading(19, "revisao-final", "Ver antes de publicar"),
  block(20, "preview-e-pagina-publica", true, false, {
    type: "TEXT",
    body: `A revisão final serve para revisar. Nela, os botões não executam a ação, o formulário não envia e nada é contado.

A página no ar é a versão que os visitantes realmente usam. Publicar cria uma versão da sua página. Durante esta fase inicial, a página não será adicionada aos mecanismos de busca automaticamente.`,
  }),
  heading(21, "versoes", "Rascunho e página no ar"),
  block(22, "editar-depois", true, false, {
    type: "TEXT",
    body: `Depois de publicar, você pode continuar editando. Essas alterações não mudam automaticamente o que já está no ar.

Quando o rascunho estiver à frente da versão no ar, a ferramenta avisa: você possui alterações que ainda não foram publicadas. Aí o caminho é publicar uma nova versão.

Se nada mudou, não nasce outra versão. A mensagem é: não há alterações novas para publicar.

Cada publicação vira uma versão separada. Isso ajuda a preservar o que esteve no ar. A versão aparece como 1, 2 ou 3. Restaurar uma versão anterior cria uma nova versão baseada nela. Não apaga as mais recentes.

O endereço usa o formato /p/ e o nome curto da página. Depois da primeira publicação, esse endereço fica reservado para esta página.`,
  }),
  block(23, "exemplo-versao-dois", true, false, {
    type: "EXAMPLE",
    title: "A primeira versão continua no ar",
    body: `A versão 1 está no ar. O aluno altera a frase principal no rascunho. Quem abre a página continua vendo a versão 1.

Depois, ele publica a versão 2. A partir daí, a página no ar passa a ser a versão 2.`,
  }),
  block(24, "checkpoint-bloqueio", true, true, {
    type: "CHECKPOINT",
    question: "Um bloqueio de publicação pode ser simplesmente ignorado?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. Enquanto existir um ponto que precisa ser corrigido, a publicação não acontece.",
  }),
  block(25, "checkpoint-nova-versao", true, true, {
    type: "CHECKPOINT",
    question: "Depois de publicar, você pode continuar editando e publicar uma nova versão?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. O rascunho continua editável. A nova versão é que atualiza o que está no ar.",
  }),
  block(26, "o-que-conferir-no-ar", true, false, {
    type: "TEXT",
    body: `Depois que a página estiver no ar, abra o endereço e confira se a ação principal leva ao destino esperado. Se for WhatsApp, confirme se o botão abre o destino. Não é preciso enviar uma mensagem para concluir a aula.

Se a página tem formulário, ele está ativo na página publicada. Não envie um contato de teste só para concluir: isso misturaria um lead fictício com os contatos reais.

Os dados aparecerão conforme a página começar a receber visitas e ações. Logo depois de publicar, ainda não há números para mostrar.`,
  }),
  block(27, "conclusao-do-curso", true, false, {
    type: "TEXT",
    body: `Você concluiu o curso com uma landing page construída e publicada por você.

Isso não é uma garantia de venda. É a página que você planejou, construiu, revisou e publicou.

Agora que sua página está no ar, o próximo passo pode ser aprender a levar pessoas até ela e acompanhar os resultados. Esse é o curso Tráfego Pago na Prática para Pequenos Negócios. Se preferir ajuda profissional, o serviço de gestão continua disponível à parte. Nenhum dos dois é contratado por esta aula.`,
  }),
  block(28, "ferramenta-publicacao", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_PUBLICATION_TOOL,
    title: PUBLICATION_RESULT_TITLE,
    description:
      "Revise bloqueios e avisos, veja a revisão final e publique uma versão da sua página. A conclusão só acontece quando essa versão pode ser aberta.",
  }),
  block(29, "resultado-publicacao", false, true, {
    type: "RESULT",
    title: PUBLICATION_RESULT_TITLE,
    prompt: "O resumo fica no resultado da aula. A versão publicada, o caminho e a ação entram aqui. Telefone, endereço externo, provas e contatos ficam de fora.",
    fields: [
      { key: "versao", label: "Versão publicada" },
      { key: "endereco", label: "Endereço" },
      { key: "acao", label: "Ação principal" },
      { key: "conversao", label: "Conversão principal" },
      { key: "avisos", label: "Pontos revisados" },
    ],
  }),
  block(30, "o-que-foi-construido", true, false, {
    type: "TEXT",
    body: `O que ficou construído, na mesma página: estratégia, jornada, estrutura, mensagem, direção visual, confiança, experiência, mensuração e publicação.`,
  }),
  heading(31, "historico", "Histórico de versões"),
  block(32, "versoes-separadas", true, false, {
    type: "TEXT",
    body: `O histórico mostra a versão, a data e qual está ativa. Ele não mostra o conteúdo interno da versão.

Tirar a página do ar, se você precisar disso depois, pede uma confirmação e não apaga o histórico. Não é o passo principal desta aula.`,
  }),
  block(33, "fechamento", true, false, {
    type: "CONCLUSION",
    body: `Você concluiu o curso com uma landing page construída e publicada por você.

A página no ar é uma versão da sua página. O rascunho pode continuar mudando sem alterar o que os visitantes já veem, até você publicar de novo.`,
  }),
];
