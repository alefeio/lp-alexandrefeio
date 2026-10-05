import type {
  Differential,
  FlowStep,
  IllustrativeMetric,
  ValuePillar,
} from "@/types/content";

export const heroContent = {
  eyebrow: "Sites + Tráfego Pago",
  title: "Transforme sua presença digital em oportunidades de negócio.",
  description:
    "Crio sites e campanhas de tráfego pago para levar as pessoas certas até sua empresa e transformar a visita em contato.",
};

export const heroFlow: readonly FlowStep[] = [
  { number: "01", title: "Tráfego", description: "Quem tem interesse chega" },
  { number: "02", title: "Landing page", description: "A página recebe a visita" },
  { number: "03", title: "Lead", description: "Vira contato" },
  { number: "04", title: "Oportunidade", description: "Vira conversa" },
];

export const heroMetrics: readonly IllustrativeMetric[] = [
  { label: "Visitantes", value: "1.240" },
  { label: "Conversões", value: "86" },
  { label: "Leads", value: "64" },
  { label: "Custo por lead", value: "R$ 18" },
];

export const heroMetricsNote = "Números fictícios. Não são resultados reais.";

export const problemContent = {
  title: "Ter um site não significa gerar negócios.",
  description: "A visita não vira conversa, ou a conversa acontece sem saber o que a provocou.",
  items: [
    "Página que não conduz o visitante até o contato",
    "Anúncio levando para uma página que não converte",
    "Investimento sem saber quais ações geram contatos",
  ],
};

export const valueContent = {
  title: "Site, tráfego e conversão.",
};

export const valuePillars: readonly ValuePillar[] = [
  {
    number: "01",
    title: "Site",
    description: "Página rápida e preparada para converter.",
  },
  {
    number: "02",
    title: "Tráfego",
    description: "Pessoas com maior potencial chegando até a empresa.",
  },
  {
    number: "03",
    title: "Conversão",
    description: "Um caminho claro da visita até o contato.",
  },
];

export const differentialsContent = {
  eyebrow: "Diferenciais",
  title: "Desenvolvimento e marketing trabalhando para o mesmo objetivo.",
};

export const differentials: readonly Differential[] = [
  {
    beforeLabel: "Não é apenas",
    before: "Fazer um site.",
    afterLabel: "É",
    after: "Construir uma página preparada para transformar tráfego em oportunidade.",
  },
  {
    beforeLabel: "Não é apenas",
    before: "Subir anúncios.",
    afterLabel: "É",
    after: "Entender o que acontece antes e depois do clique.",
  },
  {
    beforeLabel: "Não é apenas",
    before: "Mostrar métricas.",
    afterLabel: "É",
    after: "Medir os contatos, não só os cliques.",
  },
];

export const midCtaContent = {
  title: "Não sabe por onde começar?",
  description: "Me conte sobre seu negócio e eu te ajudo a identificar o melhor ponto de partida.",
};

export const aboutContent = {
  eyebrow: "Sobre",
  title: "A página e a campanha nascem juntas.",
  description:
    "Eu desenvolvo o site e conduzo o tráfego pago. O anúncio não aponta para uma página feita sem pensar na campanha.",
  photoLabel: "Espaço reservado para foto profissional",
};

export const finalCtaContent = {
  title: "Quer transformar sua presença digital em oportunidades?",
  description: "Conte um pouco sobre seu negócio.",
  microcopy: "Sem compromisso.",
};
