import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseHome } from "../src/components/home/CourseHome";
import { buildCourseCatalogCard } from "../src/lib/learning/course-catalog";
import { acquisitionAnalyticsPayload } from "../src/lib/learning/acquisition-analytics";
import { courseExperience, TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "../src/lib/learning/sites-course";
import type { CourseCatalogCard } from "../src/lib/learning/course-catalog";

function card(slug: string, title: string, lessons: { slug: string; title: string }[]): CourseCatalogCard {
  return {
    id: slug,
    slug,
    title,
    summary: `Resumo publicado de ${slug}`,
    lessonCount: 12,
    moduleCount: 5,
    freeLessonCount: lessons.length,
    freeLessons: lessons.map((lesson, index) => ({ ...lesson, number: index + 1 })),
    href: `/cursos/${slug}`,
    ctaLabel: "Conhecer o curso",
    microcopy: null,
    progress: null,
  };
}

function freeLessons(slug: string) {
  const experience = courseExperience(slug);
  assert.ok(experience);
  return experience.lessons.slice(0, 3).map((lesson) => ({
    slug: lesson.slug,
    title: `Catálogo ${lesson.slug}`,
  }));
}

function home(courses: CourseCatalogCard[], continuation: ReturnType<typeof createElement> | null = null) {
  return renderToStaticMarkup(createElement(CourseHome, { courses, continuation }));
}

test("a home mostra o sistema, as duas formações e as aulas gratuitas do catálogo", () => {
  const traffic = card(TRAFFIC_COURSE_SLUG, "Tráfego Pago na Prática para Pequenos Negócios", freeLessons(TRAFFIC_COURSE_SLUG));
  const sites = card(SITES_COURSE_SLUG, "Sites que Convertem para Pequenos Negócios", freeLessons(SITES_COURSE_SLUG));
  const html = home([sites, traffic], createElement("p", null, "Continuar de onde parei"));

  assert.match(html, /Transforme tráfego em oportunidades/);
  assert.match(html, /Atraia as pessoas certas, leve-as a uma página clara e saiba o que melhorar/);
  assert.match(html, /#formacoes/);
  assert.match(html, /#aulas-gratuitas/);
  assert.match(html, /id="como-funciona"/);
  assert.match(html, /Tráfego/);
  assert.match(html, /Página/);
  assert.match(html, /Contato/);
  assert.match(html, /Dados/);
  assert.match(html, /Próxima decisão/);
  assert.match(html, /Escolha o resultado que precisa agora/);
  assert.match(html, new RegExp(`/cursos/${TRAFFIC_COURSE_SLUG}`));
  assert.match(html, new RegExp(`/cursos/${SITES_COURSE_SLUG}`));
  assert.match(html, /Conhecer Tráfego Pago/);
  assert.match(html, /Conhecer Sites que Convertem/);
  assert.match(html, /Você sai com algo pronto para usar/);
  assert.match(html, /Diagnóstico da campanha/);
  assert.match(html, /Landing page publicada/);
  assert.match(html, /Comece grátis e descubra seu próximo passo/);
  assert.match(html, /Começar Tráfego Pago/);
  assert.match(html, /Começar Sites que Convertem/);
  assert.match(html, /Alexandre Feio/);
  assert.match(html, /APRENDER/);
  assert.match(html, /DELEGAR/);
  assert.match(html, /Continuar de onde parei/);
  assert.match(html, /3 aulas grátis · 12 aulas · 5 módulos/);
  assert.equal(html.includes("ROAS"), false);
  assert.equal(html.includes("8,3%"), false);
  assert.equal(html.includes("LandingPage"), false);
  assert.equal(html.includes("Qual é o seu gargalo agora"), false);
  assert.equal(html.includes("Da atenção à próxima decisão"), false);
  assert.equal(html.includes("Duas formações práticas. Um sistema aplicado ao seu negócio."), false);
  assert.equal(html.includes("Começar aula gratuita"), false);
  assert.ok(html.indexOf("Transforme tráfego") < html.indexOf("Continuar de onde parei"));
  assert.ok(html.indexOf("Continuar de onde parei") < html.indexOf("Escolha o resultado que precisa agora"));
  assert.ok(html.indexOf("Escolha o resultado") < html.indexOf("Você sai com algo pronto"));
  assert.ok(html.indexOf("Você sai com algo pronto") < html.indexOf("Comece grátis"));
});

test("curso fora do catálogo não gera link", () => {
  const html = home([card(TRAFFIC_COURSE_SLUG, "Tráfego Pago na Prática para Pequenos Negócios", freeLessons(TRAFFIC_COURSE_SLUG))]);
  assert.match(html, /Conhecer Tráfego Pago/);
  assert.equal(html.includes("Conhecer Sites que Convertem"), false);
  assert.equal(html.includes(`/cursos/${SITES_COURSE_SLUG}`), false);
  assert.equal(html.includes("Continuar de onde parei"), false);
});

test("a home não copia as 24 experiências e o caminho não leva dado privado", () => {
  const source = readdirSync("src/components/home")
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => readFileSync(`src/components/home/${name}`, "utf8"))
    .join("\n");
  assert.match(source, /courseExperience\(/);
  assert.match(readFileSync("src/components/home/HomeResults.tsx", "utf8"), /SitesPageVisual/);
  assert.match(readFileSync("src/components/home/ConnectedCourses.tsx", "utf8"), /href="\/cursos"/);
  assert.match(readFileSync("src/components/home/ConnectedCourses.tsx", "utf8"), /home_course_path_click/);
  assert.equal(source.includes("Como avaliar objetivo, oferta, público, destino, mensuração e operação antes de investir."), false);
  assert.equal(source.includes("courses[0]"), false);
  assert.equal(source.includes("courses[1]"), false);
  assert.equal(source.includes("CourseDecisionGuide"), false);
  assert.equal(source.includes("SystemStages"), false);
  assert.equal(source.includes("HomeArtifacts"), false);
  assert.equal(source.includes("ProductInAction"), false);
  assert.equal(source.includes("LearnOrDelegate"), false);

  const payload = acquisitionAnalyticsPayload({
    course_slug: TRAFFIC_COURSE_SLUG,
    scenario: "atrair",
    email: "a@b.com",
  } as never);
  assert.deepEqual(payload, { course_slug: TRAFFIC_COURSE_SLUG, scenario: "atrair" });
});

test("aula gratuita do catálogo guarda slug e número", () => {
  const card = buildCourseCatalogCard({
    id: "course-1",
    slug: TRAFFIC_COURSE_SLUG,
    title: "Tráfego",
    subtitle: "Subtítulo",
    description: "Descrição",
    modules: [
      {
        lessons: [
          { id: "l1", slug: "como-funciona-o-trafego-pago", title: "Como funciona", accessType: "FREE" },
          { id: "l2", slug: "google-ads-ou-meta-ads", title: "Canal", accessType: "FREE" },
          { id: "l3", slug: "", title: "Sem slug", accessType: "FREE" },
          { id: "l4", slug: "objetivo-oferta-orcamento", title: "Brief", accessType: "PAID" },
        ],
      },
    ],
  } as never);
  assert.equal(card.freeLessonCount, 3);
  assert.deepEqual(card.freeLessons, [
    { slug: "como-funciona-o-trafego-pago", title: "Como funciona", number: 1 },
    { slug: "google-ads-ou-meta-ads", title: "Canal", number: 2 },
  ]);
});
