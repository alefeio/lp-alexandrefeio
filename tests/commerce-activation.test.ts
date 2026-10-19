import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";
import { commercePatch, commerceStatusForCreate, commerceStatusMatches } from "../src/lib/learning/catalog-commerce";
import { FIRST_COURSE_SLUG } from "../src/lib/learning/first-course";
import { LESSON_04_SLUG } from "../src/lib/learning/lesson-04";
import { LESSON_05_SLUG } from "../src/lib/learning/lesson-05";
import { LESSON_06_SLUG } from "../src/lib/learning/lesson-06";
import { LESSON_07_SLUG } from "../src/lib/learning/lesson-07";
import { LESSON_08_SLUG } from "../src/lib/learning/lesson-08";
import { LESSON_09_SLUG } from "../src/lib/learning/lesson-09";
import { LESSON_10_SLUG } from "../src/lib/learning/lesson-10";
import { commerceWriteGate, planCourseEnable, planLessonEnable, planModuleEnable, type LessonShape } from "../src/lib/commerce/product-activation";

loadEnv({ path: ".env.local" });

const developmentEnv = { DATABASE_ENV: "development", COMMERCE_CATALOG_CONFIRM: "shared" };

function readyLesson(overrides: Partial<LessonShape> = {}): LessonShape {
  return {
    slug: LESSON_04_SLUG,
    title: "Defina objetivo, oferta e orçamento",
    status: "PUBLISHED",
    accessType: "PAID",
    priceCents: 2990,
    commerceStatus: "NOT_FOR_SALE",
    publicPreview: "Amostra pública da aula.",
    contentReady: true,
    contentIssues: [],
    hasPublicPreviewBlocks: true,
    ...overrides,
  };
}

test("catálogo novo nasce fora de venda e o existente preserva o status", () => {
  assert.equal(commerceStatusForCreate(), "NOT_FOR_SALE");
  assert.deepEqual(commercePatch(true), {});
  assert.deepEqual(commercePatch(false), { commerceStatus: "NOT_FOR_SALE" });
  assert.equal(commerceStatusMatches("NOT_FOR_SALE", true), true);
  assert.equal(commerceStatusMatches("AVAILABLE", true), true);
  assert.equal(commerceStatusMatches("AVAILABLE", false), false);
  assert.equal(commerceStatusMatches("NOT_FOR_SALE", false), true);
});

test("dry-run e confirmação comercial não gravam sem a flag", () => {
  assert.equal(commerceWriteGate({ DATABASE_ENV: "production" }, true).ok, false);
  assert.equal(commerceWriteGate({ DATABASE_ENV: "production", COMMERCE_CATALOG_CONFIRM: "production" }, true).ok, true);
  assert.equal(commerceWriteGate({ DATABASE_ENV: "production", VERCEL_ENV: "production", COMMERCE_CATALOG_CONFIRM: "production" }, true).ok, false);
  assert.equal(commerceWriteGate(developmentEnv, false).write, false);
  assert.equal(commerceWriteGate({ DATABASE_ENV: "development" }, true).ok, false);
  assert.equal(commerceWriteGate(developmentEnv, true).write, true);
});

test("aula incompleta, aula fora da allowlist e curso completo não ativam", () => {
  const incomplete = planLessonEnable(readyLesson({ contentReady: false, contentIssues: ["Falta a conclusão."] }));
  assert.equal(incomplete.allowed, false);
  const future = planLessonEnable(readyLesson({ slug: "leia-os-numeros", priceCents: 3490 }));
  assert.equal(future.allowed, false);
  assert.match(future.reason ?? "", /pronta/);
  const outside = planLessonEnable(readyLesson({ slug: "fora-da-fase", priceCents: 3990 }));
  assert.equal(outside.allowed, false);
  assert.match(outside.reason ?? "", /allowlist/);
  const course = planCourseEnable({
    slug: FIRST_COURSE_SLUG,
    title: "Curso",
    priceCents: 24990,
    commerceStatus: "NOT_FOR_SALE",
  });
  assert.equal(course.allowed, false);
  assert.match(course.reason ?? "", /bloqueado/);
  const moduleBlocked = planModuleEnable({
    slug: "google-ads-na-pratica",
    title: "Google",
    priceCents: 10390,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [],
  });
  assert.equal(moduleBlocked.allowed, false);
  assert.match(moduleBlocked.reason ?? "", /não está neste módulo/);
  const metaEarly = planModuleEnable({
    slug: "meta-ads-na-pratica",
    title: "Meta",
    priceCents: 7190,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [],
  });
  assert.equal(metaEarly.allowed, false);
  assert.match(metaEarly.reason ?? "", /não está neste módulo/);
  const finalModule = planModuleEnable({
    slug: "entenda-e-melhore",
    title: "Entenda",
    priceCents: 6790,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [],
  });
  assert.equal(finalModule.allowed, false);
  assert.match(finalModule.reason ?? "", /editorialmente completo/);
});

