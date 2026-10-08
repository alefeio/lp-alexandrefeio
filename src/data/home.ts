import type { Differential, FlowStep, ValuePillar } from "@/types/content";

export const heroContent = {
  eyebrow: "Tráfego pago + Conversão",
  title: "Transforme investimento em tráfego em oportunidades de negócio.",
  description:
    "Gestão de tráfego pago, landing pages e tecnologia trabalhando juntas para aumentar as chances de conversão.",
};

export const heroFlow: readonly FlowStep[] = [
  { number: "01", role: "Entrada", title: "Tráfego", description: "Quem tem interesse chega" },
  { number: "02", role: "Processamento", title: "Landing page", description: "A página recebe a visita" },
  { number: "03", role: "Ação", title: "Contato", description: "Vira contato" },
  { number: "04", role: "Resultado", title: "Oportunidade", description: "Vira conversa" },
];

export const problemContent = {
  title: "Gerar cliques não significa gerar oportunidades.",
  description: "Anúncio, mensagem, página, mensuração e conversão precisam seguir o mesmo caminho.",
  items: [
    "Anúncio e mensagem sem o mesmo caminho até o contato",
    "Página que não acompanha a campanha",
    "Clique sem leitura do que virou oportunidade",
  ],
};

export const valueContent = {
  title: "Tráfego, página e conversão.",
};

export const valuePillars: readonly ValuePillar[] = [
  {
    number: "01",
    title: "Tráfego",
    description: "Campanhas para levar as pessoas certas até a empresa.",
  },
  {
    number: "02",
    title: "Página",
    description: "Landing page ou site preparados para receber o anúncio.",
  },
  {
    number: "03",
    title: "Conversão",
    description: "Mensuração do contato, não só do clique.",
  },
];

export const differentialsContent = {
  eyebrow: "Diferenciais",
  title: "Desenvolvimento e marketing trabalhando para o mesmo objetivo.",
};

export const differentials: readonly Differential[] = [
  {
    beforeLabel: "Não é apenas",
    before: "Gerar cliques.",
    afterLabel: "É",
    after: "Fazer anúncio, página e mensuração trabalharem juntos.",
  },
  {
    beforeLabel: "Não é apenas",
    before: "Fazer um site.",
    afterLabel: "É",
    after: "Preparar a página que recebe o tráfego.",
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
  title: "Tecnologia e marketing fazem parte da mesma trajetória.",
  description:
    "Sou Alexandre Feio. Uno desenvolvimento, marketing e produto para conectar anúncio, página e conversão. Você fala direto comigo.",
};

export const finalCtaContent = {
  title: "Quer transformar sua presença digital em oportunidades?",
  description: "Conte um pouco sobre seu negócio.",
  microcopy: "Sem compromisso.",
};
