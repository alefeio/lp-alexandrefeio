import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { navigation, footerNavigation } from "../src/data/navigation";
import { publicHomeCopy, publicHomeMetadata } from "../src/lib/home/public-home";

test("home posiciona as duas formações e não a landing de um único curso", () => {
  assert.equal(publicHomeCopy.hero, "Transforme tráfego em oportunidades.");
  assert.equal(publicHomeCopy.primaryCta, "Conhecer as formações");
  assert.equal(publicHomeCopy.secondaryCta, "Começar gratuitamente");
  assert.match(publicHomeMetadata.title, /pequenos negócios/);
  assert.match(publicHomeMetadata.description, /Alexandre Feio/);
  assert.match(publicHomeMetadata.description, /página/);
  assert.equal(publicHomeMetadata.title.includes("Alexandre Feio"), false);

  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  const connected = readFileSync(new URL("../src/components/home/ConnectedCourses.tsx", import.meta.url), "utf8");
  assert.match(home, /HomeHero/);
  assert.match(home, /ConnectedCourses/);
  assert.match(home, /FreeCourseJourney/);
  assert.equal(home.includes("HomeCourseSummaries"), false);
  assert.match(connected, /href="\/cursos"/);
  assert.match(connected, /freeLessonCount/);
  assert.equal(home.includes("Porta de entrada do curso de Tráfego Pago"), false);
  assert.equal(home.includes("Conhecimento sem aplicação não muda o negócio"), false);
  assert.equal(home.includes("Meu primeiro mapa de tráfego"), false);
  assert.equal(home.includes('id="comece-gratis"'), false);
});

test("nav e footer usam semântica multi-curso sem Aulas gratuitas", () => {
  assert.equal(navigation.find((item) => item.label === "Cursos")?.href, "/cursos");
  assert.equal(footerNavigation.find((item) => item.label === "Cursos")?.href, "/cursos");
  assert.equal(navigation.some((item) => item.label === "Curso"), false);
  assert.equal(navigation.some((item) => item.label === "Aulas gratuitas"), false);
  assert.equal(footerNavigation.some((item) => item.label === "Aulas gratuitas"), false);
  assert.deepEqual(
    navigation.map((item) => item.label),
    ["Cursos", "Como funciona", "Sobre", "Gestão"],
  );
});

test("página do curso preserva aulas gratuitas e oferta completa", () => {
  const sales = readFileSync(new URL("../src/components/course/CourseSales.tsx", import.meta.url), "utf8");
  const curriculum = readFileSync(new URL("../src/components/course/CourseCurriculum.tsx", import.meta.url), "utf8");
  const free = readFileSync(new URL("../src/components/course/CourseFreeLessons.tsx", import.meta.url), "utf8");
  const purchase = readFileSync(new URL("../src/components/course/CoursePurchasePanel.tsx", import.meta.url), "utf8");
  const copy = readFileSync(new URL("../src/lib/learning/course-sales-copy.ts", import.meta.url), "utf8");
  assert.match(free, /id="aulas-gratuitas"/);
  assert.match(purchase, /id="curso-completo"/);
  assert.match(curriculum, /id="programa"/);
  assert.match(sales, /CourseFreeLessons/);
  assert.match(sales, /CoursePurchasePanel/);
  assert.match(sales, /CourseCurriculum/);
  assert.match(sales, /courseSalesCopy/);
  assert.match(copy, /Três aulas gratuitas/);
  assert.match(copy, /Faça a jornada completa/);
  assert.match(copy, /Começar gratuitamente/);
  assert.equal(copy.includes("page builder estão sendo preparados"), false);
  assert.equal(copy.includes("fora do catálogo"), false);
});
