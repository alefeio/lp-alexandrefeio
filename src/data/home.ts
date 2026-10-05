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
    "Crio sites rápidos e campanhas de tráfego pago pensados para levar as pessoas certas até sua empresa — e transformar visitas em contatos.",
};

export const heroFlow: readonly FlowStep[] = [
  { number: "01", title: "Tráfego", description: "As pessoas certas chegam" },
  { number: "02", title: "Landing page", description: "A oferta pede o próximo passo" },
  { number: "03", title: "Lead", description: "O interesse vira contato" },
  { number: "04", title: "Oportunidade", description: "A empresa ganha uma conversa" },
];

export const heroMetrics: readonly IllustrativeMetric[] = [
  { label: "Visitantes", value: "1.240" },
  { label: "Conversões", value: "86" },
  { label: "Leads", value: "64" },
  { label: "Custo por lead", value: "R$ 18" },
];

export const heroMetricsNote =
  "Números fictícios para demonstrar a interface. Não são resultados reais.";

export const problemContent = {
  title: "Ter um site não significa gerar negócios.",
  description:
    "A empresa aparece na internet, mas a visita não vira conversa. Ou a conversa acontece e ninguém sabe o que a provocou.",
  items: [
    "Site lento, abandonado antes de a oferta ficar clara",
    "Página que não conduz o visitante até o contato",
    "Anúncio apontando para uma página que não converte",
    "Presença que depende quase só do Instagram",
    "Contatos que chegam sem acompanhamento",
    "Campanha sem medida do que gera oportunidade",
    "Mídia paga sem clareza do que aproxima uma venda",
  ],
  statement: "O resultado aparece quando site, tráfego e conversão trabalham juntos.",
};

export const problemFlow: readonly FlowStep[] = [
  { number: "01", title: "Site", description: "A página segura a visita." },
  { number: "02", title: "Tráfego", description: "O anúncio traz gente qualificada." },
  { number: "03", title: "Conversão", description: "O clique vira contato." },
  { number: "04", title: "Oportunidade", description: "A empresa ganha uma conversa." },
];

export const valueContent = {
  eyebrow: "Proposta",
  title: "Uma estrutura digital pensada para gerar oportunidades.",
  description:
    "Não basta levar pessoas até sua empresa. É preciso criar uma estrutura capaz de transformar essas visitas em oportunidades.",
};

export const valuePillars: readonly ValuePillar[] = [
  {
    number: "01",
    title: "Site",
    description:
      "Uma página rápida, profissional e preparada para converter. Quem chega entende a oferta e sabe como falar com você.",
  },
  {
    number: "02",
    title: "Tráfego",
    description:
      "Campanhas para levar pessoas com maior potencial até sua empresa, com a página já pronta para recebê-las.",
  },
  {
    number: "03",
    title: "Conversão",
    description:
      "Uma jornada clara para transformar visitas em contatos e oportunidades que dá para acompanhar.",
  },
];

export const differentialsContent = {
  eyebrow: "Diferenciais",
  title: "Desenvolvimento e marketing trabalhando para o mesmo objetivo.",
  description: "O trabalho fica na ligação entre a página e a aquisição, não na entrega de peças soltas.",
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
    after: "Medir as ações que aproximam a empresa de uma oportunidade comercial.",
  },
];

export const midCtaContent = {
  title: "Não sabe se precisa primeiro de um site ou de tráfego?",
  description: "Conte um pouco sobre seu negócio e podemos identificar o melhor ponto de partida.",
};

export const aboutContent = {
  eyebrow: "Sobre",
  title: "Tecnologia e marketing trabalhando juntos.",
  description:
    "Trabalho unindo desenvolvimento, estratégia digital e tráfego pago para criar estruturas que ajudem empresas a transformar sua presença online em oportunidades reais de negócio.",
  photoLabel: "Espaço reservado para foto profissional",
};

export const finalCtaContent = {
  title: "Quer transformar sua presença digital em uma fonte de oportunidades?",
  description:
    "Me conte um pouco sobre seu negócio e eu te ajudo a identificar o melhor ponto de partida.",
  microcopy: "Sem compromisso e sem apresentação comercial interminável.",
};
