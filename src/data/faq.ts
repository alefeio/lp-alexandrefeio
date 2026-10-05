import type { FaqItem } from "@/types/content";

export const faqIntro = {
  eyebrow: "FAQ",
  title: "Perguntas frequentes",
  description: "Respostas diretas, sem promessa de resultado.",
};

export const faqItems: readonly FaqItem[] = [
  {
    id: "preco",
    question: "Quanto custa criar um site?",
    answer:
      "Depende da estrutura e do objetivo. Uma página enxuta e um site maior não têm o mesmo investimento. Eu entendo o que você precisa e envio uma proposta clara, sem preço genérico escondendo o que fica de fora.",
  },
  {
    id: "prazo",
    question: "Quanto tempo demora?",
    answer:
      "Projetos simples podem ir ao ar com rapidez, depois que o conteúdo essencial está alinhado. O prazo muda com o escopo, e você o recebe antes de começar.",
  },
  {
    id: "anuncios",
    question: "Você também faz os anúncios?",
    answer:
      "Sim, quando isso faz parte do projeto. Dá para começar só pela página, só pelas campanhas ou pelos dois juntos.",
  },
  {
    id: "site-existente",
    question: "Preciso já ter um site?",
    answer:
      "Não. A estrutura pode começar pela página adequada para receber as visitas. Se o site já existe, dá para ajustar a página, a campanha ou as duas.",
  },
  {
    id: "regiao",
    question: "Você atende somente Belém?",
    answer:
      "O foco é Belém e região. Também faço projetos remotos para outras cidades e estados.",
  },
  {
    id: "verba",
    question: "Quanto preciso investir em anúncios?",
    answer:
      "A mídia é separada do serviço e paga direto às plataformas. O valor depende do mercado, do objetivo e da concorrência. Eu ajudo a definir um ponto de partida antes de anunciar.",
  },
  {
    id: "resultado",
    question: "Como sei se a campanha está dando resultado?",
    answer:
      "A leitura olha para contatos e conversões, não só para cliques e visualizações. Assim dá para ver o que aproxima uma oportunidade e o que precisa mudar. Resultado comercial depende da oferta, da verba e do mercado.",
  },
];
