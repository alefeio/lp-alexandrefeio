import type { ProcessStep } from "@/types/content";

export const processIntro = {
  eyebrow: "Como funciona",
  title: "Um caminho curto, do entendimento à otimização.",
  description: "Pouca burocracia, proximidade e um critério claro do que observar depois da publicação.",
};

export const processSteps: readonly ProcessStep[] = [
  {
    number: "01",
    title: "Entendo seu negócio",
    description: "Objetivo, público, serviço e oportunidade.",
  },
  {
    number: "02",
    title: "Construo a estrutura",
    description: "Página, comunicação e jornada de conversão.",
  },
  {
    number: "03",
    title: "Colocamos no ar",
    description: "Site e, quando fizer parte do projeto, campanhas.",
  },
  {
    number: "04",
    title: "Medimos e melhoramos",
    description: "Análise das ações importantes e otimização.",
  },
];
