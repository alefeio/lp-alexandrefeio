import type { LessonBlockData } from "@/lib/learning/blocks";

export const FIRST_COURSE_SLUG = "trafego-pago-na-pratica";
export const DEMO_LESSON_SLUG = "como-funciona-o-trafego-pago";

export type SeedBlock = {
  blockKey: string;
  position: number;
  countsForProgress: boolean;
  required: boolean;
  data: LessonBlockData;
};

export type SeedLesson = {
  slug: string;
  title: string;
  summary: string;
  publicPreview: string;
  estimatedMinutes: number;
  sortOrder: number;
  accessType: "FREE" | "PAID";
  priceCents: number | null;
  blocks: SeedBlock[];
};

export type SeedModule = {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  bundlePriceCents: number | null;
  lessons: SeedLesson[];
};

export const firstCourseSeed = {
  slug: FIRST_COURSE_SLUG,
  title: "Tráfego Pago na Prática para Pequenos Negócios",
  subtitle: "Uma trilha em texto para decidir, anunciar e ler o que aconteceu.",
  description:
    "O curso organiza o caminho de um pequeno negócio que vai anunciar: antes de investir, no Google, no Meta e na leitura do resultado. As aulas são independentes. A ordem é só uma sugestão.",
  bundlePriceCents: 24990,
  modules: [
    {
      slug: "antes-de-investir",
      title: "Antes de investir",
      description: "Entender o mecanismo, escolher o canal e ver se o negócio já tem o que anunciar.",
      sortOrder: 0,
      bundlePriceCents: null,
      lessons: [
        {
          slug: DEMO_LESSON_SLUG,
          title: "Como funciona o tráfego pago e quando ele faz sentido",
          summary: "O anúncio só vale quando existe oferta, destino e uma forma de reconhecer o contato.",
          publicPreview: "Uma leitura curta sobre o caminho do anúncio até o contato.",
          estimatedMinutes: 12,
          sortOrder: 0,
          accessType: "FREE" as const,
          priceCents: null,
          blocks: demoBlocks(),
        },
        {
          slug: "google-ads-ou-meta-ads",
          title: "Google Ads ou Meta Ads: qual escolher?",
          summary: "A escolha depende de quem já procura o serviço e de quem ainda precisa ser alcançado.",
          publicPreview: "O texto completo desta aula ainda está em preparação.",
          estimatedMinutes: 10,
          sortOrder: 1,
          accessType: "FREE" as const,
          priceCents: null,
          blocks: [],
        },
        {
          slug: "negocio-pronto-para-anunciar",
          title: "Seu negócio está pronto para anunciar?",
          summary: "Oferta, destino e mensuração precisam existir antes da primeira campanha.",
          publicPreview: "O texto completo desta aula ainda está em preparação.",
          estimatedMinutes: 10,
          sortOrder: 2,
          accessType: "FREE" as const,
          priceCents: null,
          blocks: [],
        },
      ],
    },
    {
      slug: "planeje-antes-de-anunciar",
      title: "Planeje antes de anunciar",
      description: "Objetivo, oferta, orçamento, destino e mensuração.",
      sortOrder: 1,
      bundlePriceCents: 5790,
      lessons: [
        paid("objetivo-oferta-orcamento", "Defina objetivo, oferta e orçamento", "O que a campanha precisa produzir e quanto cabe investir.", 2990, 0),
        paid("destino-e-mensuracao", "Prepare o destino e a mensuração", "A página ou o WhatsApp que recebe o clique, e como o contato será contado.", 3490, 1),
      ],
    },
    {
      slug: "google-ads-na-pratica",
      title: "Google Ads na prática",
      description: "Pesquisa, palavras-chave e anúncio alinhado ao contato.",
      sortOrder: 2,
      bundlePriceCents: 10390,
      lessons: [
        paid("campanha-de-pesquisa", "Estruture uma campanha de Pesquisa", "Campanha, grupo e anúncio com um objetivo só.", 3990, 0),
        paid("palavras-chave-com-intencao", "Escolha palavras-chave com intenção de compra", "Separar quem pesquisa para comprar de quem pesquisa para entender.", 3990, 1),
        paid("anuncios-alinhados-a-conversao", "Crie anúncios alinhados à conversão", "O texto do anúncio precisa combinar com a página que recebe a visita.", 3490, 2),
      ],
    },
    {
      slug: "meta-ads-na-pratica",
      title: "Meta Ads na prática",
      description: "Objetivo, público e campanhas para lead ou WhatsApp.",
      sortOrder: 3,
      bundlePriceCents: 7190,
      lessons: [
        paid("objetivo-publico-estrutura", "Escolha objetivo, público e estrutura", "O que a campanha pede para a plataforma otimizar.", 3990, 0),
        paid("campanhas-leads-whatsapp", "Crie campanhas para leads e WhatsApp", "Quando o destino é um formulário e quando é uma conversa.", 3990, 1),
      ],
    },
    {
      slug: "entenda-e-melhore",
      title: "Entenda e melhore os resultados",
      description: "Ler o número certo e decidir o que mudar.",
      sortOrder: 4,
      bundlePriceCents: 6790,
      lessons: [
        paid("leia-os-numeros", "Leia os números e encontre o gargalo", "Clique, visita e contato não respondem à mesma pergunta.", 3490, 0),
        paid("o-que-mudar", "Saiba o que mudar — e quando não mexer", "Ajustar o que trava o contato, sem desfazer o que já funciona.", 3990, 1),
      ],
    },
  ] satisfies SeedModule[],
};

