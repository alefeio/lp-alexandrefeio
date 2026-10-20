import { SITES_COURSE_SLUG, sitesCourseLessons } from "@/lib/learning/sites-course";
import { FIRST_COURSE_SLUG } from "@/lib/learning/first-course";

export type CourseSalesCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroSupport: string;
  primaryCta: string;
  secondaryCta: string;
  audienceTitle: string;
  audienceBody: string;
  learnsTitle: string;
  learnsBody: string;
  howTitle: string;
  howBody: string;
  positioningTitle: string;
  positioningBody: string;
  freeSectionTitle: string;
  fullCourseSection: "offer" | "roadmap";
  fullCourseTitle: string;
  fullCourseSupport: string;
  benefits: string[];
  resultsTitle: string;
  results: string[];
  resultsNote: string | null;
  hidePricesWhenNotForSale: boolean;
  modulesIntro: string;
  futureModulesNote: string;
  faqBuyTitle: string;
  faqBuyBodyClosed: string;
  faqBuyBodyOpen: string;
  faqReplaceTitle: string;
  faqReplaceBody: string;
  serviceTitle: string;
  serviceBody: string;
  serviceCta: string;
  serviceHref: string;
};

const TRAFFIC_COPY: CourseSalesCopy = {
  heroEyebrow: "Curso · 3 aulas gratuitas",
  heroTitle: "",
  heroSupport: "Aprenda, aplique no seu negócio e salve o diagnóstico e as ferramentas no seu projeto.",
  primaryCta: "Começar pelas aulas gratuitas",
  secondaryCta: "Ver o que você vai aprender",
  audienceTitle: "Para quem é",
  audienceBody:
    "Para quem toca um pequeno negócio e quer entender tráfego pago o bastante para decidir canal, oferta, destino e a primeira campanha — antes de abrir a plataforma de anúncios.",
  learnsTitle: "O que você aprende",
  learnsBody:
    "Como o anúncio chega numa pessoa, quando Google ou Meta faz mais sentido, se o negócio está pronto para anunciar, como planejar oferta e mensuração, configurar a primeira campanha, ler os números e decidir a próxima ação com critério.",
  howTitle: "Como funciona",
  howBody: "As aulas são texto. Você lê, responde e, nas ferramentas, grava o resultado no projeto. A ordem é sugerida. Nenhuma aula trava a seguinte.",
  positioningTitle: "",
  positioningBody: "",
  freeSectionTitle: "Três aulas gratuitas",
  fullCourseSection: "offer",
  fullCourseTitle: "Faça a jornada completa",
  fullCourseSupport: "Do primeiro planejamento até a análise dos seus próprios resultados.",
  benefits: [
    "Planejamento de campanha",
    "Google Ads",
    "Meta Ads",
    "Ferramentas práticas",
    "Diagnóstico dos resultados",
    "Análise de CSV/XLSX",
    "Plano de próxima ação",
  ],
  resultsTitle: "Resultados que você guarda",
  results: [
    "Meu primeiro mapa de tráfego",
    "Minha indicação inicial de canal",
    "Diagnóstico de Prontidão",
    "Brief Inicial de Campanha",
    "Plano de Destino e Mensuração",
    "Blueprint de Campanha de Pesquisa",
    "Plano inicial de palavras-chave",
    "Plano de anúncios responsivos",
    "Plano inicial de campanha Meta",
    "Plano de geração e atendimento de leads",
    "Diagnóstico dos resultados da campanha",
    "Plano de próxima ação",
  ],
  resultsNote:
    "Nas aulas de análise, você também pode enviar um CSV ou XLSX privado da campanha para diagnosticar gargalos sem expor o arquivo em páginas públicas.",
  hidePricesWhenNotForSale: false,
  modulesIntro: "Você também pode adquirir módulos ou aulas individualmente.",
  futureModulesNote: "",
  faqBuyTitle: "Já dá para comprar as aulas pagas?",
  faqBuyBodyClosed: "Ainda não. As aulas pagas têm uma parte pública para leitura. O restante fica para quando a venda abrir.",
  faqBuyBodyOpen: "Sim. As aulas e os módulos que estão à venda mostram o preço e o botão de compra. O que ainda não foi liberado continua em breve.",
  faqReplaceTitle: "O curso substitui a gestão?",
  faqReplaceBody: "Não. O curso é para quem quer aprender e aplicar. A gestão é para quem prefere que eu conduza a campanha.",
  serviceTitle: "Prefere delegar?",
  serviceBody:
    "Eu também faço gestão de tráfego pago, estrutura de conversão, mensuração e landing page quando o anúncio precisa de uma página.",
  serviceCta: "Conhecer o serviço",
  serviceHref: "/trafego-pago",
};

