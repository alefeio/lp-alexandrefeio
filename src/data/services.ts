import type { Service } from "@/types/content";

export const servicesIntro = {
  eyebrow: "Serviços",
  title: "Escolha o ponto de partida.",
  description: "O valor é definido depois de entender o negócio.",
};

export const services: readonly Service[] = [
  {
    id: "trafego-pago",
    name: "Gestão de Tráfego Pago",
    description: "Para anunciar com estratégia e saber quais contatos a campanha gerou.",
    items: ["Campanhas no Google, no Meta ou nos dois", "Ajustes ao longo do período", "Leitura das oportunidades"],
    cta: "Conhecer a gestão de tráfego",
    href: "/trafego-pago",
    featured: true,
    tag: "Principal",
  },
  {
    id: "site-trafego",
    name: "Tráfego + Página",
    description: "Quando a campanha e a página precisam nascer no mesmo projeto.",
    items: ["Landing page feita para o anúncio", "Gestão das campanhas", "Acompanhamento inicial"],
    cta: "Quero este serviço",
    objectiveId: "site-trafego",
  },
  {
    id: "site-essencial",
    name: "Site e landing page",
    description: "Para receber o tráfego com uma página clara, quando a atual não converte.",
    items: ["Landing page ou site profissional", "Leitura boa no celular", "Caminho até o contato"],
    cta: "Quero este serviço",
    objectiveId: "criar-site",
  },
];

export function findService(id: string | undefined): Service | undefined {
  if (!id) return undefined;
  const normalized = id === "gestao-trafego" ? "trafego-pago" : id;
  return services.find((service) => service.id === normalized);
}
