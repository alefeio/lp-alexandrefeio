import type { LessonBlockData } from "@/lib/learning/blocks";
import { DIGITAL_PRESENCE_DECISION_TOOL, SITE_LANDING_WHATSAPP_SLUG } from "@/lib/learning/digital-presence-decision";

export const SITE_LESSON_02_SLUG = SITE_LANDING_WHATSAPP_SLUG;

export const siteLesson02Meta = {
  title: "Site, landing page ou WhatsApp: o que seu negócio precisa?",
  summary: "Escolha a estrutura digital adequada ao tipo de oferta e ao próximo passo do cliente.",
  publicPreview:
    "A resposta não é “todo mundo precisa de site”. Nesta aula você decide se faz mais sentido landing page, site institucional, página de serviço, WhatsApp ou uma combinação — com base na jornada do seu negócio.",
  estimatedMinutes: 25,
  accessType: "FREE" as const,
  priceCents: null,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export type SiteLesson02Block = {
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
): SiteLesson02Block {
  return { position, blockKey, countsForProgress, required, data };
}

const heading = (position: number, blockKey: string, text: string) =>
  block(position, blockKey, false, false, { type: "HEADING", level: 2, text });

export const siteLesson02Blocks: SiteLesson02Block[] = [
  heading(1, "preciso-de-site-inteiro", "Preciso criar um site inteiro?"),
  block(2, "abertura-duvida-comum", true, false, {
    type: "TEXT",
    body: `Uma dúvida comum:

Preciso criar um site inteiro?
Uma landing page?
Ou posso mandar as pessoas direto para o WhatsApp?

A resposta depende da jornada que queremos construir — aquele caminho Origem → Página → Ação → Resultado da aula anterior.

Não existe resposta universal. A estrutura certa é a que melhor ajuda o visitante a entender, confiar e avançar.`,
  }),
  block(3, "callout-nao-existe-universal", true, false, {
    type: "CALLOUT",
    tone: "info",
    title: "Não escolha pela moda",
    body: `Não precisa escolher uma ferramenta porque está na moda.

Precisa escolher a estrutura que melhor sustenta o caminho do visitante até a ação que importa para o negócio.`,
  }),
  heading(4, "ferramenta-nao-e-estrategia", "Ferramenta ≠ estratégia"),
  block(5, "tecnologias-nao-decidem", true, false, {
    type: "TEXT",
    body: `WordPress, Wix, Next.js, Webflow e outras plataformas são tecnologias.

Elas importam depois.

A decisão desta aula é anterior: qual estrutura precisamos?

Landing page, site institucional, página de serviço, jornada com WhatsApp no centro ou uma combinação.

Comparar plataformas fica para outro momento.`,
  }),
  heading(6, "o-que-e-landing-page", "Landing page"),
  block(7, "landing-definicao", true, false, {
    type: "TEXT",
    body: `Uma landing page é uma página criada para conduzir o visitante em torno de:

uma oferta
+
uma ação principal.

Pode ser adequada quando:

- existe uma oferta específica;
- a campanha leva para essa oferta;
- a mensagem precisa ser focada;
- queremos reduzir distrações.

Isso não significa que ela “precisa ser curta” nem que “só serve para anúncio”. O ponto é foco: uma oferta, um caminho claro.`,
  }),
  heading(8, "o-que-e-site-institucional", "Site institucional"),
  block(9, "institucional-definicao", true, false, {
    type: "TEXT",
    body: `Um site institucional é uma estrutura com várias páginas que ajuda a apresentar:

- empresa;
- serviços;
- diferenciais;
- informações;
- confiança;
- contato;
- conteúdos.

Pode fazer sentido quando:

- o negócio possui várias ofertas;
- o visitante precisa explorar;
- a confiança institucional é importante;
- existem várias necessidades de informação;
- presença orgânica e conteúdo fazem parte da estratégia.

Ter um site não promete, por si só, ranqueamento ou vendas. Ele oferece espaço para organizar informação e confiança.`,
  }),
  heading(10, "pagina-de-servico", "Página de serviço"),
  block(11, "exemplo-clinica-servico", true, false, {
    type: "EXAMPLE",
    title: "Clínica com páginas por exame",
    body: `Dentro de um site, cada serviço importante pode ter uma página própria.

Exemplo:

Home
→ Ultrassonografia
→ Exames específicos
→ Contato / agendamento

Isso permite mensagem mais específica e ação mais contextual — sem abandonar a estrutura maior do site.`,
  }),
  heading(12, "whatsapp-first", "WhatsApp como estrutura principal"),
  block(13, "whatsapp-definicao", true, false, {
    type: "TEXT",
    body: `WhatsApp first é uma jornada em que a conversa é o principal ponto de avanço.

Pode funcionar quando:

- a oferta é simples;
- o atendimento humano faz parte da venda;
- pouca explicação é necessária antes da conversa;
- a pessoa já chega com intenção e contexto suficientes.

Em alguns negócios, isso é suficiente — especialmente no começo.`,
  }),
  block(14, "callout-limite-whatsapp", true, false, {
    type: "CALLOUT",
    tone: "warning",
    title: "Quando a conversa carrega o trabalho da página",
    body: `Mandar todo mundo direto ao WhatsApp pode aumentar outro tipo de fricção.

Exemplos de mensagens:

“Oi, quanto custa?”
“Vocês fazem o quê?”
“Me passa informações.”

Isso pode indicar que a conversa está fazendo o trabalho que uma página poderia preparar antes.

Não diagnostique automaticamente — observe o padrão.`,
  }),
  heading(15, "combinacao-mixed", "Combinações (mixed)"),
  block(16, "mixed-e-nao-guerra", true, false, {
    type: "TEXT",
    body: `A estrutura pode combinar site, landing pages e WhatsApp. Não é obrigatório escolher só uma.

Exemplos:

Google Ads → página de serviço → WhatsApp → orçamento

Instagram → site → página específica → agendamento

Landing page e site institucional não são concorrentes obrigatórios. Um site pode ter landing pages. Uma landing page pode fazer parte de uma estrutura maior.`,
  }),
  block(17, "checkpoint-lp-site-concorrentes", true, true, {
    type: "CHECKPOINT",
    question: "Landing page e site institucional são necessariamente concorrentes?",
    options: [
      { id: "sim", label: "Sim — precisa escolher um e abandonar o outro" },
      { id: "nao", label: "Não — podem coexistir e se complementar" },
    ],
    correctOptionId: "nao",
    explanation: "Um site pode ter landing pages; uma landing page pode fazer parte de uma estrutura maior. Não há guerra obrigatória entre os dois.",
  }),
  block(18, "checkpoint-whatsapp-principal", true, true, {
    type: "CHECKPOINT",
    question: "WhatsApp pode ser a estrutura principal em alguns negócios?",
    options: [
      { id: "nao", label: "Não — todo negócio precisa de site completo" },
      { id: "sim", label: "Sim — quando a oferta é simples e a conversa sustenta o avanço" },
    ],
    correctOptionId: "sim",
    explanation: "Em ofertas simples, com atendimento humano e pouco contexto prévio necessário, WhatsApp pode ser o centro da jornada.",
  }),
  heading(19, "cinco-perguntas", "Cinco perguntas para decidir"),
  block(20, "perguntas-decisao", true, false, {
    type: "TEXT",
    body: `Antes de escolher a estrutura, pense:

1. Quantas ofertas precisam ser apresentadas?
2. Quanto a pessoa precisa entender antes de agir?
3. Quanto de confiança precisa ser construído?
4. De onde o visitante chega?
5. Qual ação queremos que aconteça?

Uma oferta específica pode favorecer estrutura focada. Vários serviços podem pedir arquitetura mais ampla — sem transformar quantidade em regra automática.

Quanto maior a necessidade de contexto (como funciona, para quem serve, processo, diferenças, riscos, benefícios), menos razoável pode ser mandar imediatamente para uma conversa sem preparação.

Algumas decisões exigem mais confiança: serviços de maior valor, profissionais, decisões complexas, empresas pouco conhecidas. A estrutura pode precisar ajudar a responder: quem é? o que faz? como funciona? por que confiar?

A origem importa (Google, Instagram, indicação), mas sem regra rígida. E a ação principal — WhatsApp, formulário, agendamento, compra, cadastro — deve ser facilitada pela estrutura.`,
  }),
  block(21, "exemplo-moveis-planejados", true, false, {
    type: "EXAMPLE",
    title: "Móveis planejados",
    body: `Situação: várias soluções, ticket relevante, cliente precisa ver projetos, processo de orçamento, confiança.

Possível decisão: site institucional + páginas de serviço + WhatsApp.

Resultado conceitual: combinação (mixed).

Não é a única solução válida — é uma estrutura que tende a fazer sentido nesse cenário.`,
  }),
  block(22, "exemplo-oferta-especifica", true, false, {
    type: "EXAMPLE",
    title: "Campanha de oferta específica",
    body: `Campanha para uma oferta específica.
Pouca necessidade de navegar por outras áreas.

Possível: landing page → formulário ou WhatsApp.

A mensagem fica concentrada no próximo passo.`,
  }),
  block(23, "exemplo-autonomo-e-varios", true, false, {
    type: "EXAMPLE",
    title: "Autônomo × empresa com vários serviços",
    body: `Profissional autônomo: oferta simples, cliente chega por indicação, contato humano resolve grande parte da decisão.

Possível: WhatsApp first — ou página simples + WhatsApp. A maturidade do negócio importa.

Empresa com vários serviços: visitantes com necessidades diferentes.

Possível: site institucional + páginas de serviço.`,
  }),
  block(24, "checkpoint-uma-oferta-sempre-lp", true, true, {
    type: "CHECKPOINT",
    question: "Uma única oferta sempre exige landing page?",
    options: [
      { id: "sim", label: "Sim — uma oferta = landing page obrigatória" },
      { id: "nao", label: "Não — depende de contexto, confiança e ação desejada" },
    ],
    correctOptionId: "nao",
    explanation: "Uma oferta pode favorecer estrutura focada, mas confiança, origem e ação também pesam. Não há regra automática.",
  }),
  block(25, "checkpoint-mais-info-estrutura", true, true, {
    type: "CHECKPOINT",
    question: "Quanto mais informação um visitante precisa antes de agir, mais importante fica a estrutura que prepara essa decisão?",
    options: [
      { id: "nao", label: "Não — basta mandar para o WhatsApp" },
      { id: "sim", label: "Sim — mais contexto pede estrutura que prepare a decisão" },
    ],
    correctOptionId: "sim",
    explanation: "Quando a pessoa precisa entender processo, diferenças ou riscos, a página (ou combinação) tende a preparar melhor o avanço do que a conversa isolada.",
  }),
  block(26, "atividade-revisar-mapa", true, true, {
    type: "ACTIVITY",
    inputType: "long_text",
    prompt: `Revise o mapa da Aula 1 (se tiver) e responda:

1. Quantas ofertas precisa apresentar?
2. O visitante precisa entender muito antes de agir?
3. Precisa construir confiança?
4. De onde ele chega?
5. Qual ação queremos?
6. Existe estrutura atual?

Se ainda não fez a Aula 1, responda com o que souber hoje. Depois você pode mapear a jornada com mais precisão.`,
    placeholder: "Anote ofertas, necessidade de explicação, confiança, origem, ação e estrutura atual.",
  }),
  block(27, "tool-estrutura-digital", true, true, {
    type: "TOOL",
    toolKey: DIGITAL_PRESENCE_DECISION_TOOL,
    title: "Minha estrutura digital ideal",
    description: `Com base na oferta, nas necessidades de explicação e confiança, na origem e na ação desejada, esta ferramenta recomenda a estrutura principal e possíveis complementos.

Se você já tem o mapa da Aula 1 no mesmo projeto, parte dos dados entra preenchida.`,
  }),
  block(28, "conclusao-estrutura", true, false, {
    type: "CONCLUSION",
    body: `Agora você sabe qual estrutura precisa sustentar a jornada — mas ainda não sabemos se ela está pronta para converter.

Na próxima aula — “Sua página está pronta para converter?” — vamos avaliar os fundamentos da página e descobrir onde estão os principais pontos de atenção.`,
  }),
  block(29, "proxima-aula-prontidao", true, false, {
    type: "TEXT",
    body: `Próximo passo: Aula 3 — Sua página está pronta para converter?

Com a estrutura em mente, o próximo passo é diagnosticar se a página atual (ou a que você vai construir) está preparada para conduzir o visitante até a ação.`,
  }),
];
