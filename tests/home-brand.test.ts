import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { navigation, footerNavigation } from "../src/data/navigation";
import { publicHomeCopy, publicHomeMetadata } from "../src/lib/home/public-home";

test("home posiciona a plataforma e não a landing de um único curso", () => {
  assert.equal(publicHomeCopy.hero, "Aprenda. Aplique. Faça seu negócio avançar.");
  assert.equal(publicHomeCopy.primaryCta, "Explorar os cursos");
  assert.equal(publicHomeCopy.secondaryCta, "Prefiro contratar a gestão");
  assert.match(publicHomeMetadata.title, /Cursos práticos/);
  assert.match(publicHomeMetadata.description, /Alexandre Feio/);

  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  assert.match(home, /href="\/cursos"/);
  assert.match(home, /Conhecimento sem aplicação não muda o negócio/);
  assert.match(home, /Você não termina uma aula só com anotações/);
  assert.match(home, /Uma plataforma feita para colocar conhecimento em prática/);
  assert.match(home, /Escolha onde você quer avançar/);
  assert.match(home, /md:grid-cols-2/);
  assert.match(home, /Conhecer o curso/);
  assert.match(home, /freeLessonCount/);
  assert.match(home, /Menos conteúdo esquecido/);
  assert.match(home, /Sua jornada fica visível/);
  assert.match(home, /Você pode começar gratuitamente/);
  assert.match(home, /Você escolhe como avançar/);
  assert.match(home, /Explorar os cursos/);
  assert.equal(home.includes("Porta de entrada do curso de Tráfego Pago"), false);
  assert.equal(home.includes("Meu primeiro mapa de tráfego"), false);
  assert.equal(home.includes('id="comece-gratis"'), false);
  assert.equal(home.includes("freeLessons.map"), false);
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
