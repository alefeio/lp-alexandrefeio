import type { Service } from "@/types/content";

export const servicesIntro = {
  eyebrow: "Serviços",
  title: "Escolha o ponto de partida.",
  description: "O valor é definido depois de entender o negócio.",
};

export const services: readonly Service[] = [
  {
    id: "site-essencial",
    name: "Site Essencial",
    description: "Para colocar ou melhorar a presença profissional.",
    items: ["Landing page ou site institucional", "Leitura boa no celular", "Caminho para o WhatsApp"],
    cta: "Quero este serviço",
    objectiveId: "criar-site",
  },
  {
    id: "site-trafego",
    name: "Site + Tráfego",
    description: "Para quem quer a página e a campanha no mesmo projeto.",
    items: [
      "Página feita para o anúncio",
      "Campanha no Google, no Meta ou nos dois",
      "Acompanhamento inicial",
    ],
    cta: "Quero este serviço",
    objectiveId: "site-trafego",
    featured: true,
    tag: "Mais completo",
  },
  {
    id: "gestao-trafego",
    name: "Gestão de Tráfego",
    description: "Para quem já tem site e quer conduzir os anúncios.",
    items: ["Planejamento das campanhas", "Ajustes ao longo do período", "Leitura dos contatos gerados"],
    cta: "Quero este serviço",
  },
];

export function findService(id: string | undefined): Service | undefined {
  if (!id) return undefined;
  return services.find((service) => service.id === id);
}
