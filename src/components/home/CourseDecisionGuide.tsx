import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { TRAFFIC_COURSE_SLUG } from "@/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "@/lib/learning/sites-course";

type PathLink = {
  slug: string;
  label: string;
};

const scenarios: Array<{
  id: string;
  title: string;
  body: string;
  links: PathLink[];
}> = [
  {
    id: "atrair",
    title: "Preciso atrair mais pessoas.",
    body: "Planejar campanha, canal, Google ou Meta e a leitura dos resultados.",
    links: [{ slug: TRAFFIC_COURSE_SLUG, label: "Ver Tráfego Pago" }],
  },
  {
    id: "pagina",
    title: "Já atraio pessoas, mas minha página ainda não ajuda a avançar.",
    body: "Planejar, construir e publicar a página para onde essas pessoas vão.",
    links: [{ slug: SITES_COURSE_SLUG, label: "Ver Sites que Convertem" }],
  },
  {
    id: "anunciar",
    title: "Minha página está estruturada, mas não sei anunciar ou analisar campanhas.",
    body: "Escolher o canal, estruturar a campanha e decidir a próxima ação com os próprios dados.",
    links: [{ slug: TRAFFIC_COURSE_SLUG, label: "Ver Tráfego Pago" }],
  },
  {
    id: "organizar",
    title: "Preciso organizar aquisição e página.",
    body: "Uma sequência possível é começar pelo tráfego e seguir para a página, se esse for o próximo gargalo.",
    links: [
      { slug: TRAFFIC_COURSE_SLUG, label: "Ver Tráfego Pago" },
      { slug: SITES_COURSE_SLUG, label: "Ver Sites que Convertem" },
    ],
  },
];

export function CourseDecisionGuide({ courses }: { courses: CourseCatalogCard[] }) {
  const bySlug = new Map(courses.map((course) => [course.slug, course]));
  const visible = scenarios
    .map((scenario) => ({
      ...scenario,
      links: scenario.links.flatMap((link) => {
        const course = bySlug.get(link.slug);
        return course ? [{ ...link, href: course.href }] : [];
      }),
    }))
    .filter((scenario) => scenario.links.length > 0);
  if (visible.length === 0) return null;

  return (
    <section className="border-t border-border py-16" aria-label="Qual é o seu gargalo agora">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Qual é o seu gargalo agora?</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">Talvez você não precise dos dois agora.</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {visible.map((scenario) => (
            <li key={scenario.id} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <h3 className="text-base font-semibold leading-snug">{scenario.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{scenario.body}</p>
              <div className="mt-5 flex flex-col gap-2">
                {scenario.links.map((link) => (
                  <AcquisitionLink
                    key={link.slug}
                    className="text-sm font-medium underline underline-offset-4"
                    href={link.href}
                    event="home_course_path_click"
                    payload={{ course_slug: link.slug, scenario: scenario.id }}
                  >
                    {link.label}
                  </AcquisitionLink>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