test("aula válida e módulo exigem a allowlist e as aulas componentes", () => {
  const lesson = planLessonEnable(readyLesson());
  assert.equal(lesson.allowed, true);
  assert.equal(lesson.intended, "AVAILABLE");
  const early = planModuleEnable({
    slug: "planeje-antes-de-anunciar",
    title: "Planeje",
    priceCents: 5790,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [
      { slug: LESSON_04_SLUG, title: "Aula 4", commerceStatus: "NOT_FOR_SALE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_05_SLUG, title: "Aula 5", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
    ],
  });
  assert.equal(early.allowed, false);
  const ready = planModuleEnable({
    slug: "planeje-antes-de-anunciar",
    title: "Planeje",
    priceCents: 5790,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [
      { slug: LESSON_04_SLUG, title: "Aula 4", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_05_SLUG, title: "Aula 5", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
    ],
  });
  assert.equal(ready.allowed, true);
  const lessonSeven = planLessonEnable(readyLesson({ slug: LESSON_07_SLUG, priceCents: 3990 }));
  const lessonEight = planLessonEnable(readyLesson({ slug: LESSON_08_SLUG, priceCents: 3490 }));
  assert.equal(lessonSeven.allowed, true);
  assert.equal(lessonEight.allowed, true);
  const wrongPrice = planLessonEnable(readyLesson({ slug: LESSON_08_SLUG, priceCents: 3990 }));
  assert.equal(wrongPrice.allowed, false);
  const googleEarly = planModuleEnable({
    slug: "google-ads-na-pratica",
    title: "Google",
    priceCents: 10390,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [
      { slug: LESSON_06_SLUG, title: "Aula 6", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_07_SLUG, title: "Aula 7", commerceStatus: "NOT_FOR_SALE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_08_SLUG, title: "Aula 8", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
    ],
  });
  assert.equal(googleEarly.allowed, false);
  const google = planModuleEnable({
    slug: "google-ads-na-pratica",
    title: "Google",
    priceCents: 10390,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [
      { slug: LESSON_06_SLUG, title: "Aula 6", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_07_SLUG, title: "Aula 7", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_08_SLUG, title: "Aula 8", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
    ],
  });
  assert.equal(google.allowed, true);
  assert.equal(google.priceCents, 10390);
  const lessonNine = planLessonEnable(readyLesson({ slug: LESSON_09_SLUG, priceCents: 3990 }));
  const lessonTen = planLessonEnable(readyLesson({ slug: LESSON_10_SLUG, priceCents: 3990 }));
  assert.equal(lessonNine.allowed, true);
  assert.equal(lessonTen.allowed, true);
  const metaBeforeLessons = planModuleEnable({
    slug: "meta-ads-na-pratica",
    title: "Meta",
    priceCents: 7190,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [
      { slug: LESSON_09_SLUG, title: "Aula 9", commerceStatus: "NOT_FOR_SALE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_10_SLUG, title: "Aula 10", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
    ],
  });
  assert.equal(metaBeforeLessons.allowed, false);
  const meta = planModuleEnable({
    slug: "meta-ads-na-pratica",
    title: "Meta",
    priceCents: 7190,
    commerceStatus: "NOT_FOR_SALE",
    status: "PUBLISHED",
    lessons: [
      { slug: LESSON_09_SLUG, title: "Aula 9", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
      { slug: LESSON_10_SLUG, title: "Aula 10", commerceStatus: "AVAILABLE", ready: true, status: "PUBLISHED", accessType: "PAID" },
    ],
  });
  assert.equal(meta.allowed, true);
  assert.equal(meta.priceCents, 7190);
});

