/**
 * Scaffold editorial do segundo curso.
 * Release público SUSPENSO até o reframe Landing Page Builder: Course DRAFT + NOT_FOR_SALE.
 * Aulas 1–3 completas internamente; 4–12 planejadas para construir LandingPageProject até publicação.
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
  contentStatus: "REFRAMED_LANDING_PAGE_BUILDER" as const,
  publicRelease: "SUSPENDED" as const,
  commerceRelease: "NOT_APPROVED" as const,
  publicationStatus: "DRAFT" as const,
  commerceStatus: "NOT_FOR_SALE" as const,
  /** Promessa pública planejada (não ativa enquanto DRAFT). */
  promise: "Planeje, construa e publique sua própria landing page enquanto aprende.",
  freeBoundary: "DISCOVER" as const,
  paidBoundary: "BUILD_AND_PUBLISH" as const,
};

export const sitesCourseSeed = {
  slug: SITES_COURSE_SLUG,
  title: "Sites que Convertem para Pequenos Negócios",
  subtitle: "Planeje, construa e publique sua própria landing page enquanto aprende.",
  description:
    "Formação prática para diagnosticar a presença digital, construir uma landing page real na plataforma e publicá-la — com estratégia, copy, confiança, experiência e mensuração. Não ensina programação nem CMS.",
  sortOrder: 1,
  bundlePriceCents: 24990,
  status: "DRAFT" as const,
  commerceStatus: "NOT_FOR_SALE" as const,
  modules: [
    {
      slug: "antes-de-construir",
      title: "Antes de construir",
      description: "Descobrir o caminho, a estrutura digital adequada e os gargalos antes de construir a landing page.",
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
      description: "Alimentar o LandingPageProject com brief de conversão e mapa de decisão do visitante.",
      sortOrder: 1,
      bundlePriceCents: 6290,
      lessons: [
        {
          slug: "oferta-publico-acao-principal",
          title: "Defina oferta, público e ação principal",
          summary: "Transforme a intenção de conversão em um brief que alimenta a landing page.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Brief de conversão da minha landing page",
          plannedTool: "CONVERSION_PAGE_BRIEF_V1",
        },
        {
          slug: "jornada-do-visitante",
          title: "Planeje a jornada do visitante",
          summary: "Registre o que o visitante sabe, precisa entender, duvidar e decidir até a ação final.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Mapa de decisão do visitante",
          plannedTool: "VISITOR_DECISION_JOURNEY_V1",
        },
      ],
    },
    {
      slug: "estruture-e-comunique",
      title: "Estruture e comunique",
      description: "Construir o wireframe real e aplicar a copy aprovada na landing page.",
      sortOrder: 2,
      bundlePriceCents: 7190,
      lessons: [
        {
          slug: "organize-as-secoes-da-pagina",
          title: "Monte a estrutura da sua landing page",
          summary: "Transforme a estratégia e a jornada em uma estrutura real de seções, ainda sem a copy final.",
          publicPreview:
            "A estrutura da página nasce das decisões que você já registrou. Nesta aula você vê, ajusta e visualiza o esqueleto da sua landing page.",
          estimatedMinutes: 35,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Estrutura da minha landing page",
          plannedTool: "LANDING_PAGE_WIREFRAME_V1",
        },
        {
          slug: "mensagem-que-deixa-a-oferta-clara",
          title: "Escreva uma mensagem que deixa sua oferta clara",
          summary: "Escreva e aprove a copy real das seções — com assistência de IA e revisão humana.",
          publicPreview:
            "Uma estrutura correta ainda pode falhar se a oferta não ficar clara. Nesta aula você escreve, compara e aprova o texto de cada seção.",
          estimatedMinutes: 35,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Copy da minha landing page",
          plannedTool: "LANDING_PAGE_COPY_ASSIST_V1",
        },
      ],
    },
    {
      slug: "atencao-e-confianca",
      title: "Atenção e confiança",
      description: "Personalizar o tema visual controlado e inserir elementos reais de confiança.",
      sortOrder: 3,
      bundlePriceCents: 6290,
      lessons: [
        {
          slug: "hierarquia-visual-e-atencao",
          title: "Use hierarquia visual para conduzir a atenção",
          summary: "Defina o que o visitante percebe primeiro, com cores, contraste e destaque controlados.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Direção visual da minha landing page",
          plannedTool: "LANDING_PAGE_VISUAL_DIRECTION_V1",
        },
        {
          slug: "construa-confianca",
          title: "Construa confiança antes de pedir a ação",
          summary: "Adicione prova e confiança reais informadas por você — sem inventar depoimentos ou números.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Plano de confiança da minha landing page",
          plannedTool: "LANDING_PAGE_TRUST_V1",
        },
      ],
    },
    {
      slug: "publique-mea-e-melhore",
      title: "Publique, meça e melhore",
      description: "Revisar experiência responsiva, configurar mensuração e publicar a landing page real.",
      sortOrder: 4,
      bundlePriceCents: 10390,
      lessons: [
        {
          slug: "pagina-mobile-e-experiencia",
          title: "Prepare sua página para o celular e uma boa experiência",
          summary: "Revise se a pessoa consegue entender, ler e agir na landing page em larguras diferentes.",
          publicPreview: null,
          estimatedMinutes: 30,
          sortOrder: 0,
          accessType: "PAID" as const,
          priceCents: 3490,
          plannedResult: "Revisão de experiência da minha landing page",
          plannedTool: "LANDING_PAGE_EXPERIENCE_REVIEW_V1",
        },
        {
          slug: "mensuracao-da-pagina",
          title: "Configure o que precisa ser medido",
          summary: "Configure conversões e eventos nativos da landing page — sem JavaScript arbitrário.",
          publicPreview: null,
          estimatedMinutes: 35,
          sortOrder: 1,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Mapa de mensuração aplicado ao projeto",
          plannedTool: "LANDING_PAGE_MEASUREMENT_V1",
        },
        {
          slug: "revisao-antes-do-trafego",
          title: "Revise e publique sua landing page",
          summary: "Faça a revisão final, valide e publique a landing page com URL pública e snapshot estável.",
          publicPreview: null,
          estimatedMinutes: 35,
          sortOrder: 2,
          accessType: "PAID" as const,
          priceCents: 3990,
          plannedResult: "Landing page publicada",
          plannedTool: "LANDING_PAGE_PUBLISH_V1",
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

/** Catálogo/sitemap/indexação públicos só aceitam PUBLISHED. */
export function sitesCourseIsPubliclyVisible(status: "DRAFT" | "PUBLISHED" = sitesCourseSeed.status): boolean {
  return status === "PUBLISHED";
}

export function sitesCoursePlannedResultBySlug(slug: string): string | null {
  return sitesCourseLessons().find((lesson) => lesson.slug === slug)?.plannedResult ?? null;
}
