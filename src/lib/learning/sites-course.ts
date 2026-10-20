/**
 * Scaffold editorial do segundo curso.
 * Sem blocos, Tools ou LessonResults. Status DRAFT / NOT_FOR_SALE até publicação futura.
 */

export const SITES_COURSE_SLUG = "sites-que-convertem";

export type SitesSeedLesson = {
  slug: string;
  title: string;
  summary: string;
  publicPreview: string | null;
  estimatedMinutes: number;
  sortOrder: number;
  accessType: "FREE" | "PAID";
  priceCents: number | null;
  plannedResult: string;
  plannedTool: string;
};

export type SitesSeedModule = {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  bundlePriceCents: number | null;
  lessons: SitesSeedLesson[];
};

export const sitesCourseEditorial = {
  contentStatus: "SCAFFOLDED" as const,
  publicRelease: "NOT_APPROVED" as const,
  commerceRelease: "NOT_APPROVED" as const,
  publicationStatus: "DRAFT" as const,
  commerceStatus: "NOT_FOR_SALE" as const,
};

export const sitesCourseSeed = {
  slug: SITES_COURSE_SLUG,
  title: "Sites que Convertem para Pequenos Negócios",
  subtitle: "Aprenda a planejar páginas mais claras, confiáveis e orientadas à conversão — aplicando cada etapa no seu próprio negócio.",
  description:
    "Curso de estratégia de página, jornada, oferta, conversão, copy, estrutura, experiência, confiança e mensuração para pequenos negócios. Não ensina programação nem CMS.",
  sortOrder: 1,
  bundlePriceCents: 24990,
  status: "DRAFT" as const,
  commerceStatus: "NOT_FOR_SALE" as const,
  modules: [
    {
      slug: "antes-de-construir",
      title: "Antes de construir",
      description: "Entender a função da página, escolher a estrutura digital adequada e diagnosticar o ponto de partida.",
      sortOrder: 0,
      bundlePriceCents: null,
      lessons: [
        {
          slug: "site-ajuda-a-vender",
          title: "Seu site realmente ajuda a vender?",
          summary: "Entenda se a presença digital atual conduz o visitante até uma ação real do negócio.",
          publicPreview:
            "Um site não precisa existir só para parecer profissional. Nesta aula você constrói o mapa Origem → Página → Ação → Resultado aplicado ao seu próprio negócio.",
          estimatedMinutes: 25,
          sortOrder: 0,
          accessType: "FREE" as const,
          priceCents: null,
          plannedResult: "Meu mapa de conversão",
          plannedTool: "CONVERSION_JOURNEY_MAP_V1",
        },
        {
          slug: "site-landing-page-ou-whatsapp",
          title: "Site, landing page ou WhatsApp: o que seu negócio precisa?",
          summary: "Escolha a estrutura digital adequada ao tipo de oferta e ao próximo passo do cliente.",
          publicPreview:
            "A resposta não é “todo mundo precisa de site”. Nesta aula você decide se faz mais sentido landing page, site institucional, página de serviço, WhatsApp ou uma combinação — com base na jornada do seu negócio.",
          estimatedMinutes: 25,
          sortOrder: 1,
          accessType: "FREE" as const,
          priceCents: null,
          plannedResult: "Minha estrutura digital ideal",
          plannedTool: "DIGITAL_PRESENCE_DECISION_V1",
        },
        {
          slug: "pagina-pronta-para-converter",
          title: "Sua página está pronta para converter?",
          summary: "Diagnostique o ponto de partida da página antes de planejar mudanças.",
          publicPreview:
            "Você já sabe a jornada e a estrutura. Nesta aula você avalia clareza, oferta, ação, confiança e outros fundamentos — para priorizar o que importa antes de investir em design ou tráfego.",
          estimatedMinutes: 25,
          sortOrder: 2,
          accessType: "FREE" as const,
          priceCents: null,
          plannedResult: "Diagnóstico de prontidão da página",
          plannedTool: "CONVERSION_PAGE_READINESS_V1",
        },
      ],
    },
    {
      slug: "planeje-antes-de-desenhar",
      title: "Planeje antes de desenhar",
      description: "Defina oferta, público, ação principal e a jornada do visitante antes de desenhar a página.",
      sortOrder: 1,
      bundlePriceCents: 6290,
      lessons: [
        {
          slug: "oferta-publico-acao-principal",
          title: "Defina oferta, público e ação principal",
          summary: "Transforme a intenção de conversão em um brief claro da página.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Brief da página",
          plannedTool: "CONVERSION_PAGE_BRIEF_V1",
        },
        {
          slug: "jornada-do-visitante",
          title: "Planeje a jornada do visitante",
          summary: "Organize o caminho do visitante até a ação principal do negócio.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Minha jornada de conversão",
          plannedTool: "VISITOR_JOURNEY_PLAN_V1",
        },
      ],
    },
    {
      slug: "estruture-e-comunique",
      title: "Estruture e comunique",
      description: "Organize as seções da página e escreva uma mensagem que deixa a oferta clara.",
      sortOrder: 2,
      bundlePriceCents: 7190,
      lessons: [
        {
          slug: "organize-as-secoes-da-pagina",
          title: "Organize as seções da página",
          summary: "Defina a estrutura das seções para conduzir atenção e ação.",
          publicPreview: null,
          estimatedMinutes: 35,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Estrutura da minha página",
          plannedTool: "CONVERSION_PAGE_STRUCTURE_V1",
        },
        {
          slug: "mensagem-que-deixa-a-oferta-clara",
          title: "Escreva uma mensagem que deixa sua oferta clara",
          summary: "Planeje a copy da página para deixar oferta e próximo passo evidentes.",
          publicPreview: null,
          estimatedMinutes: 35,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Plano de copy da página",
          plannedTool: "CONVERSION_COPY_PLAN_V1",
        },
      ],
    },
    {
      slug: "atencao-e-confianca",
      title: "Atenção e confiança",
      description: "Use hierarquia visual e prova para conduzir atenção e construir confiança.",
      sortOrder: 3,
      bundlePriceCents: 6290,
      lessons: [
        {
          slug: "hierarquia-visual-e-atencao",
          title: "Use hierarquia visual para conduzir a atenção",
          summary: "Defina a direção visual que ajuda o visitante a encontrar o que importa.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Direção visual da página",
          plannedTool: "PAGE_VISUAL_DIRECTION_V1",
        },
        {
          slug: "construa-confianca",
          title: "Construa confiança antes de pedir a ação",
          summary: "Planeje prova e sinais de confiança antes do pedido de conversão.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Plano de confiança e prova",
          plannedTool: "TRUST_PROOF_PLAN_V1",
        },
      ],
    },
    {
      slug: "publique-mea-e-melhore",
      title: "Publique, meça e melhore",
      description: "Prepare a experiência, configure a mensuração e revise antes de trazer tráfego.",
      sortOrder: 4,
      bundlePriceCents: 10390,
      lessons: [
        {
          slug: "pagina-mobile-e-experiencia",
          title: "Prepare sua página para o celular e uma boa experiência",
          summary: "Checklist de experiência e usabilidade da página, com foco em mobile.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Checklist de experiência da página",
          plannedTool: "PAGE_EXPERIENCE_CHECKLIST_V1",
        },
        {
          slug: "mensuracao-da-pagina",
          title: "Configure o que precisa ser medido",
          summary: "Defina o que precisa ser medido para saber se a página converte.",
          publicPreview: null,
          estimatedMinutes: 35,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Plano de mensuração da página",
          plannedTool: "PAGE_MEASUREMENT_PLAN_V1",
        },
        {
          slug: "revisao-antes-do-trafego",
          title: "Revise sua página antes de trazer tráfego",
          summary: "Feche o diagnóstico final da página antes de investir em tráfego.",
          publicPreview: null,
          estimatedMinutes: 35,
          sortOrder: 2,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Diagnóstico final da página",
          plannedTool: "CONVERSION_PAGE_FINAL_REVIEW_V1",
        },
      ],
    },
  ] as SitesSeedModule[],
};

export function sitesCourseLessons(seed = sitesCourseSeed): SitesSeedLesson[] {
  return seed.modules.flatMap((moduleRow) => moduleRow.lessons);
}

export function sitesCoursePaidLessonsTotalCents(seed = sitesCourseSeed): number {
  return sitesCourseLessons(seed)
    .filter((lesson) => lesson.accessType === "PAID")
    .reduce((sum, lesson) => sum + (lesson.priceCents ?? 0), 0);
}

export function sitesCoursePaidModulesTotalCents(seed = sitesCourseSeed): number {
  return seed.modules.reduce((sum, moduleRow) => sum + (moduleRow.bundlePriceCents ?? 0), 0);
}

export function sitesCoursePlannedTools(seed = sitesCourseSeed): string[] {
  return sitesCourseLessons(seed).map((lesson) => lesson.plannedTool);
}

/** Catálogo/sitemap/indexação públicos só aceitam PUBLISHED. Scaffold permanece DRAFT. */
export function sitesCourseIsPubliclyVisible(status: "DRAFT" | "PUBLISHED" = sitesCourseSeed.status): boolean {
  return status === "PUBLISHED";
}
