import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_MEASUREMENT_TOOL, MEASUREMENT_RESULT_TITLE, SITE_MEASUREMENT_SLUG } from "@/lib/landing-page/measurement/lesson-flow";

export const SITE_LESSON_11_SLUG = SITE_MEASUREMENT_SLUG;

export const siteLesson11Meta = {
  title: "Configure o que precisa ser medido",
  summary: "Defina qual ação representa resultado e quais sinais acompanhar, antes de escolher uma ferramenta externa.",
  publicPreview:
    "Publicar uma página sem definir o que observar pode fazer você receber números sem saber o que eles significam. Nesta aula você escolhe a conversão principal.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson11Block = {
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
): SiteLesson11Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

const yesNo = () => [
  { id: "sim", label: "Sim" },
  { id: "nao", label: "Não" },
];

export const siteLesson11Blocks: SiteLesson11Block[] = [
  heading(1, "abertura", "O que precisa acontecer nesta página"),
  block(2, "numeros-sem-pergunta", true, false, {
    type: "TEXT",
    body: `Publicar uma página sem definir o que observar pode fazer você receber números sem saber o que eles significam.

Uma métrica só é útil quando ajuda a responder uma pergunta. A pergunta desta aula é: o que precisa acontecer para esta landing page cumprir seu papel? A partir dela, a ordem é ação, evento e conversão principal.

Antes, a página possuía uma ação. Depois desta aula, você sabe qual ação representa resultado e quais sinais vai acompanhar para entender o que está acontecendo.`,
  }),
  heading(3, "nao-e-analytics", "Não é uma aula de ferramenta"),
  block(4, "sem-ferramenta-externa", true, false, {
    type: "TEXT",
    body: `Não vamos ensinar nesta aula GA4, GTM, Meta Pixel, UTM avançada nem dashboards complexos.

O foco é o que medir, antes de escolher ferramentas externas. A plataforma conta eventos da própria landing. Ela não envia esses eventos para Google, Meta ou OpenAI.`,
  }),
  heading(5, "acao-principal", "A ação principal"),
  block(6, "o-que-o-visitante-faz", true, false, {
    type: "TEXT",
    body: `A ação principal foi definida na aula da oferta. Ela pode ser WhatsApp, formulário, um destino externo ou uma página interna.

A pergunta central continua a mesma: o que você espera que o visitante faça? Esta aula não cria um objetivo novo. Ela usa o brief, o objetivo da página e a ação que já existem.`,
  }),
  heading(7, "acao-nao-e-conversao", "Ação não é conversão"),
  block(8, "mecanismo-e-resultado", true, false, {
    type: "TEXT",
    body: `Ação é o mecanismo disponível. Exemplo: o botão abre o WhatsApp.

Conversão principal é o evento que representa o resultado que queremos acompanhar. Exemplo: o clique no WhatsApp. Na primeira versão, existe somente uma conversão principal.`,
  }),
  heading(9, "o-que-e-evento", "O que é um evento"),
  block(10, "evento-e-visualizacao", true, false, {
    type: "TEXT",
    body: `Evento é algo relevante que aconteceu na página e que podemos contar. Não vamos entrar no detalhe técnico de implementação.

Visualização da página significa que a landing foi carregada publicamente. Não significa interesse, lead nem venda.`,
  }),
  block(11, "clique-e-whatsapp", true, false, {
    type: "TEXT",
    body: `Clique na ação representa o clique em uma ação da landing. Ele pode existir antes de sabermos qual canal específico foi usado.

Quando a ação é WhatsApp, o clique no WhatsApp é um sinal mais específico. Esse clique ainda não significa conversa iniciada, venda nem cliente adquirido.`,
  }),
  block(12, "inicio-e-envio", true, false, {
    type: "TEXT",
    body: `Início do formulário representa que a pessoa começou a interagir com o formulário. Não significa envio.

Formulário enviado só acontece quando o formulário é válido e o lead foi gravado com sucesso. Não conte o clique no botão de enviar como submissão.`,
  }),
  heading(13, "jornada-simples", "A jornada que será medida"),
  block(14, "passos-da-jornada", true, false, {
    type: "TEXT",
    body: `Isso não é, necessariamente, um funil de vendas completo. É a sequência de sinais desta página.

No WhatsApp: visualização, clique na ação, clique no WhatsApp.
No formulário: visualização, descoberta da ação, início do formulário, envio.
No destino externo ou na página interna: visualização e clique na ação. Depois do clique, a landing não controla o destino.`,
  }),
  block(15, "exemplo-whatsapp", true, false, {
    type: "EXAMPLE",
    title: "Serviço local",
    body: `O objetivo é a conversa. Os eventos acompanhados são visualização, clique na ação e clique no WhatsApp. A conversão principal é o clique no WhatsApp.

A landing não sabe, por esses sinais, se houve venda.`,
  }),
  block(16, "exemplo-formulario", true, false, {
    type: "EXAMPLE",
    title: "Pedido de orçamento",
    body: `Os eventos acompanhados são visualização, início do formulário e formulário enviado. A conversão principal é o formulário enviado.

Esse envio pode ser um lead. Ele não prova, sozinho, que houve venda.`,
  }),
  block(17, "exemplo-destino", true, false, {
    type: "EXAMPLE",
    title: "Sistema externo",
    body: `O objetivo é levar a pessoa para outro destino. Os eventos acompanhados são visualização e clique na ação. A conversão principal é o clique na ação.

Depois do clique, a landing não controla o que acontece no site externo nem na página interna.`,
  }),
  heading(18, "metrica-nao-e-venda", "Métrica não é venda"),
  block(19, "sinal-nao-prova-venda", true, false, {
    type: "TEXT",
    body: `Formulário enviado pode ser um lead. Clique no WhatsApp pode ser uma oportunidade.

Nenhum dos dois prova automaticamente venda, receita ou cliente. Mais eventos também não significam uma análise melhor. Selecione somente os eventos úteis.`,
  }),
  block(20, "checkpoint-visualizacao", true, true, {
    type: "CHECKPOINT",
    question: "Uma visualização da página significa automaticamente que houve uma conversão?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. A visualização só diz que a página publicada foi carregada. Interesse, lead e venda são outras coisas.",
  }),
  heading(21, "conversao-principal", "Escolha um sinal"),
  block(22, "um-evento", true, false, {
    type: "TEXT",
    body: `A pergunta é: qual evento melhor representa o objetivo desta página? Você confirma a sugestão. Ela não é salva sozinha e não é uma verdade absoluta sobre o negócio.

Se a ação principal é WhatsApp, o clique no WhatsApp parece ser o sinal mais próximo do objetivo que a plataforma consegue medir. Se a ação leva ao formulário, o envio aceito é a sugestão. Se o objetivo é um destino externo ou uma página interna, o clique na ação é o que dá para medir aqui. A plataforma não finge saber o que ocorreu fora dela.`,
  }),
  block(23, "so-o-que-existe", true, false, {
    type: "TEXT",
    body: `A ferramenta mostra só os eventos que esta landing realmente pode contar. Sem formulário, o envio do formulário não aparece como conversão principal.

A visualização começa habilitada. A conversão principal precisa estar entre os eventos habilitados. Você pode desligar um evento que não ajuda a responder a pergunta.`,
  }),
  block(24, "checkpoint-whatsapp", true, true, {
    type: "CHECKPOINT",
    question: "Se o objetivo principal é receber contatos pelo WhatsApp, o clique no WhatsApp pode ser uma conversão principal coerente?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. O clique no WhatsApp é o sinal mais próximo dessa conversa que a página consegue contar. Ele ainda não prova a venda.",
  }),
  heading(25, "privacidade", "Contagem e lead são coisas diferentes"),
  block(26, "contagens-privadas", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "O que a plataforma guarda",
    body: `A plataforma registra contagens dos eventos configurados. Informações enviadas pelo formulário ficam separadas como leads privados.

Não há fingerprint persistente do visitante. O conteúdo do formulário não vai para Google, Meta nem OpenAI. Só o dono da landing acessa os leads.`,
  }),
  heading(27, "campos-do-formulario", "Campos do formulário"),
  block(28, "menos-campos", true, false, {
    type: "TEXT",
    body: `Se a página tem formulário, revise nome, e-mail, telefone, empresa e mensagem. Também dá para revisar o título, a descrição, o texto do botão e a mensagem de sucesso. A copy das outras seções fica como está.

Cada campo precisa ter uma razão para existir. Não há uma regra de que três campos convertem mais. Pergunte: você realmente precisa desta informação neste primeiro contato?

Obrigatório significa: não consigo receber um lead útil sem essa informação. Não marque tudo como obrigatório por padrão. E-mail e telefone não precisam ser obrigatórios ao mesmo tempo. A escolha depende de como o negócio vai responder.`,
  }),
  block(29, "checkpoint-campos", true, true, {
    type: "CHECKPOINT",
    question: "Um formulário deve pedir todas as informações que talvez sejam úteis no futuro?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. No primeiro contato, peça só o que falta para receber um lead útil.",
  }),
  block(30, "checkpoint-envio", true, true, {
    type: "CHECKPOINT",
    question: "O formulário enviado deve ser contado somente depois que o envio foi aceito com sucesso?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. O clique no botão, sem um envio válido e gravado, não é uma submissão.",
  }),
  block(31, "ferramenta-mensuracao", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_MEASUREMENT_TOOL,
    title: MEASUREMENT_RESULT_TITLE,
    description:
      "Revise a ação, escolha os eventos úteis, confirme a conversão principal e, se houver formulário, confira os campos. A simulação não grava visitas nem leads.",
  }),
  block(32, "resultado-mensuracao", false, true, {
    type: "RESULT",
    title: MEASUREMENT_RESULT_TITLE,
    prompt: "O resumo fica no resultado da aula. Telefone, endereço externo e respostas do formulário continuam fora deste resultado.",
    fields: [
      { key: "acao", label: "Ação principal" },
      { key: "conversao", label: "Conversão principal" },
      { key: "eventos", label: "Eventos acompanhados" },
      { key: "formulario", label: "Formulário presente" },
      { key: "campos", label: "Campos do formulário" },
      { key: "revisao", label: "Revisão de experiência" },
    ],
  }),
  block(33, "conclusao-mensuracao", true, false, {
    type: "CONCLUSION",
    body: `Agora você não tem apenas uma ação na página. Você definiu quais sinais mostram se essa ação está acontecendo.

Os dados começarão a aparecer depois que a página for publicada e utilizada. Na última etapa, vamos revisar tudo o que foi construído, corrigir pendências e colocar sua landing page no ar.`,
  }),
];
