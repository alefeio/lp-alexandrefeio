import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

export type CoursePathLink = {
  slug: string;
  label: string;
  shortLabel: string;
};

export type CourseChoiceScenario = {
  id: string;
  catalog: string | null;
  catalogNote: string | null;
  title: string;
  body: string;
  links: CoursePathLink[];
};

export const courseChoiceScenarios: CourseChoiceScenario[] = [
  {
    id: "atrair",
    catalog: "atrair",
    catalogNote: null,
    title: "Preciso atrair mais pessoas.",
    body: "Planejar campanha, canal, Google ou Meta e a leitura dos resultados.",
    links: [{ slug: TRAFFIC_COURSE_SLUG, label: "Ver Tráfego Pago", shortLabel: "Tráfego" }],
  },
  {
    id: "pagina",
    catalog: "converter",
    catalogNote: null,
    title: "Já atraio pessoas, mas minha página ainda não ajuda a avançar.",
    body: "Planejar, construir e publicar a página para onde essas pessoas vão.",
    links: [{ slug: SITES_COURSE_SLUG, label: "Ver Sites que Convertem", shortLabel: "Sites" }],
  },
  {
    id: "anunciar",
    catalog: null,
    catalogNote: null,
    title: "Minha página está estruturada, mas não sei anunciar ou analisar campanhas.",
    body: "Escolher o canal, estruturar a campanha e decidir a próxima ação com os próprios dados.",
    links: [{ slug: TRAFFIC_COURSE_SLUG, label: "Ver Tráfego Pago", shortLabel: "Tráfego" }],
  },
  {
    id: "organizar",
    catalog: "os dois",
    catalogNote: "Começar pelo gargalo mais cedo da jornada.",
    title: "Preciso organizar aquisição e página.",
    body: "Uma sequência possível é começar pelo tráfego e seguir para a página, se esse for o próximo gargalo.",
    links: [
      { slug: TRAFFIC_COURSE_SLUG, label: "Ver Tráfego Pago", shortLabel: "Tráfego" },
      { slug: SITES_COURSE_SLUG, label: "Ver Sites que Convertem", shortLabel: "Sites" },
    ],
  },
];
