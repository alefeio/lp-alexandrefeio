import type { FlowStep, ProcessStep, Service } from "@/types/content";

export const trafegoPagoService: Service = {
  id: "trafego-pago",
  name: "Gestão de Tráfego Pago",
  description: "Campanhas, página de destino e mensuração no mesmo trabalho.",
  items: [],
  cta: "Quero falar sobre meu projeto",
  objectiveId: "google-ads",
};

export const trafegoHeroFlow: readonly FlowStep[] = [
  { number: "01", role: "Entrada", title: "Anúncio", description: "A pessoa certa encontra a empresa" },
  { number: "02", role: "Destino", title: "Página", description: "A visita entende a oferta" },
  { number: "03", role: "Ação", title: "Contato", description: "O interesse vira conversa" },
  { number: "04", role: "Leitura", title: "Oportunidade", description: "Dá para saber o que gerou o contato" },
];

export const trafegoSolution = [
  { title: "Tráfego", description: "Estrutura e gestão das campanhas." },
  { title: "Conversão", description: "O que a pessoa encontra depois do clique." },
  { title: "Mensuração", description: "Acompanhamento dos contatos, não só dos cliques." },
  { title: "Tecnologia", description: "Ajuste de landing page ou site quando isso trava o resultado." },
] as const;

export const trafegoScenarios = [
  {
    title: "Já tenho um bom site",
    description: "A gestão fica nas campanhas e na leitura do que elas geram.",
  },
  {
    title: "Meu site não está preparado",
    description: "Além das campanhas, a página pode ser criada ou ajustada para receber o anúncio.",
  },
] as const;

export const trafegoSteps: readonly ProcessStep[] = [
  {
    number: "01",
    title: "Diagnóstico",
    description: "Negócio, público, oferta e a estrutura que já existe.",
  },
  {
    number: "02",
    title: "Estratégia",
    description: "Campanhas, termos, anúncios e o caminho até o contato.",
  },
  {
    number: "03",
    title: "Execução",
    description: "Configuração e entrada em operação.",
  },
  {
    number: "04",
    title: "Otimização",
    description: "Leitura dos dados e ajustes ao longo do período.",
  },
];
