import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { firstCourseSeed } from "../src/lib/learning/first-course";
import { sitesCourseLessons } from "../src/lib/learning/sites-course";

const notFound = readFileSync(new URL("../src/app/not-found.tsx", import.meta.url), "utf8");
const banner = readFileSync(new URL("../src/components/consent/ConsentBanner.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("a página 404 oferece saída sem expor detalhe interno", () => {
  assert.match(notFound, /Página não encontrada/);
  assert.match(notFound, /href="\/"/);
  assert.match(notFound, /href="\/cursos"/);
  assert.doesNotMatch(notFound, /error\.stack|digest|process\.env/);
});

test("o banner de cookies reserva espaço para o conteúdo não ficar coberto", () => {
  assert.match(banner, /--consent-banner-offset/);
  assert.match(banner, /ResizeObserver/);
  assert.match(css, /padding-bottom:\s*var\(--consent-banner-offset,\s*0px\)/);
});

test("o catálogo público tem exatamente seis aulas gratuitas", () => {
  const traffic = firstCourseSeed.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.accessType === "FREE");
  const sites = sitesCourseLessons().filter((lesson) => lesson.accessType === "FREE");
  assert.deepEqual(
    [...traffic, ...sites].map((lesson) => lesson.slug),
    [
      "como-funciona-o-trafego-pago",
      "google-ads-ou-meta-ads",
      "negocio-pronto-para-anunciar",
      "site-ajuda-a-vender",
      "site-landing-page-ou-whatsapp",
      "pagina-pronta-para-converter",
    ],
  );
});
