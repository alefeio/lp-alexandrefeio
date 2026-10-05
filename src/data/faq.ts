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
    answer: "Sim, quando faz parte do projeto. Dá para começar só pelo site, só pelos anúncios ou pelos dois.",
  },
  {
    id: "site-existente",
    question: "Preciso já ter um site?",
    answer: "Não. O projeto pode começar pela página. Se o site já existe, ajusto a página, a campanha ou as duas.",
  },
  {
    id: "regiao",
    question: "Você atende somente Belém?",
    answer: "O foco é Belém e região. Também faço projetos remotos.",
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
