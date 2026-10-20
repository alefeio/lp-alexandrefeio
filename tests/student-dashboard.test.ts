import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildJourneyStages,
  buildStudentDashboard,
  dashboardHasPrivateKeys,
  deriveMilestones,
  pickVisibleMilestones,
  resolveDashboardNextAction,
  type DashboardBuildInput,
  type DashboardLesson,
} from "../src/lib/home/student-dashboard";
import { courseProgressPercent } from "../src/lib/home/student-home";

function lesson(
  number: number,
  slug: string,
  patch: Partial<DashboardLesson> = {},
): DashboardLesson {
  return {
    slug,
    title: `Aula ${number}`,
    number,
    accessible: true,
    completed: false,
    inProgress: false,
    percent: 0,
    ...patch,
  };
}

function fullLessons(accessiblePaid = true): DashboardLesson[] {
  const slugs = [
    "como-funciona-o-trafego-pago",
    "google-ads-ou-meta-ads",
    "negocio-pronto-para-anunciar",
    "objetivo-oferta-orcamento",
    "destino-e-mensuracao",
    "campanha-de-pesquisa",
    "palavras-chave-com-intencao",
    "anuncios-alinhados-a-conversao",
    "objetivo-publico-estrutura",
    "campanhas-leads-whatsapp",
    "leia-os-numeros",
    "o-que-mudar",
  ];
  return slugs.map((slug, index) =>
    lesson(index + 1, slug, {
      accessible: index < 3 ? true : accessiblePaid,
    }),
  );
}

function input(patch: Partial<DashboardBuildInput> = {}): DashboardBuildInput {
  return {
    userId: "user-a",
    name: "Alexandre Feio",
    lessons: fullLessons(false).map((row, index) => (index < 3 ? row : { ...row, accessible: false })),
    project: null,
    diagnostic: "none",
    importSummary: { total: 0, ready: 0 },
    resultSlugs: [],
    planHint: null,
    operational: { kind: "none" },
    ...patch,
  };
}

