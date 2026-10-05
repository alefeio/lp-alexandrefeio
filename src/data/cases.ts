import type { CaseStudy } from "@/types/content";

export const casesIntro = {
  eyebrow: "Resultados",
  title: "Cases reais entram quando puderem ser publicados.",
  description:
    "Esta área já está pronta para receber projetos com autorização de uso. Até lá, ela não mostra clientes, depoimentos ou números.",
  devNote:
    "Conteúdo demonstrativo. Os objetos em src/data/cases.ts continuam mockados e não são exibidos como prova.",
};

export const cases: readonly CaseStudy[] = [
  {
    id: "empresa-exemplo",
    company: "Empresa Exemplo",
    segment: "Serviços",
    challenge: "Baixa geração de contatos pelo site",
    solution: "Landing page + campanha",
    result: "+XX% de conversões",
    isMock: true,
  },
  {
    id: "negocio-exemplo",
    company: "Negócio Exemplo",
    segment: "Comércio local",
    challenge: "Anúncios sem uma página preparada para o clique",
    solution: "Página de conversão + ajuste de campanha",
    result: "Indicador ilustrativo de custo por lead",
    isMock: true,
  },
];
