import type { CaseStudy } from "@/types/content";

export const casesIntro = {
  eyebrow: "Resultados",
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
