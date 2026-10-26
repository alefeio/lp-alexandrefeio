import { AcquisitionLink } from "@/components/analytics/AcquisitionLink";
import { Container } from "@/components/ui/Container";
import type { CourseCatalogCard } from "@/lib/learning/course-catalog";
import { courseChoiceScenarios } from "@/lib/learning/course-paths";

const linkClass = "text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cta";

export function CourseDecisionGuide({ courses }: { courses: CourseCatalogCard[] }) {
  const bySlug = new Map(courses.map((course) => [course.slug, course]));
  const visible = courseChoiceScenarios
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
    <section className="border-t border-border py-14" aria-label="Qual é o seu gargalo agora">
      <Container>
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">Qual é o seu gargalo agora?</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">Talvez você não precise dos dois agora.</p>
        <ul className="mt-8 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {visible.map((scenario) => (
            <li key={scenario.id} className="min-w-0 border-t border-border pt-4">
              <h3 className="text-base font-semibold leading-snug">{scenario.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{scenario.body}</p>
              <div className="mt-4 flex flex-col gap-2">
                {scenario.links.map((link) => (
                  <AcquisitionLink key={link.slug} className={linkClass} href={link.href} event="home_course_path_click" payload={{ course_slug: link.slug, scenario: scenario.id }}>
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
