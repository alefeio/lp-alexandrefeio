import type { LessonBlockData } from "@/lib/learning/blocks";
import { CONVERSION_JOURNEY_MAP_TOOL, SITE_AJUDA_A_VENDER_SLUG } from "@/lib/learning/conversion-journey-map";

export const SITE_LESSON_01_SLUG = SITE_AJUDA_A_VENDER_SLUG;

export const siteLesson01Meta = {
  title: "Seu site realmente ajuda a vender?",
  summary: "Entenda se a presença digital atual conduz o visitante até uma ação real do negócio.",
  publicPreview:
    "Um site não precisa existir só para parecer profissional. Nesta aula você constrói o mapa Origem → Página → Ação → Resultado aplicado ao seu próprio negócio.",
  estimatedMinutes: 25,
  accessType: "FREE" as const,
  priceCents: null,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson01Block = {
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
): SiteLesson01Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson01Blocks: SiteLesson01Block[] = [
  heading(1, "site-no-ar-e-agora", "O site está no ar. E agora?"),
  block(2, "abertura-site-bonito", true, false, {
    type: "TEXT",
    body: `O site está no ar.
A empresa aparece bonita.
Há fotos, textos e WhatsApp.

Mas o que exatamente a pessoa deveria fazer depois de entrar?

Essa pergunta parece simples. Na prática, muita presença digital para aí: a página apresenta a empresa, mas não deixa claro o próximo passo nem o que essa visita deveria gerar para o negócio.`,
  }),
  block(3, "callout-funcao-da-pagina", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "A primeira mudança de olhar",
    body: `Um site não deve existir apenas para estar bonito ou apresentar a empresa.

Ele precisa cumprir uma função dentro da jornada do visitante.`,
  }),
  heading(4, "bonito-x-util", "Site bonito × site útil"),
  block(5, "beleza-nao-e-conversao", true, false, {
    type: "TEXT",
    body: `Uma página pode parecer profissional e ainda assim:

- não deixar clara a oferta;
- não indicar o próximo passo;
- não conectar a visita a uma ação;
- gerar visitas sem oportunidades.

Por outro lado, uma página simples pode cumprir muito bem sua função quando existe clareza.

Design bonito pode ajudar. Boa apresentação visual contribui para compreensão, confiança, percepção de qualidade, hierarquia e tomada de decisão.

O problema é outra:

beleza ≠ clareza  
beleza ≠ conversão  
beleza ≠ resultado

Estética sem função clara raramente ajuda o negócio.`,
  }),
  block(6, "checkpoint-site-bonito-converte", true, true, {
    type: "CHECKPOINT",
    question: "Um site bonito necessariamente converte?",
    options: [
      { id: "sim", label: "Sim — se estiver bem desenhado, já converte" },
      { id: "nao", label: "Não — beleza ajuda, mas não substitui função e clareza" },
    ],
    correctOptionId: "nao",
    explanation: "Apresentação visual pode ajudar, mas não garante clareza, ação principal nem resultado para o negócio.",
  }),
  heading(7, "funcao-principal", "Toda página importante precisa de uma função"),
  block(8, "exemplos-de-funcao", true, false, {
    type: "TEXT",
    body: `Toda página importante deveria ter uma função principal.

Por exemplo:

- gerar pedido de orçamento;
- iniciar conversa;
- agendar;
- solicitar demonstração;
- cadastrar interesse;
- comprar;
- conhecer determinada solução;
- avançar para outro estágio da decisão.

Isso não significa que toda visita precise virar lead ou venda na hora. Significa que a página precisa ter um papel claro no caminho do visitante.`,
  }),
  block(9, "callout-nao-e-so-vender", true, false, {
    type: "CALLOUT",
    tone: "tip",
    title: "Nem toda página vende sozinha",
    body: `Algumas páginas informam, geram confiança, apresentam, direcionam ou apoiam uma decisão.

Em uma presença digital orientada ao negócio, o que não pode faltar é função clara.`,
  }),
  heading(10, "jornada-antes-da-pagina", "A jornada começa antes da página"),
  block(11, "origem-muda-expectativa", true, false, {
    type: "TEXT",
    body: `A pessoa não surge dentro do site. Ela vem de algum lugar.

Pode chegar pelo Google, Instagram, anúncio, indicação, QR Code, link direto, WhatsApp, e-mail ou outro site.

A origem muda expectativa, intenção, nível de conhecimento e a mensagem que a pessoa espera encontrar.

Nesta aula não vamos aprofundar tráfego pago. O foco é enxergar o caminho completo: origem → página → ação → resultado.`,
  }),
  block(12, "checkpoint-jornada-comeca-no-site", true, true, {
    type: "CHECKPOINT",
    question: "A jornada do visitante começa dentro do site?",
    options: [
      { id: "sim", label: "Sim — ela começa quando a pessoa abre a página" },
      { id: "nao", label: "Não — ela começa na origem, antes da página" },
    ],
    correctOptionId: "nao",
    explanation: "A pessoa chega de algum lugar. A origem já molda o que ela espera encontrar na página.",
  }),
  heading(13, "quatro-etapas", "Origem → Página → Ação → Resultado"),
  block(14, "definir-as-quatro-partes", true, false, {
    type: "TEXT",
    body: `Use este modelo simples.

1. Origem

De onde o visitante chegou. Não confundir com resultado. Instagram, por exemplo, pode ser origem — e WhatsApp pode ser origem ou ação, dependendo da jornada.

2. Página

Onde a pessoa chega para entender algo e decidir o próximo passo. Pode ser home, landing page, página de serviço, produto ou institucional. A escolha da estrutura ideal fica para a próxima aula.

3. Ação

O comportamento que queremos estimular na página: clicar no WhatsApp, enviar formulário, agendar, ligar, solicitar orçamento, comprar, criar conta ou continuar para outra página. Prefira uma ação principal clara, mesmo que existam ações secundárias.

4. Resultado

A consequência de negócio que essa ação ajuda a produzir. Um clique no WhatsApp não é automaticamente uma venda. Pode gerar conversa, lead, orçamento, agendamento ou oportunidade — e a venda pode vir depois.`,
  }),
  block(15, "callout-acao-nao-e-resultado", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Ação ≠ resultado",
    body: `Clique no WhatsApp ≠ venda  
Formulário enviado ≠ cliente  
Cadastro ≠ assinatura  
Agendamento ≠ comparecimento  

Em alguns negócios a compra pode ser o resultado direto. Em muitos outros, a primeira ação só abre a oportunidade.`,
  }),
  block(16, "checkpoint-whatsapp-e-venda", true, true, {
    type: "CHECKPOINT",
    question: "Clique no WhatsApp é sempre uma venda?",
    options: [
      { id: "sim", label: "Sim — se a pessoa clicou, já comprou" },
      { id: "nao", label: "Não — clique é ação; a venda é um resultado posterior" },
    ],
    correctOptionId: "nao",
    explanation: "O clique é uma ação. O resultado de negócio pode ser conversa, lead, orçamento ou venda depois.",
  }),
  block(17, "o-que-e-conversao", true, false, {
    type: "TEXT",
    body: `Conversão, em linguagem simples, é quando o visitante realiza uma ação que definimos como importante.

Isso é diferente do resultado comercial final. Uma conversão digital pode ser um formulário enviado; o resultado comercial pode ser um orçamento aceito ou uma venda fechada.

Nesta aula, o objetivo é enxergar o caminho — não configurar analytics.`,
  }),
  heading(18, "exemplos-praticos", "Três caminhos na prática"),
  block(19, "exemplo-moveis", true, false, {
    type: "EXAMPLE",
    title: "Móveis planejados",
    body: `Origem: Google  
Página: Cozinhas planejadas  
Ação: Solicitar orçamento  
Resultado: Oportunidade comercial  

A página não precisa “vender a cozinha” sozinha. Ela precisa ajudar a pessoa a avançar.`,
  }),
  block(20, "exemplo-servico", true, false, {
    type: "EXAMPLE",
    title: "Profissional de serviço",
    body: `Origem: Instagram  
Página: Página do serviço  
Ação: Agendar uma conversa  
Resultado: Potencial cliente  

Aqui a primeira ação cria contato útil. Não há promessa financeira embutida — só um próximo passo claro.`,
  }),
  block(21, "exemplo-curso-plataforma", true, false, {
    type: "EXAMPLE",
    title: "Curso digital (esta plataforma)",
    body: `Origem: Google ou rede social  
Página: Página do curso  
Ação: Começar aula gratuita  
Resultado: Aluno inicia a jornada  

Depois, outras ações podem levar à compra. A primeira ação não precisa ser imediatamente a venda.`,
  }),
  heading(22, "home-e-friccao", "Uma ação principal — e fricção"),
  block(23, "home-faca-tudo", true, false, {
    type: "TEXT",
    body: `Uma página pode ter muitas informações. O problema começa quando ela não facilita a compreensão do próximo passo.

Não existe regra rígida de “só um botão”. O que funciona melhor na prática é:

uma ação principal  
+  
ações secundárias coerentes

Fricção é tudo que torna mais difícil entender ou realizar esse próximo passo: CTA escondido, texto confuso, formulário enorme, informação contraditória, página lenta ou mobile ruim.

Nesta aula você só precisa perceber a fricção — não corrigir layout, copy ou mensuração ainda.`,
  }),
  block(24, "checkpoint-acoes-secundarias", true, true, {
    type: "CHECKPOINT",
    question: "Uma página pode ter ações secundárias?",
    options: [
      { id: "nao", label: "Não — só pode existir um único botão" },
      { id: "sim", label: "Sim — desde que exista uma ação principal clara" },
    ],
    correctOptionId: "sim",
    explanation: "Ações secundárias podem existir. O que precisa ficar claro é a hierarquia: qual é o passo principal.",
  }),
  block(25, "atividade-uma-oferta", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: `Escolha uma oferta

Antes de montar o mapa, pense em UMA oferta ou serviço.

Responda:

1. O que quero promover?
2. De onde as pessoas costumam chegar?
3. Onde elas chegam?
4. O que quero que façam?
5. O que isso representa para o negócio?

Não precisa estar perfeito. O objetivo é registrar o caminho atual.`,
    placeholder: "Descreva a oferta e o caminho atual em poucas linhas.",
  }),
  block(26, "tool-mapa-conversao", true, true, {
    type: "TOOL",
    toolKey: CONVERSION_JOURNEY_MAP_TOOL,
    title: "Meu mapa de conversão",
    description: `Monte o mapa Origem → Página → Ação → Resultado da oferta que você escolheu.

Registre também, se souber, o principal ponto que hoje pode estar dificultando esse caminho.`,
  }),
  block(27, "conclusao-caminho", true, false, {
    type: "CONCLUSION",
    body: `Antes de mudar layout, cor ou tecnologia, você precisa entender o caminho que a página deve sustentar.

Você já tem um primeiro mapa: de onde as pessoas chegam, o que encontram, o que deveriam fazer e o que isso representa para o negócio.

Na próxima aula — “Site, landing page ou WhatsApp: o que seu negócio precisa?” — vamos descobrir qual estrutura faz mais sentido para esse caminho.`,
  }),
  block(28, "proxima-aula-estrutura", true, false, {
    type: "TEXT",
    body: `Próximo passo: Aula 2 — Site, landing page ou WhatsApp: o que seu negócio precisa?

Agora que você sabe qual caminho quer criar, o próximo passo é descobrir qual estrutura faz mais sentido para ele.`,
  }),
];
