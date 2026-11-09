import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_VALUE_LESSON_CATALOG,
  attributeArtifactToPurchase,
  firstValueLessonBySlug,
  firstValueOptionsFromPurchaseLessons,
  selectFirstValueAction,
  type FirstValueArtifact,
  type FirstValueEntitlement,
  type FirstValueProgress,
  type FirstValuePurchase,
  type FirstValueSelectInput,
} from "../src/lib/learning/first-value";
import { TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { SITES_COURSE_SLUG } from "../src/lib/learning/sites-course";

const NOW = new Date("2026-11-09T15:00:00.000Z");
const USER = "user-1";
const OTHER = "user-2";

const PUBLISHED = FIRST_VALUE_LESSON_CATALOG.map((row) => row.lessonSlug);

function purchase(patch: Partial<FirstValuePurchase> & Pick<FirstValuePurchase, "orderId" | "lessonSlugs">): FirstValuePurchase {
  return {
    status: "PAID",
    zeroValueUpgrade: false,
    confirmedAt: NOW,
    createdAt: NOW,
    productType: "LESSON",
    courseSlug: TRAFFIC_COURSE_SLUG,
    ...patch,
  };
}

function input(patch: Partial<FirstValueSelectInput> = {}): FirstValueSelectInput {
  return {
    subjectUserId: USER,
    now: NOW,
    purchases: [],
    entitlements: [],
    progress: [],
    artifacts: [],
    publishedLessonSlugs: PUBLISHED,
    ...patch,
  };
}

function entitlement(lessonSlug: string, status: FirstValueEntitlement["status"] = "ACTIVE"): FirstValueEntitlement {
  return { lessonSlug, status, grantedAt: NOW };
}

function progress(lessonSlug: string, patch: Partial<FirstValueProgress> = {}): FirstValueProgress {
  return {
    lessonSlug,
    startedAt: null,
    completedAt: null,
    lastActiveAt: null,
    percent: 0,
    ...patch,
  };
}

function artifact(lessonSlug: string, patch: Partial<FirstValueArtifact> = {}): FirstValueArtifact {
  return {
    lessonSlug,
    kind: "lesson_result_project",
    userId: USER,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  };
}

test("catálogo cobre 24 aulas com classificação e autoridade", () => {
  assert.equal(FIRST_VALUE_LESSON_CATALOG.length, 24);
  assert.equal(FIRST_VALUE_LESSON_CATALOG.filter((row) => row.courseSlug === TRAFFIC_COURSE_SLUG).length, 12);
  assert.equal(FIRST_VALUE_LESSON_CATALOG.filter((row) => row.courseSlug === SITES_COURSE_SLUG).length, 12);
  const brief = firstValueLessonBySlug("objetivo-oferta-orcamento");
  assert.equal(brief?.toolKey, "CAMPAIGN_BRIEF_V1");
  assert.equal(brief?.eligibility, "verified_artifact");
  const sitesBrief = firstValueLessonBySlug("oferta-publico-acao-principal");
  assert.equal(sitesBrief?.authority, "LandingPageProject");
  assert.equal(firstValueLessonBySlug("negocio-pronto-para-anunciar")?.eligibility, "requires_dependency");
  assert.equal(firstValueLessonBySlug("leia-os-numeros")?.dependency, "campaign_import");
  const derived = firstValueOptionsFromPurchaseLessons(["objetivo-oferta-orcamento", "destino-e-mensuracao", "objetivo-oferta-orcamento"]);
  assert.deepEqual(
    derived.map((row) => row.lessonSlug),
    ["objetivo-oferta-orcamento", "destino-e-mensuracao"],
  );
});

test("compra pendente não libera conteúdo pago", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", status: "PENDING_PAYMENT", confirmedAt: null, lessonSlugs: ["objetivo-oferta-orcamento"] })],
    }),
  );
  assert.equal(result.state, "payment_pending");
  assert.equal(result.cta?.href, "/app/compras/o1");
  assert.equal(result.activity, null);
});

test("compra aprovada com entitlement ACTIVE recomenda ready_to_start no brief", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.state, "ready_to_start");
  assert.equal(result.activity?.lessonSlug, "objetivo-oferta-orcamento");
  assert.equal(result.cta?.href, "/aulas/objetivo-oferta-orcamento");
  assert.equal(result.fallback, false);
});

test("compra aprovada com entitlement pendente", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [],
    }),
  );
  assert.equal(result.state, "access_pending");
});

test("upgrade de valor zero válido libera como compra confirmada", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o-zero",
          zeroValueUpgrade: true,
          lessonSlugs: ["objetivo-oferta-orcamento"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.state, "ready_to_start");
  assert.equal(result.product.zeroValueUpgrade, true);
});

