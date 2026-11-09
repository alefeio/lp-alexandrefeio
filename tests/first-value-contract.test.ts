import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_VALUE_LESSON_CATALOG,
  attributeArtifactToPurchase,
  buildFirstValueArtifact,
  firstValueLessonBySlug,
  firstValueOptionsFromPurchaseLessons,
  isVerifiedAchievementKind,
  pickOwnedArtifact,
  selectFirstValueAction,
  type FirstValueArtifact,
  type FirstValueEntitlement,
  type FirstValueProgress,
  type FirstValuePurchase,
  type FirstValueSelectInput,
} from "../src/lib/learning/first-value";
import { TRAFFIC_COURSE_SLUG } from "../src/lib/learning/course-experience";
import { SITES_COURSE_SLUG, sitesCourseLessons } from "../src/lib/learning/sites-course";

const NOW = new Date("2026-11-09T15:00:00.000Z");
const USER = "user-1";
const OTHER = "user-2";

const PUBLISHED = FIRST_VALUE_LESSON_CATALOG.map((row) => row.lessonSlug);

/** Correspondência esperada com seeds de acesso do curso de tráfego. */
const TRAFFIC_SEED_ACCESS: ReadonlyArray<{ slug: string; accessType: "FREE" | "PAID" }> = [
  { slug: "como-funciona-o-trafego-pago", accessType: "FREE" },
  { slug: "google-ads-ou-meta-ads", accessType: "FREE" },
  { slug: "negocio-pronto-para-anunciar", accessType: "FREE" },
  { slug: "objetivo-oferta-orcamento", accessType: "PAID" },
  { slug: "destino-e-mensuracao", accessType: "PAID" },
  { slug: "campanha-de-pesquisa", accessType: "PAID" },
  { slug: "palavras-chave-com-intencao", accessType: "PAID" },
  { slug: "anuncios-alinhados-a-conversao", accessType: "PAID" },
  { slug: "objetivo-publico-estrutura", accessType: "PAID" },
  { slug: "campanhas-leads-whatsapp", accessType: "PAID" },
  { slug: "leia-os-numeros", accessType: "PAID" },
  { slug: "o-que-mudar", accessType: "PAID" },
];

function purchase(patch: Partial<FirstValuePurchase> & Pick<FirstValuePurchase, "orderId" | "lessonSlugs">): FirstValuePurchase {
  return {
    status: "PAID",
    zeroValueUpgrade: false,
    confirmedAt: NOW,
    confirmedAtSource: "payment_approved_at",
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
    dependencyAvailability: { project: true, landing_page_project: true, campaign_import: true },
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
  const createdAt = patch.createdAt ?? NOW;
  const updatedAt = patch.updatedAt ?? createdAt;
  const resultAchievedAt = "resultAchievedAt" in patch ? (patch.resultAchievedAt ?? null) : createdAt;
  return {
    lessonSlug,
    kind: "lesson_result_project",
    userId: USER,
    resultSource: "lesson_result_created_at",
    ...patch,
    createdAt,
    updatedAt,
    resultAchievedAt,
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
  assert.equal(sitesBrief?.authority, "LessonResult");
  assert.equal(sitesBrief?.evidenceKind, "lesson_result_personal");
  assert.equal(firstValueLessonBySlug("negocio-pronto-para-anunciar")?.eligibility, "requires_dependency");
  assert.equal(firstValueLessonBySlug("leia-os-numeros")?.dependency, "campaign_import");
  const derived = firstValueOptionsFromPurchaseLessons(["objetivo-oferta-orcamento", "destino-e-mensuracao", "objetivo-oferta-orcamento"]);
  assert.deepEqual(
    derived.map((row) => row.lessonSlug),
    ["objetivo-oferta-orcamento", "destino-e-mensuracao"],
  );
});

test("correspondência integral de slugs e acessos com seeds", () => {
  for (const row of TRAFFIC_SEED_ACCESS) {
    const def = firstValueLessonBySlug(row.slug);
    assert.ok(def, `faltando ${row.slug}`);
    assert.equal(def!.accessType, row.accessType, row.slug);
    assert.equal(def!.courseSlug, TRAFFIC_COURSE_SLUG);
  }
  const sites = sitesCourseLessons();
  assert.equal(sites.length, 12);
  for (const lesson of sites) {
    const def = firstValueLessonBySlug(lesson.slug);
    assert.ok(def, `faltando sites ${lesson.slug}`);
    assert.equal(def!.accessType, lesson.accessType, lesson.slug);
    assert.equal(def!.courseSlug, SITES_COURSE_SLUG);
  }
  assert.equal(
    FIRST_VALUE_LESSON_CATALOG.filter((row) => row.courseSlug === TRAFFIC_COURSE_SLUG).every((row) =>
      TRAFFIC_SEED_ACCESS.some((seed) => seed.slug === row.lessonSlug),
    ),
    true,
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

test("pedido NEEDS_REVIEW não libera acesso nem conquista", () => {
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o-review",
          status: "NEEDS_REVIEW",
          confirmedAt: null,
          confirmedAtSource: null,
          lessonSlugs: ["objetivo-oferta-orcamento"],
        }),
      ],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento")],
    }),
  );
  assert.equal(result.state, "access_unavailable");
  assert.match(result.reason, /NEEDS_REVIEW/);
  assert.notEqual(result.state, "first_value_achieved");
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
          confirmedAtSource: "zero_upgrade_created_at",
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
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: before, updatedAt: before, resultAchievedAt: before })],
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
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: after, updatedAt: after, resultAchievedAt: after })],
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
      { userId: USER, resultAchievedAt: before, updatedAt: edited },
      { subjectUserId: USER, purchaseConfirmedAt: NOW },
    ),
    "preexisting_edited",
  );
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: before, updatedAt: edited, resultAchievedAt: before })],
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

