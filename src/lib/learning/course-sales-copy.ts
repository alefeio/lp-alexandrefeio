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
  offerBenefits: string[];
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
  nextStepTitle: string;
};

const TRAFFIC_COPY: CourseSalesCopy = {
  heroEyebrow: "Tráfego Pago na Prática · 3 aulas grátis",
  heroTitle: "Planeje campanhas, leia os números e saiba o que melhorar.",
  heroSupport: "Google Ads e Meta Ads do plano à próxima decisão.",
  heroRiskNote: "3 aulas gratuitas · sem cartão · sem cadastro para começar",
  primaryCta: "Começar a 1ª aula grátis",
  primaryCtaName: "comecar_primeira_aula",
  secondaryCta: "Ver as 3 aulas gratuitas",
  secondaryHref: "#aulas-gratuitas",
  secondaryCtaName: "ver_aulas_gratuitas",
  freeSectionTitle: "Três aulas gratuitas",
  freeSectionIntro: "Abra sem cadastro.",
  fullCourseTitle: "Formação completa",
  fullCourseSupport: "Do plano à próxima decisão com os seus dados.",
  offerBenefits: [
    "Planejar antes de investir",
    "Escolher o canal com critério",
    "Ler os dados e decidir a próxima ação",
  ],
  hidePricesWhenNotForSale: false,
  faqBuyTitle: "Já dá para comprar as aulas pagas?",
  faqBuyBodyClosed: "Ainda não. As aulas pagas têm uma parte pública para leitura. A compra aparece quando a venda abrir.",
  faqBuyBodyOpen: "Sim. As aulas e os módulos que estão à venda mostram o preço e o botão de compra.",
  faqReplaceTitle: "O curso substitui a gestão?",
  faqReplaceBody: "Não. O curso é para quem quer aprender e aplicar. A gestão é para quem prefere que eu conduza a campanha.",
  serviceTitle: "Prefiro delegar",
  serviceBody: "Gestão de tráfego e estrutura de conversão.",
  serviceCta: "Conhecer o serviço",
  serviceHref: "/trafego-pago",
  nextStepTitle: "Quer continuar avançando?",
};

const SITES_COPY: CourseSalesCopy = {
  heroEyebrow: "Sites que Convertem · 3 aulas grátis",
  heroTitle: "Construa e publique uma landing page para o seu negócio.",
  heroSupport: "Da oferta à página no ar.",
  heroRiskNote: null,
  primaryCta: "Começar gratuitamente",
  primaryCtaName: "aulas_gratuitas",
  secondaryCta: "Ver programa completo",
  secondaryHref: "#programa",
  secondaryCtaName: "ver_programa",
  freeSectionTitle: "Três aulas gratuitas",
  freeSectionIntro: "Experimente com o seu próprio negócio.",
  fullCourseTitle: "Formação completa",
  fullCourseSupport: "Da oferta à landing page publicada.",
  offerBenefits: [
    "Planejar a página",
    "Construir a mensagem e a estrutura",
    "Publicar uma landing page real",
  ],
  hidePricesWhenNotForSale: true,
  faqBuyTitle: "Já dá para comprar a formação completa?",
  faqBuyBodyClosed: "Ainda não. Quando a formação estiver à venda, o preço aparece nesta página. As três primeiras aulas seguem abertas.",
  faqBuyBodyOpen: "Sim. O que estiver à venda aparece com preço e botão de compra.",
  faqReplaceTitle: "O curso substitui a criação do site?",
  faqReplaceBody: "O curso entrega uma landing page publicada na plataforma. Não ensina HTML, CSS, WordPress nem exporta código. Domínio próprio fica fora desta formação.",
  serviceTitle: "Prefiro delegar",
  serviceBody: "Estrutura de conversão e páginas com execução acompanhada.",
  serviceCta: "Conhecer o serviço",
  serviceHref: "/trafego-pago",
  nextStepTitle: "Quer continuar avançando?",
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