const SITES_COPY: CourseSalesCopy = {
  heroEyebrow: "Sites que Convertem para Pequenos Negócios",
  heroTitle: "Transforme sua página em um caminho claro até a próxima ação.",
  heroSupport:
    "Aprenda a planejar oferta, estrutura, mensagem, confiança, experiência e mensuração — aplicando cada etapa no seu próprio negócio.",
  primaryCta: "Começar gratuitamente",
  secondaryCta: "Ver o que você vai aprender",
  audienceTitle: "Para quem é",
  audienceBody:
    "Para pequenos negócios, profissionais e empreendedores que precisam de páginas mais claras e orientadas à conversão — sem depender de implementação técnica nesta trilha.",
  learnsTitle: "O que você aprende",
  learnsBody:
    "Jornada de conversão, estrutura digital adequada, fundamentos da página, oferta, público, ação principal, copy, hierarquia, confiança, experiência mobile e mensuração da ação.",
  howTitle: "Como funciona",
  howBody:
    "As aulas são texto. Você lê, responde e, nas ferramentas, grava o resultado no projeto. A ordem é sugerida. Nenhuma aula trava a seguinte.",
  positioningTitle: "Isto não é um curso de programação",
  positioningBody:
    "Não ensinamos HTML, CSS, WordPress ou Next.js. O foco é estratégia, conversão, jornada, estrutura, copy, confiança, experiência e mensuração.",
  freeSectionTitle: "Comece gratuitamente",
  fullCourseSection: "roadmap",
  fullCourseTitle: "A formação completa",
  fullCourseSupport: "Depois do bloco gratuito, a formação continua planejando e estruturando a página passo a passo.",
  benefits: [
    "Mapa de conversão",
    "Estrutura digital ideal",
    "Diagnóstico de prontidão",
    "Brief da página",
    "Jornada do visitante",
    "Estrutura e copy",
    "Confiança e experiência",
    "Mensuração e revisão",
  ],
  resultsTitle: "O que você constrói ao longo da formação",
  results: sitesCourseLessons().map((lesson) => lesson.plannedResult),
  resultsNote: "As três primeiras aulas já estão disponíveis. Os resultados das etapas seguintes entram quando cada módulo for liberado.",
  hidePricesWhenNotForSale: true,
  modulesIntro: "Veja o programa completo. Hoje, o Módulo 1 está disponível.",
  futureModulesNote: "Os próximos módulos estão sendo preparados.",
  faqBuyTitle: "Já dá para comprar a formação completa?",
  faqBuyBodyClosed: "Ainda não. Você pode começar pelas três aulas gratuitas. A venda da formação completa abre quando o conteúdo pago estiver pronto.",
  faqBuyBodyOpen: "Sim. O que estiver à venda aparece com preço e botão de compra.",
  faqReplaceTitle: "O curso substitui a criação do site?",
  faqReplaceBody: "Não. O curso ensina a planejar a página para converter. A implementação técnica ou a gestão ficam como escolha à parte.",
  serviceTitle: "Prefere delegar?",
  serviceBody: "Também ajudo com estrutura de conversão, mensuração e páginas quando o negócio precisa de execução acompanhada.",
  serviceCta: "Conhecer o serviço",
  serviceHref: "/trafego-pago",
};

export function courseSalesCopy(slug: string, courseTitle: string): CourseSalesCopy {
  if (slug === SITES_COURSE_SLUG) {
    return { ...SITES_COPY, heroTitle: SITES_COPY.heroTitle || courseTitle };
  }
  if (slug === FIRST_COURSE_SLUG) {
    return { ...TRAFFIC_COPY, heroTitle: courseTitle };
  }
  return { ...TRAFFIC_COPY, heroTitle: courseTitle };
}

export function courseMetadataDescription(slug: string, subtitle: string | null, description: string): string {
  if (slug === SITES_COURSE_SLUG) {
    const base = subtitle?.trim() || description;
    return `${base} Três aulas gratuitas para planejar páginas que convertem.`;
  }
  if (subtitle) {
    return `${subtitle} Três aulas gratuitas para aplicar tráfego pago no pequeno negócio.`;
  }
  return description;
}
