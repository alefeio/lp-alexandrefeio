import type { Service } from "@/types/content";

export const servicesIntro = {
  eyebrow: "Serviços",
  title: "Escolha o ponto de partida.",
  description:
    "Três caminhos. O escopo e o valor são definidos depois de entender o negócio — sem preço genérico e sem promessa de quantidade de clientes.",
};

export const services: readonly Service[] = [
  {
    id: "site-essencial",
    name: "Site Essencial",
    description: "Para empresas que precisam construir ou melhorar a presença profissional.",
    items: [
      "Landing page ou site institucional",
      "Boa leitura no celular",
      "Página rápida",
      "Base para ser encontrada na busca",
      "Caminho direto para o WhatsApp",
      "Preparado para medir os contatos depois",
    ],
    cta: "Quero um site",
    objectiveId: "criar-site",
  },
  {
    id: "site-trafego",
    name: "Site + Tráfego",
    description: "Uma estrutura para começar a gerar oportunidades pela internet.",
    items: [
      "Página feita para gerar contato",
      "Preparação da oferta e da mensagem",
      "Campanha no Google, no Meta ou nos dois, conforme o caso",
      "Registro inicial dos contatos que vêm do anúncio",
      "Acompanhamento do começo",
      "Ajustes a partir do que acontecer",
    ],
    cta: "Quero começar",
    objectiveId: "site-trafego",
    featured: true,
    tag: "Mais completo",
  },
  {
    id: "gestao-trafego",
    name: "Gestão de Tráfego",
    description: "Para quem já tem uma presença digital e quer conduzir a aquisição com mais clareza.",
    items: [
      "Planejamento das campanhas",
      "Criação e configuração",
      "Acompanhamento",
      "Otimização ao longo do período",
      "Leitura dos contatos gerados",
      "Relatórios sobre o que aproxima uma oportunidade",
    ],
    cta: "Quero melhorar minhas campanhas",
  },
];

export function findService(id: string | undefined): Service | undefined {
  if (!id) return undefined;
  return services.find((service) => service.id === id);
}
