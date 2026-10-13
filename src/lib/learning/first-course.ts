import type { LessonBlockData } from "@/lib/learning/blocks";
import { LESSON_01_SLUG, lesson01Blocks, lesson01Meta } from "@/lib/learning/lesson-01";
import { LESSON_02_SLUG, lesson02Blocks, lesson02Meta } from "@/lib/learning/lesson-02";
import { LESSON_03_SLUG, lesson03Blocks, lesson03Meta } from "@/lib/learning/lesson-03";
import { LESSON_04_SLUG, lesson04Blocks, lesson04Meta } from "@/lib/learning/lesson-04";

export const FIRST_COURSE_SLUG = "trafego-pago-na-pratica";
export const DEMO_LESSON_SLUG = LESSON_01_SLUG;

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
          title: lesson01Meta.title,
          summary: lesson01Meta.summary,
          publicPreview: lesson01Meta.publicPreview,
          estimatedMinutes: lesson01Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: "FREE" as const,
          priceCents: null,
          blocks: lesson01Blocks,
        },
        {
          slug: LESSON_02_SLUG,
          title: lesson02Meta.title,
          summary: lesson02Meta.summary,
          publicPreview: lesson02Meta.publicPreview,
          estimatedMinutes: lesson02Meta.estimatedMinutes,
          sortOrder: 1,
          accessType: lesson02Meta.accessType,
          priceCents: lesson02Meta.priceCents,
          blocks: lesson02Blocks,
        },
        {
          slug: LESSON_03_SLUG,
          title: lesson03Meta.title,
          summary: lesson03Meta.summary,
          publicPreview: lesson03Meta.publicPreview,
          estimatedMinutes: lesson03Meta.estimatedMinutes,
          sortOrder: 2,
          accessType: lesson03Meta.accessType,
          priceCents: lesson03Meta.priceCents,
          blocks: lesson03Blocks,
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
        {
          slug: LESSON_04_SLUG,
          title: lesson04Meta.title,
          summary: lesson04Meta.summary,
          publicPreview: lesson04Meta.publicPreview,
          estimatedMinutes: lesson04Meta.estimatedMinutes,
          sortOrder: 0,
          accessType: lesson04Meta.accessType,
          priceCents: lesson04Meta.priceCents,
          blocks: lesson04Blocks,
        },
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
