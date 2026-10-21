import type { LessonBlockData } from "@/lib/learning/blocks";
import { LANDING_PAGE_COPY_TOOL, SITE_COPY_SLUG } from "@/lib/learning/landing-page-copy";

export const SITE_LESSON_07_SLUG = SITE_COPY_SLUG;

export const siteLesson07Meta = {
  title: "Escreva uma mensagem que deixa sua oferta clara",
  summary: "Transforme as seções da página em mensagens reais, revisadas e aprovadas por você.",
  publicPreview:
    "Uma estrutura correta ainda pode falhar se a oferta não ficar clara. Nesta aula você escreve, compara e aprova o texto de cada seção.",
  estimatedMinutes: 35,
  accessType: "PAID" as const,
  priceCents: 3990,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson07Block = {
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
): SiteLesson07Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson07Blocks: SiteLesson07Block[] = [
  heading(1, "estrutura-ainda-nao-e-mensagem", "Uma estrutura ainda não é uma mensagem"),
  block(2, "abertura-contraste", true, false, {
    type: "TEXT",
    body: `Uma estrutura correta ainda pode falhar se o visitante não entender rapidamente o que está sendo oferecido.

Até aqui a página tem blocos. Agora esses blocos viram mensagens. Você decide o que precisa ser dito, escreve ou pede uma sugestão, compara, edita e só então aprova.`,
  }),
  block(3, "callout-clareza", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Clareza antes de criatividade",
    body: "Uma copy boa não precisa parecer genial. Primeiro ela precisa ser clara, coerente, específica, verdadeira e orientada à ação.",
  }),
  heading(4, "cada-texto-cumpre-funcao", "Cada texto cumpre uma função"),
  block(5, "funcoes-das-secoes", true, false, {
    type: "TEXT",
    body: `O texto não é enfeite. Cada seção tem um trabalho.

A abertura dá clareza. O contexto gera identificação, sem amedrontar. A solução conecta a oferta a esse contexto. Os benefícios mostram valor a partir de fatos reais. O processo reduz incerteza quando as etapas existem. As dúvidas resolvem objeções reais. O convite apresenta o próximo passo.`,
  }),
  heading(6, "headline-e-complemento", "Headline e complemento"),
  block(7, "headline-subheadline", true, false, {
    type: "TEXT",
    body: `A headline ajuda a pessoa a entender rapidamente o que está sendo oferecido e qual relevância isso tem para ela. Não existe uma fórmula rígida para isso.

A linha de apoio completa o contexto que a headline não comporta. Ela não deve repetir a headline com outras palavras.`,
  }),
  heading(8, "rotulo-nao-muda-destino", "O rótulo não muda o destino"),
  block(9, "acao-e-rotulo", true, false, {
    type: "TEXT",
    body: `A ação já foi definida na estratégia. Agora você escreve como ela aparece.

Se a ação é uma conversa no WhatsApp, o botão pode dizer “Falar sobre meu projeto”. O destino continua o mesmo. A sugestão pode propor o rótulo. Ela não pode trocar o alvo nem a configuração da ação.`,
  }),
  block(10, "checkpoint-headline-clara", true, true, {
    type: "CHECKPOINT",
    question: "Uma headline criativa é necessariamente melhor do que uma headline clara?",
    options: [
      { id: "sim", label: "Sim — o visitante lembra mais de uma frase engenhosa" },
      { id: "nao", label: "Não — primeiro a pessoa precisa entender a oferta" },
    ],
    correctOptionId: "nao",
    explanation: "Criatividade pode ajudar depois. Sem clareza, a pessoa não entende o que está sendo oferecido.",
  }),
  heading(11, "beneficio-verdadeiro", "Benefício vem de um fato"),
  block(12, "beneficio-nao-e-promessa", true, false, {
    type: "TEXT",
    body: `Um benefício precisa nascer de uma informação real. Característica não vira promessa sozinha.

Se a página ainda não tem benefícios suficientes, a ferramenta pede os fatos. Ela não completa o que você não informou.`,
  }),
  block(13, "exemplo-atendimento", true, false, {
    type: "EXAMPLE",
    title: "Característica e benefício",
    body: `Característica informada: atendimento online.

Benefício possível, somente se for verdadeiro: você pode realizar o atendimento sem se deslocar.

Se isso não for verdade no seu negócio, esse benefício não entra.`,
  }),
  heading(14, "contexto-oferta-duvidas", "Contexto, oferta e dúvidas"),
  block(15, "problema-e-solucao", true, false, {
    type: "TEXT",
    body: `O contexto usa o problema que você já descreveu. A identificação não precisa exagerar nem inventar dor.

A oferta aparece como resposta coerente a esse contexto. Frases genéricas, sem fundamento no que você informou, não ajudam o visitante a decidir.`,
  }),
  block(16, "processo-factual", true, false, {
    type: "TEXT",
    body: `Se a página tem uma seção de processo, ela precisa das etapas reais. Quando essas etapas ainda não existem no projeto, a ferramenta não inventa um processo. Ela pergunta como isso funciona na prática e deixa você cadastrar os passos.`,
  }),
  block(17, "confianca-sem-prova-falsa", true, false, {
    type: "TEXT",
    body: `A seção de confiança depende de provas reais. Uma aula posterior aprofunda como apresentar essa confiança.

Aqui você pode escrever uma introdução neutra ou registrar uma prova que já possui. Sem prova, a seção permanece pendente. Nada de depoimento, número de clientes ou certificação inventados.`,
  }),
  block(18, "faq-com-fatos", true, false, {
    type: "TEXT",
    body: `As dúvidas partem das objeções que você já registrou. Uma objeção pode virar pergunta.

A resposta só é escrita quando existe um fato suficiente. Se a resposta ainda não existe, a ferramenta pede essa informação a você.`,
  }),
  heading(19, "sugestao-nao-entra-sozinha", "A sugestão não entra sozinha"),
  block(20, "copy-assistida", true, false, {
    type: "TEXT",
    body: `A plataforma pode sugerir formas de escrever usando as informações que você já definiu.

A sugestão não entra automaticamente na sua página. Você compara até três opções, edita se quiser e decide o que usar. Também pode escrever tudo por conta própria.`,
  }),
  block(21, "ia-nao-sabe-tudo", true, false, {
    type: "TEXT",
    body: `A plataforma trabalha com as informações que você mesmo forneceu. Quando algo falta, ela pede o dado. Não completa o negócio por conta própria.`,
  }),
  block(22, "exemplo-quinhentos-clientes", true, false, {
    type: "EXAMPLE",
    title: "Fato que não foi informado",
    body: `Pergunta: você possui 500 clientes?

Isso não foi informado. A resposta correta da plataforma é pedir a informação. Inventar “mais de 500 clientes” não é uma sugestão aceitável.`,
  }),
  block(23, "checkpoint-fato-plausivel", true, true, {
    type: "CHECKPOINT",
    question: "Se a IA não conhece um fato sobre seu negócio, ela deve completar com algo plausível?",
    options: [
      { id: "sim", label: "Sim — uma hipótese plausível adianta o texto" },
      { id: "nao", label: "Não — ela deve pedir a informação que falta" },
    ],
    correctOptionId: "nao",
    explanation: "Uma frase plausível ainda pode ser falsa. Sem o fato, a seção fica pendente até você informar.",
  }),
  block(24, "checkpoint-revisar-sugestao", true, true, {
    type: "CHECKPOINT",
    question: "Usar uma sugestão da IA significa que você deve publicá-la sem revisar?",
    options: [
      { id: "sim", label: "Sim — a sugestão já entra pronta na página" },
      { id: "nao", label: "Não — você revisa, edita e só então aprova" },
    ],
    correctOptionId: "nao",
    explanation: "Aplicar uma sugestão deixa o texto em revisão. Aprovar é uma decisão sua, e ainda pode ser revista depois.",
  }),
  block(25, "checkpoint-rotulo-destino", true, true, {
    type: "CHECKPOINT",
    question: "O texto do botão pode mudar sem mudar o destino da ação?",
    options: [
      { id: "sim", label: "Sim — o rótulo muda e o destino definido continua" },
      { id: "nao", label: "Não — mudar o texto troca também o destino" },
    ],
    correctOptionId: "sim",
    explanation: "A ação já foi decidida. O texto do botão só descreve essa ação.",
  }),
  heading(26, "escreva-a-mensagem", "Escreva a mensagem"),
  block(27, "ferramenta-copy", true, true, {
    type: "TOOL",
    toolKey: LANDING_PAGE_COPY_TOOL,
    title: "Copy da minha landing page",
    description: "Entenda a função de cada seção, escreva ou peça sugestões, revise e aprove o texto.",
  }),
  block(28, "atividade-o-que-dizer", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: "Escolha a abertura da sua página e escreva, em uma frase, o que o visitante precisa entender nos primeiros segundos. Use só fatos que você já definiu.",
  }),
  block(29, "resultado-copy", false, true, {
    type: "RESULT",
    title: "Copy da minha landing page",
    prompt: "O resumo fica no resultado da aula. O texto aprovado permanece nas seções do projeto.",
    fields: [
      { key: "secoes", label: "Seções principais aprovadas" },
      { key: "opcionais", label: "Seções opcionais em revisão" },
      { key: "origem", label: "Como os textos foram escritos" },
    ],
  }),
  heading(30, "o-que-voce-tem-agora", "O que você tem agora"),
  block(31, "conclusao-mensagem-real", true, false, {
    type: "CONCLUSION",
    body: `Agora sua landing page não é mais apenas um wireframe. Ela já comunica sua oferta com textos que você revisou e aprovou.

Você ainda pode editar qualquer seção. Aprovar significa que o texto está pronto para seguir, não que ficou trancado.`,
  }),
  block(32, "proxima-hierarquia", true, false, {
    type: "TEXT",
    body: `Na próxima etapa, vamos trabalhar como essa mensagem aparece visualmente — o que ganha destaque, como a página respira e como o visitante percebe a prioridade de cada elemento.

A próxima aula se chama “Use hierarquia visual para conduzir a atenção”.`,
  }),
];
