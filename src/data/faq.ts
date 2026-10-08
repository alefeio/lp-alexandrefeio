import type { FaqItem } from "@/types/content";

export const faqIntro = {
  eyebrow: "FAQ",
  title: "Perguntas frequentes",
};

export const faqItems: readonly FaqItem[] = [
  {
    id: "gestao",
    question: "Como funciona a gestão de tráfego pago?",
    answer:
      "Analiso o negócio, a oferta, o público e a estrutura atual. A partir disso, organizo as campanhas, a mensuração e os ajustes ao longo do período.",
  },
  {
    id: "verba",
    question: "Quanto preciso investir em tráfego pago?",
    answer: "A mídia é paga direto às plataformas. O valor depende do mercado e do objetivo, e não entra no serviço.",
  },
  {
    id: "site-existente",
    question: "Preciso já ter um site?",
    answer: "Não. Dá para começar pelas campanhas. A página entra quando a atual não está pronta para converter.",
  },
  {
    id: "landing",
    question: "Você cria landing pages?",
    answer: "Sim, quando a página atual atrapalha a campanha. Nesse caso, ela entra para receber o tráfego.",
  },
  {
    id: "preco",
    question: "Quanto custa um site?",
    answer:
      "Depende da estrutura e do objetivo. Uma página enxuta e um site maior não custam o mesmo. A proposta vem depois de entender o que você precisa.",
  },
  {
    id: "regiao",
    question: "Você atende empresas fora de Belém?",
    answer: "Sim. Atendo empresas em todo o Brasil. Estou em Belém e o trabalho acontece à distância.",
  },
  {
    id: "prazo",
    question: "Quanto tempo demora?",
    answer:
      "Projetos simples podem ir ao ar rápido, quando o conteúdo essencial está alinhado. O prazo chega antes de começar.",
  },
  {
    id: "resultado",
    question: "Como o resultado é acompanhado?",
    answer: "Pelos contatos e conversões, não só por cliques e visualizações.",
  },
];
