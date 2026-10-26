import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";

export type CourseSalesCopy = {
  heroEyebrow: string;
  heroTitle: string;
  heroSupport: string;
  primaryCta: string;
  secondaryCta: string;
  freeSectionTitle: string;
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
  heroEyebrow: "Curso · 3 aulas gratuitas",
  heroTitle: "",
  heroSupport: "Planeje a campanha, leia os seus dados e decida o próximo passo com critério.",
  primaryCta: "Começar gratuitamente",
  secondaryCta: "Ver programa completo",
  freeSectionTitle: "Três aulas gratuitas",
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
  primaryCta: "Começar gratuitamente",
  secondaryCta: "Ver programa completo",
  freeSectionTitle: "Três aulas gratuitas",
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
  if (slug === TRAFFIC_COURSE_SLUG) return { ...TRAFFIC_COPY, heroTitle: courseTitle };
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
