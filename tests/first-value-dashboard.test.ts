import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import test from "node:test";
import { StudentDashboard } from "../src/components/app/StudentDashboard";
import {
  buildStudentDashboard,
  dashboardHasPrivateKeys,
  type DashboardBuildInput,
  type DashboardLesson,
  type StudentDashboardViewModel,
} from "../src/lib/home/student-dashboard";
import {
  firstValueCardHasPrivateKeys,
  presentFirstValueRecommendation,
  shouldSuppressLearningContinuation,
  type FirstValueCardViewModel,
} from "../src/lib/learning/first-value/present";
import type { FirstValueRecommendation } from "../src/lib/learning/first-value/types";

const NOW = "2026-11-09T15:00:00.000Z";

function baseRec(patch: Partial<FirstValueRecommendation> = {}): FirstValueRecommendation {
  return {
    state: "continuation",
    product: {
      orderId: null,
      orderItemId: null,
      productType: null,
      courseSlug: null,
      zeroValueUpgrade: false,
    },
    activity: null,
    expectedOutcome: null,
    cta: { label: "Ver formações", href: "/cursos" },
    progress: null,
    existingResult: null,
    preparation: null,
    reason: "SECRET_REASON_DO_NOT_LEAK",
    fallback: true,
    ...patch,
  };
}

function purchasedProduct(orderId = "order-secret-1") {
  return {
    orderId,
    orderItemId: "item-secret-1",
    productType: "LESSON" as const,
    courseSlug: "trafego-pago-na-pratica",
    zeroValueUpgrade: false,
  };
}

function lesson(number: number, slug: string, patch: Partial<DashboardLesson> = {}): DashboardLesson {
  return {
    slug,
    title: `Aula ${number}`,
    number,
    accessible: true,
    completed: false,
    inProgress: false,
    percent: 0,
    owned: true,
    ...patch,
  };
}

function dashboardInput(patch: Partial<DashboardBuildInput> = {}): DashboardBuildInput {
  return {
    userId: "user-a",
    name: "Alexandre Feio",
    lessons: [
      lesson(1, "como-funciona-o-trafego-pago", { accessible: true, owned: false }),
      lesson(2, "google-ads-ou-meta-ads", { accessible: true, owned: false }),
      lesson(3, "negocio-pronto-para-anunciar", { accessible: true, owned: false }),
      lesson(4, "objetivo-oferta-orcamento", { accessible: false, owned: false }),
    ],
    project: null,
    diagnostic: "none",
    importSummary: { total: 0, ready: 0 },
    resultSlugs: [],
    planHint: null,
    operational: { kind: "none" },
    ...patch,
  };
}

function withCard(view: StudentDashboardViewModel, card: FirstValueCardViewModel | null): StudentDashboardViewModel {
  return { ...view, firstValue: card };
}

function render(view: StudentDashboardViewModel) {
  return renderToStaticMarkup(createElement(StudentDashboard, { view }));
}

test("1. usuário sem compras → card omitido, dashboard antigo preservado", () => {
  const card = presentFirstValueRecommendation(baseRec());
  assert.equal(card, null);
  const view = withCard(buildStudentDashboard(dashboardInput()), card);
  const html = render(view);
  assert.equal(html.includes("Primeira conquista"), false);
  assert.match(html, /Olá, Alexandre/);
  assert.match(html, /Vamos começar/);
});

test("2. pagamento pendente → não afirma compra concluída", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "payment_pending",
      product: purchasedProduct(),
      cta: { label: "Concluir pagamento", href: "/app/compras/order-secret-1" },
      reason: "PENDING_PAYMENT",
    }),
  );
  assert.ok(card);
  assert.equal(card!.presentationState, "payment_pending");
  assert.match(card!.title, /pagamento/i);
  assert.match(card!.guidance, /não for confirmado|indisponível/i);
  assert.equal(card!.highlight, true);
  assert.equal(card!.cta?.label, "Concluir pagamento");
  const html = render(withCard(buildStudentDashboard(dashboardInput()), card));
  assert.match(html, /Conclua o pagamento/);
  assert.equal(html.includes("compra concluída"), false);
  assert.equal(html.includes("order-secret-1") && html.includes("orderId"), false);
});

test("3. pagamento aprovado com acesso confirmado → ready_to_start em destaque", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      cta: { label: "Começar meu resultado", href: "/aulas/objetivo-oferta-orcamento" },
      preparation: { status: "ready", dependency: "project", message: null },
    }),
  );
  assert.ok(card);
  assert.equal(card!.title, "Comece sua primeira conquista");
  assert.equal(card!.expectedOutcome, "Brief da campanha");
  assert.equal(card!.highlight, true);
  assert.equal(card!.cta?.href, "/aulas/objetivo-oferta-orcamento");
});

