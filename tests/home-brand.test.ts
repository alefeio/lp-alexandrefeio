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
  assert.match(home, /Curso em destaque/);
  assert.match(home, /Menos conteúdo esquecido/);
  assert.match(home, /Sua jornada fica visível/);
  assert.match(home, /Você pode começar gratuitamente/);
  assert.match(home, /Você escolhe como avançar/);
  assert.match(home, /Explorar os cursos/);
  assert.equal(home.includes("Comece gratuitamente"), false);
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
  assert.match(sales, /id="aulas-gratuitas"/);
  assert.match(sales, /id="curso-completo"/);
  assert.match(sales, /id="programa"/);
  assert.match(sales, /Três aulas gratuitas/);
  assert.match(sales, /Faça a jornada completa/);
});
