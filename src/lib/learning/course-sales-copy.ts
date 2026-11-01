import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";

export type CourseSalesCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroSupport: string;
  heroRiskNote: string | null;
  primaryCta: string;
  primaryCtaName: string;
  secondaryCta: string;
  secondaryHref: string;
  secondaryCtaName: string;
  freeSectionTitle: string;
  freeSectionIntro: string;
  fullCourseTitle: string;
  fullCourseSupport: string;
  hidePricesWhenNotForSale: boolean;
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
  heroEyebrow: "Curso prático de tráfego pago · 3 aulas gratuitas",
  heroTitle: "Aprenda a planejar campanhas, entender os números e saber o que melhorar.",
  heroSupport: "Mesmo começando do zero, você aprende a tomar decisões de Google Ads e Meta Ads para um pequeno negócio sem depender de achismo.",
  heroRiskNote: "3 aulas gratuitas · sem cartão · sem cadastro para começar",
  primaryCta: "Começar a 1ª aula grátis",
  primaryCtaName: "comecar_primeira_aula",
  secondaryCta: "Ver as 3 aulas gratuitas",
  secondaryHref: "#aulas-gratuitas",
  secondaryCtaName: "ver_aulas_gratuitas",
  freeSectionTitle: "Três aulas gratuitas",
  freeSectionIntro: "Comece sem cadastro. Faça as três primeiras aulas e aplique as decisões ao seu próprio negócio.",
  fullCourseTitle: "Faça a jornada completa",
  fullCourseSupport: "Do planejamento da campanha até a leitura dos seus próprios resultados.",
  hidePricesWhenNotForSale: false,
  faqBuyTitle: "Já dá para comprar as aulas pagas?",
  faqBuyBodyClosed: "Ainda não. As aulas pagas têm uma parte pública para leitura. A compra aparece quando a venda abrir.",
  faqBuyBodyOpen: "Sim. As aulas e os módulos que estão à venda mostram o preço e o botão de compra.",
  faqReplaceTitle: "O curso substitui a gestão?",
  faqReplaceBody: "Não. O curso é para quem quer aprender e aplicar. A gestão é para quem prefere que eu conduza a campanha.",
  serviceTitle: "Prefere delegar?",
  serviceBody: "Eu também faço gestão de tráfego pago, estrutura de conversão, mensuração e landing page quando o anúncio precisa de uma página.",
  serviceCta: "Conhecer o serviço",
  serviceHref: "/trafego-pago",
};

const SITES_COPY: CourseSalesCopy = {
  heroEyebrow: "Sites que Convertem para Pequenos Negócios",
  heroTitle: "Planeje, construa e publique sua própria landing page enquanto aprende.",
  heroSupport: "Você constrói e publica uma landing page real na plataforma, sem programar.",
  heroRiskNote: null,
  primaryCta: "Começar gratuitamente",
  primaryCtaName: "aulas_gratuitas",
  secondaryCta: "Ver programa completo",
  secondaryHref: "#programa",
  secondaryCtaName: "ver_programa",
  freeSectionTitle: "Três aulas gratuitas",
  freeSectionIntro: "Experimente a metodologia com seu próprio negócio.",
  fullCourseTitle: "A formação completa",
  fullCourseSupport: "Depois de descobrir o caminho, você constrói e publica a página passo a passo.",
  hidePricesWhenNotForSale: true,
  faqBuyTitle: "Já dá para comprar a formação completa?",
  faqBuyBodyClosed: "Ainda não. Quando a formação estiver à venda, o preço aparece nesta página. As três primeiras aulas seguem abertas.",
  faqBuyBodyOpen: "Sim. O que estiver à venda aparece com preço e botão de compra.",
  faqReplaceTitle: "O curso substitui a criação do site?",
  faqReplaceBody: "O curso entrega uma landing page publicada na plataforma. Não ensina HTML, CSS, WordPress nem exporta código. Domínio próprio fica fora desta formação.",
  serviceTitle: "Prefere delegar?",
  serviceBody: "Também ajudo com estrutura de conversão, mensuração e páginas quando o negócio precisa de execução acompanhada.",
  serviceCta: "Conhecer o serviço",
  serviceHref: "/trafego-pago",
};

export function courseSalesCopy(slug: string, courseTitle: string): CourseSalesCopy {
  if (slug === SITES_COURSE_SLUG) return SITES_COPY;
  if (slug === TRAFFIC_COURSE_SLUG) return TRAFFIC_COPY;
  return { ...TRAFFIC_COPY, heroTitle: courseTitle, heroRiskNote: null, secondaryHref: "#programa", secondaryCtaName: "ver_programa" };
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