function paid(slug: string, title: string, summary: string, priceCents: number, sortOrder: number): SeedLesson {
  return {
    slug,
    title,
    summary,
    publicPreview: "O conteúdo desta aula será aberto quando a compra estiver disponível. Ainda não há checkout.",
    estimatedMinutes: 15,
    sortOrder,
    accessType: "PAID",
    priceCents,
    blocks: [],
  };
}

function demoBlocks(): SeedBlock[] {
  return [
    {
      blockKey: "heading-anuncio-vira-contato",
      position: 0,
      countsForProgress: false,
      required: false,
      data: { type: "HEADING", level: 2, text: "Como o anúncio vira contato" },
    },
    {
      blockKey: "text-caminho",
      position: 1,
      countsForProgress: true,
      required: false,
      data: {
        type: "TEXT",
        body: "Tráfego pago é uma forma de colocar um anúncio na frente de alguém que pode precisar do que você vende. A plataforma cobra pela exibição ou pelo clique. Isso, sozinho, não cria um cliente.\n\nO caminho útil é curto: a pessoa vê o anúncio, entende a oferta, chega a um destino e deixa um contato que você consegue reconhecer. Se um desses pontos falta, o investimento vira visita sem conversa.",
      },
    },
    {
      blockKey: "callout-clique",
      position: 2,
      countsForProgress: true,
      required: false,
      data: {
        type: "CALLOUT",
        tone: "warning",
        title: "Clique não é contato",
        body: "Um anúncio pode gerar muitas visitas e nenhum pedido de orçamento. O número que importa nesta fase é o contato que você consegue atribuir à campanha.",
      },
    },
    {
      blockKey: "example-padaria",
      position: 3,
      countsForProgress: true,
      required: false,
      data: {
        type: "EXAMPLE",
        title: "Uma padaria de bairro",
        body: "A padaria quer encomendas de bolo no fim de semana. O anúncio fala do bolo, o destino é uma conversa no WhatsApp com o cardápio, e a dona anota quantas conversas começaram pelo anúncio. Sem cardápio e sem alguém para responder, o anúncio não tem para onde levar a pessoa.",
      },
    },
    {
      blockKey: "heading-antes-de-investir",
      position: 4,
      countsForProgress: false,
      required: false,
      data: { type: "HEADING", level: 2, text: "Antes de investir" },
    },
    {
      blockKey: "checkpoint-quando-anunciar",
      position: 5,
      countsForProgress: true,
      required: true,
      data: {
        type: "CHECKPOINT",
        question: "Quando o tráfego pago faz mais sentido para um pequeno negócio?",
        options: [
          { id: "oferta-e-destino", label: "Quando já existem oferta, destino do clique e um jeito de reconhecer o contato." },
          { id: "sem-oferta", label: "Quando ainda não há o que vender, mas a página já pode receber visitas." },
          { id: "so-curtida", label: "Quando o objetivo é só aumentar curtidas, sem precisar de contato." },
        ],
        correctOptionId: "oferta-e-destino",
        explanation: "Anunciar faz sentido quando a pessoa encontra uma oferta clara e você consegue saber que o contato veio dali.",
      },
    },
    {
      blockKey: "activity-oferta",
      position: 6,
      countsForProgress: true,
      required: true,
      data: {
        type: "ACTIVITY",
        inputType: "short_text",
        prompt: "Escreva, em uma frase, a oferta que você anunciaria agora.",
        placeholder: "Ex.: encomenda de bolo para o fim de semana, com retirada na loja.",
      },
    },
    {
      blockKey: "checklist-pronto",
      position: 7,
      countsForProgress: true,
      required: true,
      data: {
        type: "CHECKLIST",
        items: [
          { id: "oferta", label: "A oferta cabe em uma frase." },
          { id: "destino", label: "Existe uma página ou um WhatsApp para receber o clique." },
          { id: "contato", label: "Dá para saber quando um contato chegou por causa do anúncio." },
        ],
      },
    },
    {
      blockKey: "result-leitura",
      position: 8,
      countsForProgress: true,
      required: false,
      data: {
        type: "RESULT",
        title: "Leitura inicial",
        prompt: "Registre o que você já tem. Isto fica salvo como o resultado desta aula, separado das respostas de cada bloco.",
        fields: [
          { key: "oferta-clara", label: "Oferta clara (sim ou não)" },
          { key: "destino-pronto", label: "Destino pronto (sim ou não)" },
          { key: "contato-medido", label: "Contato medido (sim ou não)" },
        ],
      },
    },
    {
      blockKey: "conclusion-seguir",
      position: 9,
      countsForProgress: true,
      required: false,
      data: {
        type: "CONCLUSION",
        body: "Se a oferta, o destino e a leitura do contato existem, o próximo passo sugerido é escolher o canal. Essa próxima aula não está travada: a ordem do curso é uma recomendação, não uma trava.",
      },
    },
  ];
}
