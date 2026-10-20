import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildHomeContinuation,
  homeContinuationHasPrivateKeys,
  type ContinuationLesson,
} from "../src/lib/home/home-continuation";
import { homeAudience, homeBelongsToViewer, publicHomeCopy, publicHomeMetadata, studentHomeRendering } from "../src/lib/home/public-home";

function lessons(patch: Partial<ContinuationLesson>[] = []): ContinuationLesson[] {
  const base: ContinuationLesson[] = [
    { slug: "como-funciona-o-trafego-pago", title: "Como funciona", number: 1, accessible: true, completed: false, inProgress: false, percent: 0 },
    { slug: "google-ads-ou-meta-ads", title: "Canal", number: 2, accessible: true, completed: false, inProgress: false, percent: 0 },
    { slug: "negocio-pronto-para-anunciar", title: "Diagnóstico", number: 3, accessible: true, completed: false, inProgress: false, percent: 0 },
    { slug: "objetivo-oferta-orcamento", title: "Brief", number: 4, accessible: false, completed: false, inProgress: false, percent: 0 },
  ];
  return base.map((lesson, index) => ({ ...lesson, ...(patch[index] ?? {}) }));
}

test("anônimo permanece na home pública e a metadata não muda", () => {
  assert.equal(homeAudience(false), "anonymous");
  assert.equal(publicHomeCopy.hero, "Tecnologia, marketing e estratégia para fazer seu negócio avançar.");
  assert.equal(publicHomeMetadata.canonical, "/");
  assert.equal(studentHomeRendering.dynamic, "force-dynamic");
  const page = readFileSync(new URL("../src/app/(public)/page.tsx", import.meta.url), "utf8");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /CourseHome/);
  assert.match(page, /HomeContinuation/);
  assert.equal(page.includes("StudentHome"), false);
  assert.equal(page.includes("student_home_view"), false);
});

test("autenticado preserva a base pública e recebe bloco de continuidade", () => {
  assert.equal(homeAudience(true), "student");
  const home = readFileSync(new URL("../src/components/home/CourseHome.tsx", import.meta.url), "utf8");
  assert.match(home, /continuation/);
  assert.match(home, /publicHomeCopy\.hero/);
  const card = buildHomeContinuation({ userId: "user-a", name: "Alexandre Feio", lessons: lessons() });
  assert.equal(card.userId, "user-a");
  assert.equal(homeBelongsToViewer(card.userId, "user-a"), true);
  assert.equal(homeBelongsToViewer(card.userId, "user-b"), false);
  assert.equal(homeContinuationHasPrivateKeys(card), false);
  assert.equal(card.ctaHref, "/app");
});

test("usuário sem progresso começa a jornada", () => {
  const card = buildHomeContinuation({ userId: "user-a", name: "Alexandre", lessons: lessons() });
  assert.equal(card.kind, "start");
  assert.match(card.greeting, /Olá, Alexandre/);
  assert.match(card.line, /jornada começa/);
  assert.equal(card.progress, null);
  assert.equal(card.ctaLabel, "Começar minha jornada");
  assert.equal(card.ctaHref, "/app");
});

test("aula em andamento mostra etapa e progresso resumido", () => {
  const rows = lessons();
  rows[0] = { ...rows[0], completed: true };
  rows[1] = { ...rows[1], completed: true };
  rows[2] = { ...rows[2], inProgress: true, percent: 64 };
  const card = buildHomeContinuation({ userId: "user-a", name: "Alexandre", lessons: rows });
  assert.equal(card.kind, "resume");
  assert.match(card.line, /Entender/);
  assert.equal(card.progress, "Aula 3 · 64% concluída");
  assert.equal(card.ctaLabel, "Continuar minha jornada");
  assert.equal(card.ctaHref, "/app");
});

test("curso concluído aponta para o dashboard", () => {
  const card = buildHomeContinuation({
    userId: "user-a",
    name: "Alexandre",
    lessons: lessons().map((lesson) =>
      lesson.accessible ? { ...lesson, completed: true, inProgress: false, percent: 100 } : lesson,
    ),
  });
  assert.equal(card.kind, "completed");
  assert.match(card.line, /Curso concluído/);
  assert.match(card.progress ?? "", /Plano Vivo/);
  assert.equal(card.ctaHref, "/app");
});

test("SEO público não inclui dados pessoais do bloco autenticado", () => {
  assert.equal(publicHomeMetadata.canonical, "/");
  assert.equal(publicHomeMetadata.title.includes("Alexandre Feio"), false);
  const card = buildHomeContinuation({ userId: "user-a", name: "Alexandre", lessons: lessons() });
  assert.equal(JSON.stringify(publicHomeMetadata).includes(card.greeting), false);
  assert.equal(JSON.stringify(publicHomeMetadata).includes(card.userId), false);
});