test("4. acesso ainda pendente", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "access_pending",
      product: purchasedProduct(),
      cta: { label: "Ver meu pedido", href: "/app/compras/order-secret-1" },
    }),
  );
  assert.ok(card);
  assert.match(card!.title, /preparado/i);
  assert.match(card!.guidance, /pagamento foi reconhecido/i);
  assert.equal(card!.expectedOutcome, null);
});

test("5. aula individual adquirida", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: { ...purchasedProduct(), productType: "LESSON" },
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      cta: { label: "Começar meu resultado", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.equal(card?.cta?.href, "/aulas/objetivo-oferta-orcamento");
});

test("6. módulo adquirido", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: { ...purchasedProduct(), productType: "MODULE" },
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      cta: { label: "Começar meu resultado", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.ok(card?.highlight);
  assert.equal(card?.presentationState, "ready_to_start");
});

test("7. curso completo adquirido", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: { ...purchasedProduct(), productType: "COURSE", courseSlug: "trafego-pago-na-pratica" },
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      cta: { label: "Começar meu resultado", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.ok(card);
  assert.match(card!.guidance, /Brief da campanha/);
});

test("8. pedido com vários itens → ViewModel sem orderItemId", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: { ...purchasedProduct(), orderItemId: "item-B" },
      activity: {
        lessonSlug: "destino-e-mensuracao",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Plano de destino",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Plano de destino",
      cta: { label: "Começar meu resultado", href: "/aulas/destino-e-mensuracao" },
    }),
  );
  assert.ok(card);
  assert.equal(firstValueCardHasPrivateKeys(card!), false);
  assert.equal(JSON.stringify(card).includes("orderItemId"), false);
  assert.equal(JSON.stringify(card).includes("item-B"), false);
});

test("9. progresso em andamento", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "in_progress",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      progress: { percent: 45, inProgress: true, completed: false },
      cta: { label: "Continuar aula", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.equal(card?.title, "Continue sua atividade");
  assert.equal(card?.progressLabel, "45% percorrido");
  const html = render(withCard(buildStudentDashboard(dashboardInput()), card));
  assert.match(html, /Continue sua atividade/);
  assert.match(html, /45% percorrido/);
});

test("10. primeira conquista comprovada", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "first_value_achieved",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      existingResult: {
        kind: "lesson_result_project",
        createdAt: NOW,
        updatedAt: NOW,
        resultAchievedAt: NOW,
        resultSource: "lesson_result_created_at",
        attribution: "after_purchase",
      },
      cta: { label: "Revisar resultado", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.equal(card?.title, "Seu resultado está pronto");
  assert.equal(card?.tone, "celebrate");
  assert.equal(card?.highlight, true);
});

test("11. conquista anterior à compra → continuation sem celebração", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "continuation",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      existingResult: {
        kind: "lesson_result_project",
        createdAt: NOW,
        updatedAt: NOW,
        resultAchievedAt: NOW,
        resultSource: "lesson_result_created_at",
        attribution: "before_purchase",
      },
      cta: { label: "Revisar ou atualizar", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.ok(card);
  assert.equal(card!.presentationState, "continuation");
  assert.equal(card!.highlight, false);
  assert.equal(card!.tone, "muted");
  assert.equal(card!.title.includes("pronto"), false);
});

test("12. resultado editado com atribuição unknown → sem celebração", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "first_value_achieved",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief da campanha",
      existingResult: {
        kind: "lesson_result_project",
        createdAt: NOW,
        updatedAt: "2026-11-09T16:00:00.000Z",
        resultAchievedAt: null,
        resultSource: "unproven",
        attribution: "unknown",
      },
      cta: { label: "Abrir aula", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.ok(card);
  assert.equal(card!.presentationState, "continuation");
  assert.equal(card!.tone, "muted");
  assert.equal(card!.title, "Continue avançando");
  assert.equal(card!.highlight, false);
});

test("13. dependência de projeto", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief da campanha",
        eligibility: "requires_dependency",
      },
      expectedOutcome: "Brief da campanha",
      preparation: {
        status: "needs_project",
        dependency: "project",
        message: "Crie um projeto antes de salvar o resultado desta aula.",
      },
      cta: { label: "Criar projeto primeiro", href: "/app/projetos/novo" },
    }),
  );
  assert.ok(card);
  assert.equal(card!.preparationMessage, "Crie um projeto antes de salvar o resultado desta aula.");
  assert.equal(card!.cta?.href, "/app/projetos/novo");
  assert.equal(card!.tone, "caution");
});

