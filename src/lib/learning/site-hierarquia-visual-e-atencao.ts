import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_VISUAL_TOOL, SITE_VISUAL_SLUG } from "@/lib/landing-page/theme/visual-direction";

export const SITE_LESSON_08_SLUG = SITE_VISUAL_SLUG;

export const siteLesson08Meta = {
  title: "Use hierarquia visual para conduzir a atenção",
  summary: "Defina o que o visitante percebe primeiro, com cores, contraste e destaque controlados.",
  publicPreview:
    "Duas páginas podem ter os mesmos textos e as mesmas seções. Nesta aula você decide o que ganha prioridade visual, sem editor gráfico livre.",
  estimatedMinutes: 30,
  accessType: "PAID" as const,
  priceCents: 3490,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson08Block = {
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
): SiteLesson08Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson08Blocks: SiteLesson08Block[] = [
  heading(1, "mesmos-textos-duas-paginas", "Os mesmos textos, duas páginas"),
  block(2, "abertura-contraste", true, false, {
    type: "TEXT",
    body: `Duas páginas podem ter exatamente os mesmos textos e as mesmas seções.

Uma pode ser clara, organizada e fácil de percorrer. A outra, confusa, cansativa e sem prioridade. A diferença pode estar na hierarquia visual: o que a pessoa percebe primeiro, o que parece importante e onde ela encontra a ação.`,
  }),
  block(3, "nao-e-curso-de-design", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Você não precisa virar designer",
    body: "A plataforma oferece opções controladas, regras de contraste, pontos de partida e a visualização da sua página. O aprendizado está em decidir, não em desenhar pixel a pixel.",
  }),
  heading(4, "o-que-percebe-primeiro", "O que a pessoa percebe primeiro"),
  block(5, "oferta-e-acao", true, false, {
    type: "TEXT",
    body: `Em geral, a oferta e a ação principal precisam ser percebidas com facilidade. Não existe uma regra estética rígida para isso.

A pergunta útil é simples: o visitante entende o que importa e encontra o próximo passo sem esforço?`,
  }),
  block(6, "exemplo-prioridade", true, false, {
    type: "EXAMPLE",
    title: "Onde você olha primeiro?",
    body: `Exemplo A: todas as seções usam o mesmo peso, o mesmo fundo e o mesmo destaque. A página fica cheia e nada se destaca.

Exemplo B: a abertura e o convite para a ação têm prioridade. O restante apoia a leitura. A diferença não é um tema bonito. É uma prioridade visual.`,
  }),
  heading(7, "hierarquia-e-decisao", "Hierarquia é uma decisão"),
  block(8, "decisoes-seguras", true, false, {
    type: "TEXT",
    body: `Hierarquia pode nascer de tamanho, peso, contraste, espaço, alinhamento, agrupamento, fundo, repetição e posição.

Você não edita esses valores um a um. O sistema visual traduz a decisão em opções seguras: cor, tipografia, largura, espaçamento, botões e o peso de cada seção.`,
  }),
  block(9, "tudo-em-destaque", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Se tudo chama atenção, nada chama atenção",
    body: "Destacar todas as seções enfraquece a prioridade. A ferramenta avisa quando o destaque, a cor principal ou o alinhamento central se repetem demais. O aviso não trava a página. Ele ajuda a revisar.",
  }),
  heading(10, "cor-organiza", "Cor organiza, não decora"),
  block(11, "papel-da-cor", true, false, {
    type: "TEXT",
    body: `A cor desta aula tem um papel funcional: fundo, texto, cor principal, contraste e destaque.

Não existe aqui a regra de que uma cor “vende mais” ou “transmite confiança” para todo negócio. A direção visual parte da sua comunicação, não de um setor.`,
  }),
  block(12, "cor-principal", true, false, {
    type: "TEXT",
    body: `A cor principal ajuda a identificar ações, elementos importantes e momentos de destaque.

Ela não precisa pintar a página inteira. Quando o fundo principal se repete em muitas seções seguidas, o destaque perde força.`,
  }),
  block(13, "checkpoint-destaque", true, true, {
    type: "CHECKPOINT",
    question: "Se todas as seções recebem muito destaque, a hierarquia fica mais clara?",
    options: [
      { id: "sim", label: "Sim — quanto mais destaque, mais clara a página" },
      { id: "nao", label: "Não — quando tudo se destaca, fica mais difícil perceber a prioridade" },
    ],
    correctOptionId: "nao",
    explanation: "Hierarquia depende de diferença. Se tudo recebe o mesmo peso, nada parece mais importante.",
  }),
  heading(14, "contraste-e-leitura", "Contraste é leitura"),
  block(15, "exemplo-contraste", true, false, {
    type: "EXAMPLE",
    title: "Texto que some e texto que se lê",
    body: `Um texto cinza muito claro sobre fundo branco pode parecer discreto e, na prática, ficar difícil de ler.

O mesmo texto com contraste suficiente continua legível. O botão também precisa continuar perceptível sobre a cor principal.`,
  }),
  block(16, "estados-de-contraste", true, false, {
    type: "TEXT",
    body: `A ferramenta avalia as combinações principais e responde em linguagem humana: Bom, Precisa de atenção ou Crítico.

Uma combinação crítica não pode ser salva. Atenção avisa e ainda permite seguir. O detalhe numérico fica disponível, mas não é a experiência principal. Essa checagem não substitui uma auditoria completa de acessibilidade.`,
  }),
  block(17, "checkpoint-cor-bonita", true, true, {
    type: "CHECKPOINT",
    question: "Uma cor bonita é suficiente se o texto fica difícil de ler?",
    options: [
      { id: "sim", label: "Sim — a preferência visual vem primeiro" },
      { id: "nao", label: "Não — o texto precisa continuar legível" },
    ],
    correctOptionId: "nao",
    explanation: "Contraste não é só preferência. Sem leitura, a hierarquia não chega ao visitante.",
  }),
  heading(18, "tipografia-e-ritmo", "Tipografia, largura e ritmo"),
  block(19, "leitura-largura-espaco", true, false, {
    type: "TEXT",
    body: `A tipografia precisa favorecer leitura, hierarquia e coerência. As famílias disponíveis são Sem serifa do sistema, Inter e Serifada.

A escala dos títulos pode ser Compacta, Equilibrada ou Expressiva. A largura pode ser Estreita, Padrão ou Larga. Mais largo não significa melhor: uma linha longa demais pode cansar a leitura.

O espaçamento entre seções pode ser Compacto, Confortável ou Espaçoso. O espaço separa grupos, cria ritmo e ajuda a compreensão.`,
  }),
  block(20, "exemplo-espacamento", true, false, {
    type: "EXAMPLE",
    title: "Grupos comprimidos e grupos separados",
    body: `Quando títulos, textos e botões ficam colados, a página parece um bloco só.

Quando os grupos ganham espaço, fica mais fácil perceber onde uma ideia termina e a próxima começa.`,
  }),
  block(21, "densidade-formato-botoes", true, false, {
    type: "TEXT",
    body: `A densidade é um ajuste avançado, diferente do espaço entre seções. Ela muda o respiro dentro dos grupos: Compacta, Equilibrada ou Arejada.

O formato da interface pode ser Reto, Suave ou Arredondado. Isso não representa um setor.

O botão principal pode ser Preenchido ou em Contorno. A ação principal precisa de prioridade visual. Uma ação secundária pode ter menos peso. O destino do botão não muda nesta aula.`,
  }),
  block(22, "checkpoint-centralizar", true, true, {
    type: "CHECKPOINT",
    question: "Centralizar todo o conteúdo é sempre a melhor escolha?",
    options: [
      { id: "sim", label: "Sim — centralizado é sempre mais bonito" },
      { id: "nao", label: "Não — o alinhamento precisa favorecer a leitura e a prioridade" },
    ],
    correctOptionId: "nao",
    explanation: "Centralizar pode funcionar em momentos curtos. Em conteúdos longos, o alinhamento à esquerda costuma facilitar a leitura.",
  }),
  block(23, "checkpoint-espacamento", true, true, {
    type: "CHECKPOINT",
    question: "Espaçamento pode ajudar o visitante a perceber grupos e prioridades?",
    options: [
      { id: "sim", label: "Sim — o espaço separa ideias e organiza o percurso" },
      { id: "nao", label: "Não — espaço é só decoração" },
    ],
    correctOptionId: "sim",
    explanation: "Espaço não é sobra. Ele ajuda a separar grupos e a mostrar o que vem primeiro.",
  }),
  heading(24, "peso-das-secoes", "Cada seção tem um peso"),
  block(25, "ajustes-por-secao", true, false, {
    type: "TEXT",
    body: `Cada seção usa um papel do tema, não uma cor solta.

Fundo principal, fundo secundário, cor principal ou destaque. O alinhamento pode ficar à esquerda ou centralizado. Ênfase normal mantém o peso. Em destaque significa que aquela seção merece mais peso visual — não que todas devam ser importantes.

A abertura pode ficar em coluna, centralizada ou com o texto em duas colunas. Benefícios podem ser lista ou cartões. O processo pode ser empilhado ou em passos. As dúvidas permanecem em lista. O convite pode ser simples ou em faixa.`,
  }),
  block(26, "pontos-de-partida", true, false, {
    type: "TEXT",
    body: `Claro, Sóbrio, Contraste e Editorial são pontos de partida. Eles preenchem o visual para você personalizar depois. Não são temas prontos para um tipo de negócio.

Logo, foto, portfólio e depoimentos visuais entram na próxima etapa. Aqui a hierarquia se define com o que a página já tem.`,
  }),
  heading(27, "defina-a-direcao", "Defina a direção visual"),
  block(28, "ferramenta-visual", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_VISUAL_TOOL,
    title: "Direção visual da minha landing page",
    description: "Veja a página atual, escolha um ponto de partida, ajuste cores e ritmo, defina o peso das seções e confirme.",
  }),
  block(29, "atividade-prioridade", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: "O que o visitante da sua página precisa perceber primeiro? Escreva em uma frase. Isso não altera o texto das seções.",
  }),
  block(30, "resultado-visual", false, true, {
    type: "RESULT",
    title: "Direção visual da minha landing page",
    prompt: "O resumo fica no resultado da aula. O tema e os ajustes continuam no projeto da página.",
    fields: [
      { key: "partida", label: "Ponto de partida" },
      { key: "prioridade", label: "Prioridade visual" },
      { key: "destaques", label: "Seções em destaque" },
      { key: "avisos", label: "Avisos revisados" },
    ],
  }),
  heading(31, "o-que-voce-tem-agora", "O que você tem agora"),
  block(32, "conclusao-hierarquia", true, false, {
    type: "CONCLUSION",
    body: `Agora sua landing page já possui estrutura, mensagem e uma hierarquia visual definida.

Não foi escolhido apenas um tema bonito. Foram definidas prioridades visuais: o que se destaca, o que permanece legível e como a página pode ser percorrida.`,
  }),
  block(33, "proxima-confianca", true, false, {
    type: "TEXT",
    body: `Na próxima etapa, vamos trabalhar com aquilo que ajuda o visitante a confiar: provas, portfólio, credenciais, processo e informações reais do seu negócio.

A próxima aula se chama “Construa confiança antes de pedir a ação”.`,
  }),
];
