import assert from "node:assert/strict";
import test from "node:test";
import { lessonStepNav, lessonStepNavClass } from "../src/lib/learning/lesson-nav";

const previous = { slug: "como-funciona-o-trafego-pago", title: "Como funciona o tráfego pago e quando ele faz sentido" };
const next = { slug: "google-ads-ou-meta-ads", title: "Google Ads ou Meta Ads: qual escolher?" };
const paidPreview = { slug: "diagnostico-de-prontidao", title: "Diagnóstico de prontidão para tráfego" };

test("aula com anterior e próxima destaca só o avanço", () => {
  const nav = lessonStepNav({ previous, next });
  assert.equal(nav.previous?.variant, "secondary");
  assert.equal(nav.previous?.kicker, "Aula anterior");
  assert.equal(nav.previous?.href, "/aulas/como-funciona-o-trafego-pago");
  assert.equal(nav.next?.variant, "primary");
  assert.equal(nav.next?.kicker, "Próxima aula");
  assert.equal(nav.next?.title, next.title);
  assert.equal(nav.next?.href, "/aulas/google-ads-ou-meta-ads");
  assert.deepEqual(nav.desktopOrder, ["previous", "next"]);
  assert.deepEqual(nav.mobileOrder, ["next", "previous"]);
  assert.match(lessonStepNavClass.previous, /order-2/);
  assert.match(lessonStepNavClass.previous, /sm:order-1/);
  assert.match(lessonStepNavClass.next, /order-1/);
  assert.match(lessonStepNavClass.next, /sm:order-2/);
  assert.match(lessonStepNavClass.next, /w-full/);
  assert.match(lessonStepNavClass.next, /min-w-0/);
  assert.match(lessonStepNavClass.previous, /max-w-full/);
});

test("primeira aula não mostra anterior", () => {
  const nav = lessonStepNav({ previous: null, next });
  assert.equal(nav.previous, null);
  assert.equal(nav.next?.variant, "primary");
});

test("última aula publicada disponível não mostra próxima", () => {
  const nav = lessonStepNav({ previous, next: null });
  assert.equal(nav.next, null);
  assert.equal(nav.previous?.variant, "secondary");
});

test("próxima paga com preview continua no caminho da aula e aula sem destino não gera link", () => {
  const preview = lessonStepNav({ previous, next: paidPreview });
  assert.equal(preview.next?.href, "/aulas/diagnostico-de-prontidao");
  assert.equal(preview.next?.variant, "primary");
  const hidden = lessonStepNav({ previous, next: null });
  assert.equal(hidden.next, null);
});