test("14. dependência de importação", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "leia-os-numeros",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Diagnóstico de campanha",
        eligibility: "requires_dependency",
      },
      expectedOutcome: "Diagnóstico de campanha",
      preparation: {
        status: "needs_campaign_import",
        dependency: "campaign_import",
        message: "Importe dados READY da campanha antes de concluir esta atividade.",
      },
      cta: { label: "Importar dados da campanha", href: "/app/projetos" },
    }),
  );
  assert.match(card!.preparationMessage ?? "", /Importe dados/);
  assert.equal(card!.cta?.href, "/app/projetos");
});

test("15. entitlement revogado → access_unavailable sem CTA de aula", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "access_unavailable",
      product: purchasedProduct(),
      cta: { label: "Abrir aula paga", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.ok(card);
  assert.equal(card!.cta, null);
  assert.equal(card!.highlight, false);
  const safe = presentFirstValueRecommendation(
    baseRec({
      state: "access_unavailable",
      product: purchasedProduct(),
      cta: { label: "Ver meus cursos", href: "/app" },
    }),
  );
  assert.equal(safe?.cta?.href, "/app");
});

test("16. aula despublicada → access_unavailable sem destaque enganoso", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "access_unavailable",
      product: purchasedProduct(),
      cta: { label: "Ver meus cursos", href: "/app" },
    }),
  );
  assert.equal(card?.presentationState, "access_unavailable");
  assert.equal(card?.highlight, false);
  assert.match(card!.guidance, /Não há conteúdo liberado/i);
});

test("17. usuário com vários cursos → card não remove Meus cursos", () => {
  const view = buildStudentDashboard(
    dashboardInput({
      courses: [
        {
          slug: "trafego-pago-na-pratica",
          title: "Tráfego Pago na Prática",
          lessons: [lesson(4, "objetivo-oferta-orcamento", { accessible: true, owned: true })],
        },
        {
          slug: "sites-que-convertem",
          title: "Sites que Convertem",
          lessons: [lesson(1, "oferta-publico-acao-principal", { accessible: true, owned: true })],
        },
      ],
      lessons: [lesson(4, "objetivo-oferta-orcamento", { accessible: true, owned: true, inProgress: true, percent: 20 })],
    }),
  );
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "in_progress",
      product: { ...purchasedProduct(), productType: "COURSE" },
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief",
      progress: { percent: 20, inProgress: true, completed: false },
      cta: { label: "Continuar aula", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  const html = render(withCard(view, card));
  assert.match(html, /Meus cursos/);
  assert.match(html, /Primeira conquista/);
  assert.match(html, /Meu negócio/);
  assert.match(html, /Acessos rápidos/);
});

test("18. falha do loader → null sem derrubar página", () => {
  const source = readFileSync(new URL("../src/lib/home/load-first-value-card.ts", import.meta.url), "utf8");
  assert.match(source, /try \{/);
  assert.match(source, /return null/);
  assert.match(source, /console\.error\("first-value dashboard load failed"/);
  assert.match(source, /name: error instanceof Error \? error\.name/);
  assert.equal(presentFirstValueRecommendation(baseRec()), null);
  const view = withCard(buildStudentDashboard(dashboardInput()), null);
  assert.equal(view.firstValue, null);
  assert.equal(render(view).includes("Primeira conquista"), false);
});

test("19. fallback para o dashboard antigo", () => {
  const view = withCard(buildStudentDashboard(dashboardInput()), null);
  const html = render(view);
  assert.equal(html.includes("Primeira conquista"), false);
  assert.match(html, /Sua jornada/);
  assert.match(html, /Acessos rápidos/);
});

test("20. ausência de duplicidade do CTA principal", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief",
      cta: { label: "Começar meu resultado", href: "/aulas/objetivo-oferta-orcamento" },
    }),
  );
  assert.equal(
    shouldSuppressLearningContinuation({
      firstValue: card,
      learningHref: "/aulas/objetivo-oferta-orcamento",
    }),
    true,
  );
  assert.equal(
    shouldSuppressLearningContinuation({
      firstValue: card,
      learningHref: "/aulas/objetivo-oferta-orcamento?continuar=1",
    }),
    true,
  );
  const lessons = [
    lesson(4, "objetivo-oferta-orcamento", {
      accessible: true,
      owned: true,
      inProgress: false,
      percent: 0,
      title: "Objetivo, oferta e orçamento",
    }),
  ];
  const view = buildStudentDashboard(
    dashboardInput({
      lessons,
      courses: [{ slug: "trafego-pago-na-pratica", title: "Tráfego Pago na Prática", lessons }],
    }),
  );
  // Força learningContinuation apontando para a mesma aula.
  view.learningContinuation = {
    state: "purchased_not_started",
    eyebrow: "Seu conteúdo está disponível",
    courseTitle: "Tráfego Pago na Prática",
    courseSlug: "trafego-pago-na-pratica",
    moduleTitle: null,
    lessonTitle: "Objetivo, oferta e orçamento",
    positionLabel: "Aula 4 de 12",
    percent: null,
    href: "/aulas/objetivo-oferta-orcamento",
    cta: "Começar minha aula",
  };
  const html = render(withCard(view, card));
  assert.equal((html.match(/Começar meu resultado/g) ?? []).length, 1);
  assert.equal(html.includes("Começar minha aula"), false);
  assert.match(html, /data-first-value-highlight="true"/);
});