test("landing page criada sem brief não conta como conquista", () => {
  assert.equal(isVerifiedAchievementKind("landing_page_project_shell"), false);
  assert.equal(isVerifiedAchievementKind("landing_page_draft"), false);
  const shell = buildFirstValueArtifact({
    lessonSlug: "oferta-publico-acao-principal",
    kind: "landing_page_project_shell",
    userId: USER,
    resultSource: "unproven",
    resultAchievedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(shell.resultAchievedAt, null);
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o1",
          courseSlug: SITES_COURSE_SLUG,
          lessonSlugs: ["oferta-publico-acao-principal"],
        }),
      ],
      entitlements: [entitlement("oferta-publico-acao-principal")],
      artifacts: [shell],
    }),
  );
  assert.notEqual(result.state, "first_value_achieved");
  assert.equal(result.state, "ready_to_start");
});

test("landing page anterior à compra com brief LessonResult depois marca after_purchase", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const after = new Date(NOW.getTime() + 120_000);
  const result = selectFirstValueAction(
    input({
      purchases: [
        purchase({
          orderId: "o1",
          confirmedAt: NOW,
          courseSlug: SITES_COURSE_SLUG,
          lessonSlugs: ["oferta-publico-acao-principal"],
        }),
      ],
      entitlements: [entitlement("oferta-publico-acao-principal")],
      artifacts: [
        buildFirstValueArtifact({
          id: "shell-old",
          lessonSlug: "oferta-publico-acao-principal",
          kind: "landing_page_project_shell",
          userId: USER,
          resultSource: "unproven",
          resultAchievedAt: null,
          createdAt: before,
          updatedAt: after,
        }),
        artifact("oferta-publico-acao-principal", {
          id: "brief-result",
          kind: "lesson_result_personal",
          createdAt: after,
          updatedAt: after,
          resultAchievedAt: after,
          resultSource: "lesson_result_created_at",
        }),
      ],
    }),
  );
  assert.equal(result.state, "first_value_achieved");
  assert.equal(result.existingResult?.attribution, "after_purchase");
  assert.equal(result.existingResult?.kind, "lesson_result_personal");
});

test("artefato antigo editado não oculta artefato novo after_purchase", () => {
  const before = new Date(NOW.getTime() - 86_400_000);
  const after = new Date(NOW.getTime() + 60_000);
  const editedNow = new Date(NOW.getTime() + 3_600_000);
  const chosen = pickOwnedArtifact(
    [
      artifact("objetivo-oferta-orcamento", {
        id: "old",
        createdAt: before,
        updatedAt: editedNow,
        resultAchievedAt: before,
      }),
      artifact("objetivo-oferta-orcamento", {
        id: "new",
        createdAt: after,
        updatedAt: after,
        resultAchievedAt: after,
      }),
    ],
    {
      subjectUserId: USER,
      lessonSlug: "objetivo-oferta-orcamento",
      evidenceKind: "lesson_result_project",
      purchaseConfirmedAt: NOW,
    },
  );
  assert.equal(chosen?.id, "new");
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", confirmedAt: NOW, lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [
        artifact("objetivo-oferta-orcamento", {
          id: "old",
          createdAt: before,
          updatedAt: editedNow,
          resultAchievedAt: before,
        }),
        artifact("objetivo-oferta-orcamento", {
          id: "new",
          createdAt: after,
          updatedAt: after,
          resultAchievedAt: after,
        }),
      ],
    }),
  );
  assert.equal(result.state, "first_value_achieved");
  assert.equal(result.existingResult?.attribution, "after_purchase");
});

