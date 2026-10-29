import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buttonClass, navigationLinkClass } from "../src/lib/button-styles";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("primary e navegação não compartilham o mesmo peso visual", () => {
  const primary = buttonClass("primary");
  const secondary = buttonClass("secondary");
  const navigation = navigationLinkClass();
  assert.match(primary, /bg-cta/);
  assert.match(primary, /min-h-12/);
  assert.match(secondary, /border-border/);
  assert.equal(navigation.includes("bg-cta"), false);
  assert.match(navigation, /underline/);
  assert.match(navigationLinkClass("on-ink"), /text-on-ink/);
});

test("a home e o tráfego pago têm uma ação principal e a alternativa vira navegação", () => {
  const hero = source("src/components/home/HomeHero.tsx");
  const traffic = source("src/components/trafego-pago/TrafegoPagoLanding.tsx");
  const catalog = source("src/components/course/CourseCatalog.tsx");
  assert.match(hero, /buttonClass\("primary"/);
  assert.match(hero, /navigationLinkClass\("on-ink"\)/);
  assert.equal(hero.includes('buttonClass("secondary"'), false);
  assert.match(traffic, /Quero falar sobre meu projeto/);
  assert.match(traffic, /service_interest/);
  assert.match(traffic, /navigationLinkClass\("on-ink"\)/);
  assert.match(traffic, /cta_name: "trafego_como_funciona"/);
  assert.match(catalog, /buttonClass\("primary"\)/);
  assert.match(catalog, /Conhecer \$\{name\}/);
  assert.equal(catalog.includes('buttonClass(started ? "primary" : "secondary")'), false);
});

test("curso, aula gratuita e paywall separam compra, continuidade e navegação", () => {
  const courseHero = source("src/components/course/CourseHero.tsx");
  const freeLessons = source("src/components/course/CourseFreeLessons.tsx");
  const paywall = source("src/components/learning/LessonPaywall.tsx");
  const cart = source("src/components/commerce/CartScreen.tsx");
  const checkout = source("src/components/commerce/CheckoutScreen.tsx");
  assert.match(courseHero, /event="course_free_start"/);
  assert.match(courseHero, /buttonClass\("primary"\)/);
  assert.match(courseHero, /navigationLinkClass\("on-ink"\)/);
  assert.match(courseHero, /Continuar curso/);
  assert.match(freeLessons, /Começar aula gratuita/);
  assert.match(freeLessons, /event="course_free_start"/);
  assert.match(paywall, /Comprar esta aula/);
  assert.match(paywall, /variant=\{lessonForSale \? "secondary" : "primary"\}/);
  assert.match(paywall, /appearance=\{lessonForSale && moduleForSale \? "text" : "button"\}/);
  assert.match(paywall, /navigationLinkClass\(\)/);
  assert.match(paywall, /lesson_paywall_view/);
  assert.match(cart, /Continuar para pagamento/);
  assert.match(cart, /href="\/app\/checkout"/);
  assert.match(checkout, /Próximo passo: pagar/);
  assert.match(checkout, /checkout_started/);
  const lessonPage = source("src/app/(learn)/aulas/[slug]/page.tsx");
  assert.match(lessonPage, /tone="text"/);
  assert.match(lessonPage, /Começar aula gratuita|Ver a formação/);
  assert.match(lessonPage, /lesson_started|course_free_start|lesson_public_preview_view/);
});