test("dashboard privado permanece noindex", () => {
  const page = readFileSync(new URL("../src/app/(app)/app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /loadStudentDashboard/);
  assert.match(page, /StudentDashboard/);
  assert.match(page, /force-dynamic/);
});

test("usuário novo vê jornada simples e poucos acessos", () => {
  const view = buildStudentDashboard(input());
  assert.equal(view.isNewStudent, true);
  assert.match(view.greeting, /Olá, Alexandre/);
  assert.equal(view.subtext, "Vamos começar?");
  assert.equal(view.nextAction.kind, "start");
  assert.equal(view.nextAction.href.startsWith("/aulas/"), true);
  assert.equal(view.quickAccess.length, 2);
  assert.equal(view.quickAccess[0]?.id, "course");
  assert.equal(view.quickAccess[0]?.title, "Cursos");
  assert.equal(view.quickAccess[0]?.href, "/cursos");
  assert.equal(view.quickAccess[0]?.detail, "Veja os cursos disponíveis");
  assert.equal(view.quickAccess[1]?.id, "project");
  assert.equal(view.progress.percentage, 0);
  assert.equal(view.progress.accessibleLessons, 3);
});

test("aula em andamento vira próximo passo com progresso", () => {
  const lessons = fullLessons(false);
  lessons[1] = { ...lessons[1], inProgress: true, percent: 62, title: "Escolha palavras-chave com intenção de compra" };
  const view = buildStudentDashboard(input({ lessons }));
  assert.equal(view.nextAction.kind, "learn");
  assert.match(view.nextAction.title, /Continue/);
  assert.equal(view.nextAction.percent, 62);
  assert.equal(view.nextAction.cta, "Continuar aula");
  assert.equal(view.progress.percentage, courseProgressPercent(0, 1, 2));
});

test("algumas aulas concluídas avançam a jornada visual", () => {
  const lessons = fullLessons(true);
  for (let i = 0; i < 3; i += 1) lessons[i] = { ...lessons[i], completed: true, percent: 100 };
  const stages = buildJourneyStages(lessons);
  assert.equal(stages[0]?.status, "done");
  assert.equal(stages[1]?.status, "current");
  assert.equal(stages[2]?.status, "upcoming");
});

test("acesso parcial não conta aulas bloqueadas no progresso", () => {
  const lessons = fullLessons(false);
  lessons[0] = { ...lessons[0], completed: true, percent: 100 };
  const view = buildStudentDashboard(input({ lessons }));
  assert.equal(view.progress.accessibleLessons, 3);
  assert.equal(view.progress.completedLessons, 1);
  assert.equal(view.progress.percentage, Math.round((1 / 3) * 100));
  assert.equal(view.quickAccess[0]?.title, "Cursos");
  assert.equal(view.quickAccess[0]?.href, "/cursos");
  assert.equal(view.quickAccess[0]?.detail, "Continue sua jornada");
  assert.equal(view.quickAccess[0]?.detail.includes("12"), false);
});

test("curso completo usa 12 aulas acessíveis", () => {
  const lessons = fullLessons(true).map((row) => ({ ...row, completed: true, percent: 100 }));
  const view = buildStudentDashboard(
    input({
      lessons,
      project: { id: "p1", name: "Negócio" },
      diagnostic: "completed",
      importSummary: { total: 1, ready: 1 },
      planHint: "Revisar campanha após novo período de dados.",
    }),
  );
  assert.equal(view.courseCompleted, true);
  assert.equal(view.progress.accessibleLessons, 12);
  assert.equal(view.progress.percentage, 100);
  assert.equal(view.nextAction.tone, "celebrate");
  assert.match(view.nextAction.eyebrow, /Curso concluído/);
});

test("project ausente e existente no acesso rápido", () => {
  const empty = buildStudentDashboard(input());
  assert.equal(empty.quickAccess.find((item) => item.id === "project")?.detail, "Crie seu primeiro projeto");
  const withProject = buildStudentDashboard(input({ project: { id: "p1", name: "Loja Centro" } }));
  assert.equal(withProject.quickAccess.find((item) => item.id === "project")?.detail, "Loja Centro");
});

test("progressive disclosure esconde dados e plano cedo demais", () => {
  const view = buildStudentDashboard(input());
  assert.equal(view.quickAccess.some((item) => item.id === "data"), false);
  assert.equal(view.quickAccess.some((item) => item.id === "plan"), false);
  const later = buildStudentDashboard(
    input({
      project: { id: "p1", name: "Negócio" },
      diagnostic: "completed",
      planHint: "Revisar grupo X",
      operational: { kind: "task", title: "Revisar grupo X" },
      lessons: fullLessons(false).map((row, index) => (index === 0 ? { ...row, completed: true } : row)),
    }),
  );
  assert.equal(later.quickAccess.some((item) => item.id === "data"), true);
  assert.equal(later.quickAccess.some((item) => item.id === "plan"), true);
});

test("WAIT, EXECUTE, ANALYZE e LEARN resolvem next action", () => {
  const base = input({ project: { id: "p1", name: "Negócio" }, diagnostic: "completed" });
  assert.equal(resolveDashboardNextAction({ ...base, operational: { kind: "wait", title: "Aguardar 7 dias" } }).kind, "wait");
  assert.equal(resolveDashboardNextAction({ ...base, operational: { kind: "recommendation", recommendationType: "EXECUTE", title: "Revisar o grupo X" } }).kind, "execute");
  assert.equal(resolveDashboardNextAction({ ...base, operational: { kind: "recommendation", recommendationType: "ANALYZE", title: "Verificar termos" } }).kind, "analyze");
  assert.equal(
    resolveDashboardNextAction({
      ...base,
      operational: {
        kind: "recommendation",
        recommendationType: "LEARN",
        title: "Estude anúncios",
        lessonSlug: "anuncios-alinhados-a-conversao",
        lessonTitle: "Aula 8 · Crie anúncios alinhados à conversão",
      },
    }).kind,
    "learn",
  );
});

test("diagnostic e dataset READY entram no fluxo", () => {
  const diagnostic = buildStudentDashboard(
    input({
      project: { id: "p1", name: "Negócio" },
      diagnostic: "none",
      operational: { kind: "diagnostic" },
      lessons: fullLessons(false).map((row, index) => (index === 0 ? { ...row, completed: true } : row)),
    }),
  );
  assert.equal(diagnostic.nextAction.kind, "diagnostic");
  const ready = buildStudentDashboard(
    input({
      project: { id: "p1", name: "Negócio" },
      diagnostic: "completed",
      importSummary: { total: 1, ready: 1 },
      lessons: fullLessons(false).map((row, index) => (index === 0 ? { ...row, completed: true } : row)),
    }),
  );
  assert.equal(ready.quickAccess.find((item) => item.id === "data")?.detail, "1 arquivo pronto");
});

test("milestones derivados e exibição compacta", () => {
  const milestones = deriveMilestones({
    completedCount: 1,
    accessibleCount: 12,
    diagnosticCompleted: true,
    readyImports: 1,
    resultSlugs: ["objetivo-oferta-orcamento", "campanha-de-pesquisa", "leia-os-numeros", "o-que-mudar"],
  });
  assert.equal(milestones.find((item) => item.id === "PRIMEIRA_AULA")?.unlocked, true);
  assert.equal(milestones.find((item) => item.id === "PRIMEIRO_DIAGNOSTICO")?.unlocked, true);
  assert.equal(milestones.find((item) => item.id === "PRIMEIRO_DATASET")?.unlocked, true);
  assert.equal(milestones.find((item) => item.id === "PRIMEIRA_ANALISE")?.unlocked, true);
  assert.equal(milestones.find((item) => item.id === "PRIMEIRA_DECISAO")?.unlocked, true);
  assert.equal(pickVisibleMilestones(milestones, 4).length, 4);
});

test("privacidade do view model", () => {
  const view = buildStudentDashboard(input({ project: { id: "p1", name: "Negócio" } }));
  assert.equal(dashboardHasPrivateKeys(view), false);
  assert.equal(JSON.stringify(view).includes("payload"), false);
  assert.equal(JSON.stringify(view).includes("email"), false);
});