test("entitlement parcialmente revogado não oferece CTA pago inacessível", () => {
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
      entitlements: [entitlement("objetivo-oferta-orcamento", "REVOKED"), entitlement("destino-e-mensuracao", "ACTIVE")],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: after, updatedAt: after, resultAchievedAt: after })],
    }),
  );
  assert.equal(result.state, "next_evolution");
  assert.equal(result.activity?.lessonSlug, "destino-e-mensuracao");
  assert.ok(result.cta?.href.includes("destino-e-mensuracao"));
  assert.equal(result.existingResult?.attribution, "after_purchase");
});

test("aula despublicada com resultado histórico reconhece sem CTA de acesso", () => {
  const after = new Date(NOW.getTime() + 1_000);
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      publishedLessonSlugs: [],
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: after, updatedAt: after, resultAchievedAt: after })],
    }),
  );
  assert.equal(result.state, "first_value_achieved");
  assert.equal(result.cta?.href, "/app");
  assert.match(result.reason, /históric|indisponível/i);
});

test("dependência de projeto e importação evita CTA de resultado imediato", () => {
  const needsProject = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      dependencyAvailability: { project: false, landing_page_project: false, campaign_import: false },
    }),
  );
  assert.equal(needsProject.state, "ready_to_start");
  assert.equal(needsProject.preparation?.status, "needs_project");
  assert.equal(needsProject.cta?.label, "Criar projeto primeiro");
  assert.equal(needsProject.cta?.href, "/app/projetos/novo");

  const needsImport = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o2", lessonSlugs: ["leia-os-numeros"] })],
      entitlements: [entitlement("leia-os-numeros")],
      dependencyAvailability: { project: true, landing_page_project: true, campaign_import: false },
    }),
  );
  assert.equal(needsImport.preparation?.status, "needs_campaign_import");
  assert.equal(needsImport.cta?.label, "Importar dados da campanha");
  assert.notEqual(needsImport.cta?.label, "Começar meu resultado");
});

test("timestamp não comprovável retorna unknown e não declara conquista pós-compra", () => {
  assert.equal(
    attributeArtifactToPurchase(
      { userId: USER, resultAchievedAt: null, updatedAt: NOW },
      { subjectUserId: USER, purchaseConfirmedAt: NOW },
    ),
    "unknown",
  );
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [
        artifact("objetivo-oferta-orcamento", {
          resultAchievedAt: null,
          resultSource: "unproven",
        }),
      ],
    }),
  );
  assert.notEqual(result.state, "first_value_achieved");
  assert.equal(result.existingResult?.attribution, "unknown");
  assert.equal(result.state, "continuation");
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

test("curso ou aula indisponível (não publicada) sem artefato", () => {
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

test("isolamento de resultados por proprietário", () => {
  assert.equal(
    attributeArtifactToPurchase(
      { userId: OTHER, resultAchievedAt: NOW, updatedAt: NOW },
      { subjectUserId: USER, purchaseConfirmedAt: NOW },
    ),
    "other_user",
  );
  const after = new Date(NOW.getTime() + 1_000);
  const result = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [
        artifact("objetivo-oferta-orcamento", { userId: OTHER, createdAt: after, updatedAt: after, resultAchievedAt: after }),
        artifact("objetivo-oferta-orcamento", {
          userId: USER,
          createdAt: after,
          updatedAt: after,
          resultAchievedAt: after,
        }),
      ],
    }),
  );
  assert.equal(result.state, "first_value_achieved");
  assert.equal(result.existingResult?.attribution, "after_purchase");

  const onlyOther = selectFirstValueAction(
    input({
      purchases: [purchase({ orderId: "o1", lessonSlugs: ["objetivo-oferta-orcamento"] })],
      entitlements: [entitlement("objetivo-oferta-orcamento")],
      artifacts: [artifact("objetivo-oferta-orcamento", { userId: OTHER, createdAt: after, updatedAt: after, resultAchievedAt: after })],
    }),
  );
  assert.equal(onlyOther.state, "ready_to_start");
  assert.equal(onlyOther.existingResult, null);
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
      artifacts: [artifact("objetivo-oferta-orcamento", { createdAt: after, updatedAt: after, resultAchievedAt: after })],
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
  assert.ok(result.preparation);
});
