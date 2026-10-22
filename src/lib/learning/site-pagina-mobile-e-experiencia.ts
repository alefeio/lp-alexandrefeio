import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_EXPERIENCE_TOOL, SITE_EXPERIENCE_SLUG } from "@/lib/landing-page/experience/lesson-flow";

export const SITE_LESSON_10_SLUG = SITE_EXPERIENCE_SLUG;

export const siteLesson10Meta = {
  title: "Prepare sua página para o celular e uma boa experiência",
  summary: "Revise se a pessoa consegue entender, ler e agir na landing page em larguras diferentes.",
  publicPreview:
    "Uma página pode parecer ótima no notebook de quem criou e ainda ser difícil de usar no celular. Nesta aula você revisa a experiência real.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson10Block = {
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
): SiteLesson10Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

const yesNo = () => [
  { id: "sim", label: "Sim" },
  { id: "nao", label: "Não" },
];

export const siteLesson10Blocks: SiteLesson10Block[] = [
  heading(1, "abertura", "A página no notebook não é a página de todo mundo"),
  block(2, "pagina-no-celular", true, false, {
    type: "TEXT",
    body: `Uma página pode parecer ótima no notebook de quem criou e ainda ser difícil de usar no celular.

A pessoa real pode chegar pelo celular, pelo tablet ou pelo computador. A página precisa se adaptar sem perder clareza, prioridade, legibilidade e a ação que você quer que ela faça.`,
  }),
  heading(3, "nao-e-versao-menor", "Mobile não é uma versão menor"),
  block(4, "adaptar-sem-encolher", true, false, {
    type: "TEXT",
    body: `Responsivo não significa diminuir tudo. Elementos podem empilhar, mudar de largura, quebrar linha e ganhar outro ritmo.

O que não pode mudar é a chance de entender a oferta e de agir. Um botão precisa continuar fácil de tocar. Um título precisa continuar compreensível quando a linha quebra.`,
  }),
  heading(5, "o-que-revisar", "O que revisar"),
  block(6, "grupos-de-revisao", true, false, {
    type: "TEXT",
    body: `Agrupe a revisão em leitura, ação, hierarquia, conteúdo, formulário, mídia, acessibilidade e fricção.

Leitura: o texto cabe sem zoom, a headline quebra de forma compreensível, os parágrafos não ficam largos demais, existe espaço entre grupos e a FAQ continua legível.
Ação: você encontra a ação principal, o botão está visível, o texto do botão faz sentido e o destino está configurado. Não existe uma regra de que o botão precise estar sempre no topo.
Hierarquia: no celular, ainda dá para perceber o que é mais importante.
Conteúdo: texto suficiente no computador pode parecer pesado no celular. Antes de cortar, avalie clareza, necessidade e repetição.
Formulário: nesta etapa a revisão é da estrutura visual — rótulos, quantidade de campos, compreensão, tamanho e consentimento quando ele estiver configurado.
Mídia: a imagem corta algo importante, ocupa espaço demais, o portfólio continua compreensível e os depoimentos ficam legíveis.
Acessibilidade, de modo prático: contraste, texto alternativo, rótulos, foco e botões compreensíveis. Isso não é uma auditoria completa de acessibilidade.
Fricção: o que atrasa a pessoa. Muitas imagens pesadas podem afetar a percepção de velocidade. Não vamos medir pontuação de velocidade nesta aula.`,
  }),
  heading(7, "leitura", "Leitura"),
  block(8, "perguntas-de-leitura", true, false, {
    type: "TEXT",
    body: `No celular pequeno, pergunte: consigo ler sem rolagem horizontal? A headline está compreensível? Os textos não estão cortados?

Se a página ultrapassa a largura da tela, isso impede considerar a revisão concluída. No computador, pergunte se os parágrafos não ficaram largos demais e se ainda existe espaço entre os grupos.`,
  }),
  heading(9, "acao", "Ação"),
  block(10, "perguntas-de-acao", true, false, {
    type: "TEXT",
    body: `Consigo encontrar a ação principal? O botão está visível? O texto do botão faz sentido? O destino está configurado?

Um botão de WhatsApp sem número, por exemplo, impede a pessoa de agir. Botões também precisam ser fáceis de tocar. A ação pode aparecer de novo mais abaixo. O problema é perdê-la, não a posição exata na primeira dobra.`,
  }),
  block(11, "exemplo-desktop-mobile", true, false, {
    type: "EXAMPLE",
    title: "Boa no computador, difícil no celular",
    body: "No notebook, a headline e o botão aparecem juntos. No celular, o título ocupa a tela inteira e a ação fica depois de muito conteúdo. A página não ficou conceitualmente errada, mas a pessoa demora a entender o próximo passo. Vale reduzir o peso visual do título ou aproximar a ação do que ela acabou de ler.",
  }),
  heading(12, "hierarquia", "Hierarquia no celular"),
  block(13, "aula-hierarquia", true, false, {
    type: "TEXT",
    body: `Na aula de hierarquia visual você definiu o que merece atenção primeiro. Agora a pergunta muda de lugar: no celular, ainda consigo perceber o que é mais importante?

Uma composição boa no computador pode perder hierarquia quando os blocos empilham. Imagem, título e botão passam a competir na mesma coluna.`,
  }),
  heading(14, "conteudo", "Conteúdo"),
  block(15, "nao-cortar-automatico", true, false, {
    type: "TEXT",
    body: "Texto suficiente no computador pode parecer pesado no celular. Não corte o texto automaticamente. Primeiro avalie se ele está claro, se ele é necessário e se ele repete o que a seção anterior já disse.",
  }),
  heading(16, "formulario", "Formulário"),
  block(17, "estrutura-do-formulario", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "O envio ainda não funciona",
    body: "Nesta aula você revisa só a estrutura visual: rótulos, quantidade de campos, compreensão, tamanho e o consentimento quando ele estiver configurado. Na próxima etapa configuraremos o que precisa ser medido e o funcionamento das ações. Não trate o formulário como se o envio já acontecesse.",
  }),
  heading(18, "midia", "Mídia"),
  block(19, "exemplo-imagem-grande", true, false, {
    type: "EXAMPLE",
    title: "A imagem ocupa a tela",
    body: "Uma foto grande pode fazer sentido no computador e, no celular, empurrar a oferta para baixo. A página não está errada por ter imagem. A experiência piora quando a imagem chama mais atenção do que a oferta ou corta o que precisava ser visto. Não há um editor de corte nesta aula: o ajuste volta para a mídia já escolhida.",
  }),
  heading(20, "acessibilidade", "Acessibilidade prática"),
  block(21, "exemplo-contraste", true, false, {
    type: "EXAMPLE",
    title: "Texto claro, botão difícil de ler",
    body: "A página explica a oferta com clareza, mas o botão usa cores próximas demais. A pessoa vê o bloco e ainda assim não lê o pedido de ação. Esse ponto liga a hierarquia visual desta etapa: uma combinação bonita pode falhar na leitura. Contraste crítico precisa ser resolvido antes de concluir a revisão.",
  }),
  block(22, "checkpoint-desktop", true, true, {
    type: "CHECKPOINT",
    question: "Se a página funciona no desktop, podemos assumir que funcionará bem no celular?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. Uma composição confortável no computador pode empilhar, perder hierarquia ou esconder a ação no celular.",
  }),
  heading(23, "achados", "O que a plataforma encontra"),
  block(24, "revisao-automatica-e-humana", true, false, {
    type: "TEXT",
    body: `A plataforma pode identificar alguns pontos automaticamente: conteúdo provisório, texto ainda em revisão, contraste, destino da ação, imagem sem texto alternativo e provas que não podem aparecer.

Ela não enxerga tudo como uma pessoa real. Por isso a revisão automática convive com a sua revisão. Você pode adicionar uma observação curta, como “esse botão ficou difícil de perceber no celular”, “esse parágrafo parece longo” ou “a imagem chama mais atenção que a oferta”.`,
  }),
  block(25, "checkpoint-aviso", true, true, {
    type: "CHECKPOINT",
    question: "Todo aviso encontrado pela plataforma significa que a página está errada?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. Uma observação orienta. Um ponto que precisa de atenção pode ser resolvido ou adiado com consciência. Só o que impede a revisão concluída precisa ser resolvido agora.",
  }),
  heading(26, "gravidade", "Observação, atenção e o que precisa ser resolvido"),
  block(27, "como-tratar-avisos", true, false, {
    type: "TEXT",
    body: `Observação orienta e não bloqueia. Um exemplo é o aviso de que o envio real do formulário será configurado em uma etapa posterior.

Precisa de atenção pode ser resolvido ou adiado. Se você adiar, reconhece que o ponto existe. Não é preciso escrever uma justificativa longa. O aviso continua visível, e você poderá voltar a ele antes de publicar.

Precisa ser resolvido não significa que a página é ruim. Significa que esse problema impede considerar a revisão concluída. Conteúdo provisório, contraste crítico e ação sem destino entram aqui.

Se você sair para corrigir a página, a revisão fica desatualizada quando você voltar. Reavaliar é o caminho esperado.`,
  }),
  block(28, "checkpoint-contraste", true, true, {
    type: "CHECKPOINT",
    question: "Um problema de contraste pode afetar a leitura mesmo que as cores pareçam bonitas?",
    options: yesNo(),
    correctOptionId: "sim",
    explanation: "Sim. Cores agradáveis ainda podem deixar o texto ou o botão difíceis de ler.",
  }),
  heading(29, "rever-de-novo", "A revisão pode ser feita de novo"),
  block(30, "checkpoint-unica", true, true, {
    type: "CHECKPOINT",
    question: "Revisar uma página é uma etapa única que nunca precisa ser repetida?",
    options: yesNo(),
    correctOptionId: "nao",
    explanation: "Não. Se a página mudar depois, a revisão anterior fica desatualizada e precisa ser refeita antes da próxima etapa.",
  }),
  block(31, "ferramenta-experiencia", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_EXPERIENCE_TOOL,
    title: "Revisão de experiência da minha landing page",
    description:
      "Abra a página real, revise o celular pequeno, o celular, o tablet e o computador, entenda os avisos e registre o que você percebeu.",
  }),
  block(32, "resultado-experiencia", false, true, {
    type: "RESULT",
    title: "Revisão de experiência da minha landing page",
    prompt: "O resumo fica no resultado da aula. Os avisos continuam no rascunho da página.",
    fields: [
      { key: "viewports", label: "Larguras revisadas" },
      { key: "bloqueios", label: "Bloqueios" },
      { key: "atencoes", label: "Atenções" },
      { key: "adiadas", label: "Adiadas" },
      { key: "observacoes", label: "Observações suas" },
      { key: "resolvidas", label: "Resolvidas" },
    ],
  }),
  block(33, "conclusao-experiencia", true, false, {
    type: "CONCLUSION",
    body: `Agora sua landing page não foi apenas construída — ela foi revisada como uma experiência.

Na próxima etapa, vamos definir como você saberá se as ações importantes realmente aconteceram. A próxima aula se chama “Configure o que precisa ser medido”.`,
  }),
];
