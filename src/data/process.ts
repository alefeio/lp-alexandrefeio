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
    description: "Página e caminho até o contato.",
  },
  {
    number: "03",
    title: "Colocamos no ar",
    description: "Site e, se fizer parte, campanhas.",
  },
  {
    number: "04",
    title: "Medimos e melhoramos",
    description: "Contatos, ajustes e o que muda depois.",
  },
];
