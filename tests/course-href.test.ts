import assert from "node:assert/strict";
import test from "node:test";
import { courseHref } from "../src/lib/learning/course-href";

test("visitante usa a URL pública do curso", () => {
  assert.equal(courseHref("trafego-pago", false), "/cursos/trafego-pago");
});

test("autenticado usa o hub interno do curso", () => {
  assert.equal(courseHref("trafego-pago", true), "/app/cursos/trafego-pago");
});