test("aula individual adquirida nunca aponta outra aula paga", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o1",
          productType: "LESSON",
          lessonSlugs: ["objetivo-oferta-orcamento"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento"), entitlement("destino-e-mensuracao")],
      progress: [progress("destino-e-mensuracao", { startedAt: NOW, percent: 40, lastActiveAt: NOW })],
    }),
  );
  assert.equal(result.activity?.lessonSlug, "objetivo-oferta-orcamento");
  assert.notEqual(result.activity?.lessonSlug, "destino-e-mensuracao");
});

test("módulo adquirido prioriza brief de valor concreto", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o-mod",
          productType: "MODULE",
          lessonSlugs: ["destino-e-mensuracao", "objetivo-oferta-orcamento"],
        }),
      ],
      entitlements: [entitlement("destino-e-mensuracao"), entitlement("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.activity?.lessonSlug, "objetivo-oferta-orcamento");
});

test("curso completo Sites prioriza brief de conversão pago", () => {
  const sitesPaid = FIRST_VALUE_LESSON_CATALOG.filter((row) => row.courseSlug === SITES_COURSE_SLUG).map((row) => row.lessonSlug);
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o-sites",
          productType: "COURSE",
          courseSlug: SITES_COURSE_SLUG,
          lessonSlugs: sitesPaid,
        }),
      ],
      entitlements: sitesPaid.filter((slug) => firstValueLessonBySlug(slug)?.accessType === "PAID").map((slug) => entitlement(slug)),
    }),
  );
  assert.equal(result.activity?.lessonSlug, "oferta-publico-acao-principal");
});

test("aluno que começou antes de comprar continua in_progress", () => {
  const earlier = new Date(NOW.getTime() - 86_400_000);
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      progress: [progress("objetivo-oferta-orcamento", { startedAt: earlier, percent: 35, lastActiveAt: earlier })],
    }),
  );
  assert.equal(result.state, "in_progress");
  assert.equal(result.cta?.label, "Continuar aula");
});

test("duas compras: progresso em andamento vence compra mais recente ociosa", () => {
  const older = new Date(NOW.getTime() - 3_600_000);
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o-new",
          confirmedAt: NOW,
          courseSlug: SITES_COURSE_SLUG,
          lessonSlugs: ["oferta-publico-acao-principal"],
        }),
        purchase({
          orderId: "o-old",
          confirmedAt: older,
          lessonSlugs: ["objetivo-oferta-orcamento"],
        }),
      ],
      entitlements: [entitlement("oferta-publico-acao-principal"), entitlement("objetivo-oferta-orcamento")],
      progress: [progress("objetivo-oferta-orcamento", { startedAt: older, percent: 50, lastActiveAt: NOW })],
    }),
  );
  assert.equal(result.product.orderId, "o-old");
  assert.equal(result.state, "in_progress");
});

test("duas atividades em andamento: lastActiveAt mais recente", () => {
  const earlier = new Date(NOW.getTime() - 60_000);
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o1",
          productType: "MODULE",
          lessonSlugs: ["objetivo-oferta-orcamento", "destino-e-mensuracao"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento"), entitlement("destino-e-mensuracao")],
      progress: [
        progress("objetivo-oferta-orcamento", { startedAt: earlier, percent: 20, lastActiveAt: earlier }),
        progress("destino-e-mensuracao", { startedAt: NOW, percent: 10, lastActiveAt: NOW }),
      ],
    }),
  );
  assert.equal(result.activity?.lessonSlug, "destino-e-mensuracao");
});

test("resultado salvo antes da compra não é atribuído à compra", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: before, updatedAt: before })],
    }),
  );
  assert.equal(result.existingResult?.attribution, "before_purchase");
  assert.equal(result.state, "continuation");
  assert.match(result.reason, /preexistente/i);
});

test("resultado salvo depois da compra marca first_value_achieved", () => {
  const after = new Date(NOW.getTime() + 60_000);
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: after, updatedAt: after })],
      progress: [progress("objetivo-oferta-orcamento", { startedAt: NOW, completedAt: after, percent: 100 })],
    }),
  );
  assert.equal(result.state, "first_value_achieved");
  assert.equal(result.existingResult?.attribution, "after_purchase");
});

test("resultado preexistente editado após a compra", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const edited = new Date(NOW.getTime() + 60_000);
  assert.equal(
    attributeArtifactToPurchase(
      { userId: USER, createdAt: before, updatedAt: edited },
      { subjectUserId: USER, purchaseConfirmedAt: NOW },
    ),
    "preexisting_edited",
  );
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: before, updatedAt: edited })],
    }),
  );
  assert.equal(result.existingResult?.attribution, "preexisting_edited");
  assert.equal(result.state, "continuation");
});

