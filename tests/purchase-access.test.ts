import assert from "node:assert/strict";
import test from "node:test";
import { purchasedLessonPath } from "../src/lib/commerce/purchase-cta";
import { paidLessonAction } from "../src/lib/commerce/sale-action";
import { lessonsAvailableToStudy } from "../src/lib/learning/available-study";

const aula4 = {
  lessonId: "lesson-4",
  slug: "objetivo-oferta-orcamento",
  title: "Defina objetivo, oferta e orçamento",
  status: "ACTIVE",
};

test("aula comprada sem progresso aparece como disponível", () => {
  const available = lessonsAvailableToStudy([aula4], []);
  assert.deepEqual(available, [
    { lessonId: aula4.lessonId, slug: aula4.slug, title: aula4.title },
  ]);
});

test("aula iniciada sai da seção disponível", () => {
  assert.deepEqual(lessonsAvailableToStudy([aula4], [aula4.lessonId]), []);
});

test("entitlement revogado não aparece como disponível", () => {
  assert.deepEqual(lessonsAvailableToStudy([{ ...aula4, status: "REVOKED" }], []), []);
});

test("pedido unitário de aula aponta para a lesson", () => {
  assert.equal(
    purchasedLessonPath([{ productType: "LESSON", lessonSlug: "objetivo-oferta-orcamento" }]),
    "/aulas/objetivo-oferta-orcamento",
  );
});

test("quem já tem a aula vê acesso e quem não tem vê compra", () => {
  assert.equal(paidLessonAction({ open: true, owned: true }), "access");
  assert.equal(paidLessonAction({ open: true, owned: false }), "buy");
  assert.equal(paidLessonAction({ open: false, owned: false }), "soon");
});

test("pedido de módulo ou curso não assume uma lesson única", () => {
  assert.equal(purchasedLessonPath([{ productType: "MODULE", lessonSlug: "objetivo-oferta-orcamento" }]), null);
  assert.equal(purchasedLessonPath([{ productType: "COURSE", lessonSlug: null }]), null);
  assert.equal(
    purchasedLessonPath([
      { productType: "LESSON", lessonSlug: "objetivo-oferta-orcamento" },
      { productType: "LESSON", lessonSlug: "destino-e-mensuracao" },
    ]),
    null,
  );
});
