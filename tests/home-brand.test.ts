import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { navigation, footerNavigation } from "../src/data/navigation";
import { publicHomeCopy, publicHomeMetadata } from "../src/lib/home/public-home";

test("home posiciona a marca e aponta CTAs para cursos e gestão", () => {
  assert.match(publicHomeCopy.hero, /Tecnologia, marketing e estratégia/);
  assert.equal(publicHomeCopy.hero.includes("tráfego pago aplicando"), false);
  assert.equal(publicHomeCopy.primaryCta, "Conhecer os cursos");
  assert.equal(publicHomeCopy.secondaryCta, "Quero atrair mais clientes");
  assert.match(publicHomeMetadata.title, /Cursos/);
  assert.match(publicHomeMetadata.description, /Alexandre Feio/);

  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  assert.match(home, /href="\/cursos"/);
  assert.match(home, /Curso em destaque/);
  assert.match(home, /Comece gratuitamente/);
  assert.match(home, /Porta de entrada do curso de Tráfego Pago/);
  assert.match(home, /Planeje/);
  assert.match(home, /Aplique/);
  assert.match(home, /Meça/);
  assert.match(home, /Conhecer a gestão/);
  assert.equal(home.includes("Meu primeiro mapa de tráfego"), false);
  assert.equal(home.includes("O que você constrói"), false);
});

test("nav e footer usam Cursos no plural", () => {
  assert.equal(navigation.find((item) => item.label === "Cursos")?.href, "/cursos");
  assert.equal(footerNavigation.find((item) => item.label === "Cursos")?.href, "/cursos");
  assert.equal(navigation.some((item) => item.label === "Curso"), false);
  assert.equal(footerNavigation.some((item) => item.label === "Curso"), false);
  assert.equal(navigation.find((item) => item.label === "Aulas gratuitas")?.href, "/#comece-gratis");
});