test("aula concluída sem resultado não inventa conquista", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      progress: [progress("objetivo-oferta-orcamento", { startedAt: NOW, completedAt: NOW, percent: 100 })],
      artifacts: [],
    }),
  );
  assert.notEqual(result.state, "first_value_achieved");
  assert.equal(result.existingResult, null);
});

test("ferramenta com dependência de import permanece requires_dependency na classificação", () => {
  assert.equal(firstValueLessonBySlug("leia-os-numeros")?.eligibility, "requires_dependency");
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["leia-os-numeros"] })],
      entitlements: [entitlement("leia-os-numeros")],
    }),
  );
  assert.equal(result.state, "ready_to_start");
  assert.match(result.reason, /dependência/);
});

test("conteúdo gratuito acessível sem entitlement, sem fingir compra paga", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o-free-path",
          productType: "COURSE",
          lessonSlugs: ["como-funciona-o-trafego-pago", "objetivo-oferta-orcamento"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.activity?.lessonSlug, "objetivo-oferta-orcamento");
  assert.equal(result.product.zeroValueUpgrade, false);
});

test("acesso revogado", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento", "REVOKED")],
    }),
  );
  assert.equal(result.state, "access_unavailable");
});

test("curso ou aula indisponível (não publicada)", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      publishedLessonSlugs: [],
    }),
  );
  assert.equal(result.state, "access_unavailable");
  assert.match(result.reason, /indisponível|publicação/i);
});

test("usuário sem projeto ainda pode receber ready_to_start no brief (dependência na execução da tool)", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.state, "ready_to_start");
  assert.equal(result.activity?.eligibility, "verified_artifact");
});

test("resultado de outro usuário é ignorado", () => {
  assert.equal(
    attributeArtifactToPurchase(
      { userId: OTHER, createdAt: NOW, updatedAt: NOW },
      { subjectUserId: USER, purchaseConfirmedAt: NOW },
    ),
    "other_user",
  );
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento", { userId: OTHER })],
    }),
  );
  assert.equal(result.state, "ready_to_start");
  assert.equal(result.existingResult, null);
});

test("ordenação e desempate determinísticos entre compras ociosas", () => {
  const older = new Date(NOW.getTime() - 10_000);
  const a = selectFirstValueAction(
    input({
      purchases: [
        purchase({ orderId: "o-b", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] }),
        purchase({ orderId: "o-a", confirmedAt: older, courseSlug: SITES_COURSE_SLUG, lessonSlugs: ["oferta-publico-acao-principal"] }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento"), entitlement("oferta-publico-acao-principal")],
    }),
  );
  const b = selectFirstValueAction(
    input({
      purchases: [
        purchase({ orderId: "o-a", confirmedAt: older, courseSlug: SITES_COURSE_SLUG, lessonSlugs: ["oferta-publico-acao-principal"] }),
        purchase({ orderId: "o-b", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento"), entitlement("oferta-publico-acao-principal")],
    }),
  );
  assert.equal(a.product.orderId, "o-b");
  assert.equal(b.product.orderId, "o-b");
  assert.deepEqual(a, b);
});

test("nunca recomenda conteúdo pago inacessível", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o1",
          productType: "MODULE",
          lessonSlugs: ["objetivo-oferta-orcamento", "destino-e-mensuracao"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.activity?.lessonSlug, "objetivo-oferta-orcamento");
  assert.notEqual(result.activity?.lessonSlug, "destino-e-mensuracao");
});

test("first_value_achieved com próxima aula vira next_evolution", () => {
  const after = new Date(NOW.getTime() + 1_000);
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o1",
          productType: "MODULE",
          lessonSlugs: ["objetivo-oferta-orcamento", "destino-e-mensuracao"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento"), entitlement("destino-e-mensuracao")],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: after, updatedAt: after })],
      progress: [progress("objetivo-oferta-orcamento", { startedAt: NOW, completedAt: after, percent: 100 })],
    }),
  );
  assert.equal(result.state, "next_evolution");
  assert.equal(result.activity?.lessonSlug, "destino-e-mensuracao");
});

test("saída do contrato é consumível pelo dashboard futuro sem PII", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
    }),
  );
  const json = JSON.stringify(result);
  assert.equal(json.includes("@"), false);
  assert.equal(json.includes("password"), false);
  assert.ok(result.state);
  assert.ok(result.reason);
  assert.ok(result.cta?.href.startsWith("/"));
});