test("21. ausência de dados privados no ViewModel", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "ready_to_start",
      product: purchasedProduct("ord-PRIVATE"),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief",
      cta: { label: "Começar", href: "/aulas/objetivo-oferta-orcamento" },
      reason: "leak-me-please",
    }),
  );
  assert.ok(card);
  assert.equal(firstValueCardHasPrivateKeys(card!), false);
  const blob = JSON.stringify(card);
  assert.equal(blob.includes("ord-PRIVATE"), false);
  assert.equal(blob.includes("leak-me-please"), false);
  assert.equal(blob.includes("SECRET_REASON"), false);
  assert.equal(blob.includes("orderId"), false);
  assert.equal(blob.includes("reason"), false);
  const view = withCard(buildStudentDashboard(dashboardInput()), card);
  assert.equal(dashboardHasPrivateKeys(view), false);
});

test("22. responsividade e acessibilidade do card", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "in_progress",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "objetivo-oferta-orcamento",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Brief",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Brief",
      progress: { percent: 30, inProgress: true, completed: false },
      cta: { label: "Continuar aula", href: "/aulas/objetivo-oferta-orcamento" },
      preparation: {
        status: "needs_project",
        dependency: "project",
        message: "Crie um projeto antes de concluir.",
      },
    }),
  );
  const html = render(withCard(buildStudentDashboard(dashboardInput()), card));
  assert.match(html, /aria-labelledby="first-value-heading"/);
  assert.match(html, /id="first-value-heading"/);
  assert.match(html, /role="status"/);
  assert.match(html, /href="\/aulas\/objetivo-oferta-orcamento"/);
  assert.match(html, /Continuar aula/);
  assert.equal(html.includes("<button"), false);
  // Tokens existentes (sem layout novo genérico).
  assert.match(html, /rounded-xl/);
  assert.match(html, /focus-visible:outline-cta|bg-cta/);
});

test("página /app carrega first-value com sessão autenticada e Promise.all", () => {
  const page = readFileSync(new URL("../src/app/(app)/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /requireSession/);
  assert.match(page, /loadFirstValueCardForDashboard/);
  assert.match(page, /loadStudentDashboard/);
  assert.match(page, /Promise\.all/);
  assert.match(page, /session\.user\.id/);
  assert.equal(page.includes("loadFirstValueRecommendation("), false);
});

test("next_evolution mostra resultado anterior e próxima atividade", () => {
  const card = presentFirstValueRecommendation(
    baseRec({
      state: "next_evolution",
      product: purchasedProduct(),
      activity: {
        lessonSlug: "destino-e-mensuracao",
        courseSlug: "trafego-pago-na-pratica",
        outcome: "Plano de destino e mensuração",
        eligibility: "verified_artifact",
      },
      expectedOutcome: "Plano de destino e mensuração",
      existingResult: {
        kind: "lesson_result_project",
        createdAt: NOW,
        updatedAt: NOW,
        resultAchievedAt: NOW,
        resultSource: "lesson_result_created_at",
        attribution: "after_purchase",
      },
      cta: { label: "Próximo resultado", href: "/aulas/destino-e-mensuracao" },
    }),
  );
  assert.equal(card?.title, "Próximo passo da sua conquista");
  assert.match(card!.guidance, /resultado anterior/);
  assert.equal(card?.expectedOutcome, "Plano de destino e mensuração");
});
