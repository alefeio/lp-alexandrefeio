import type { ProcessStep } from "@/types/content";

export const processIntro = {
  eyebrow: "Como funciona",
  title: "Um caminho curto.",
};

export const processSteps: readonly ProcessStep[] = [
  {
    number: "01",
    title: "Entendo seu negócio",
    description: "Objetivo, público e serviço.",
  },
  {
    number: "02",
    title: "Construo a estrutura",
    description: "Anúncio, página e forma de medir.",
  },
  {
    number: "03",
    title: "Colocamos no ar",
    description: "Campanhas e, quando fizer falta, a página.",
  },
  {
    number: "04",
    title: "Medimos e melhoramos",
    description: "Contatos, ajustes e o que muda depois.",
  },
];
