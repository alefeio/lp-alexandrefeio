import type { FaqItem } from "@/types/content";

export const faqIntro = {
  eyebrow: "FAQ",
  title: "Perguntas frequentes",
};

export const faqItems: readonly FaqItem[] = [
  {
    id: "preco",
    question: "Quanto custa criar um site?",
    answer:
      "Depende da estrutura e do objetivo. Uma página enxuta e um site maior não custam o mesmo. A proposta vem depois de entender o que você precisa.",
  },
  {
    id: "prazo",
    question: "Quanto tempo demora?",
    answer:
      "Projetos simples podem ir ao ar rápido, quando o conteúdo essencial está alinhado. O prazo chega antes de começar.",
  },
  {
    id: "anuncios",
    question: "Você também faz os anúncios?",
    answer: "Sim. A gestão de tráfego é o ponto de partida. A página entra quando ela está no caminho do resultado.",
  },
  {
    id: "site-existente",
    question: "Preciso já ter um site?",
    answer: "Não. O projeto pode começar pela página. Se o site já existe, ajusto a página, a campanha ou as duas.",
  },
  {
    id: "regiao",
    question: "Você atende somente Belém?",
    answer: "Não. Atendo empresas em todo o Brasil. Estou em Belém e o trabalho acontece à distância.",
  },
  {
    id: "verba",
    question: "O investimento em mídia está incluso?",
    answer: "Não. A mídia é paga direto às plataformas e depende do mercado e do objetivo.",
  },
  {
    id: "resultado",
    question: "Como o resultado é acompanhado?",
    answer: "Pelos contatos e conversões, não só por cliques e visualizações.",
  },
];
