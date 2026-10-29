import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentDashboard } from "../src/components/app/StudentDashboard";
import { activeStudentItem } from "../src/lib/home/student-nav";
import {
  buildMyCourses,
  buildStudentDashboard,
  resolveBusinessNextAction,
  type DashboardBuildInput,
  type DashboardLesson,
  type StudentCourseInput,
} from "../src/lib/home/student-dashboard";

function lesson(number: number, slug: string, patch: Partial<DashboardLesson> = {}): DashboardLesson {
  return {
    slug,
    title: `Aula ${number}`,
    number,
    accessible: false,
    completed: false,
    inProgress: false,
    percent: 0,
    moduleTitle: number <= 3 ? "Módulo 1" : "Módulo 2",
    ...patch,
  };
}

function formation(patches: Partial<DashboardLesson>[] = []): DashboardLesson[] {
  return Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    return lesson(number, `aula-${number}`, {
      accessible: number <= 3,
      ...patches[index],
    });
  });
}

function base(patch: Partial<DashboardBuildInput> = {}): DashboardBuildInput {
  return {
    userId: "user-a",
    name: "Alexandre Feio",
    lessons: formation(),
    project: null,
    diagnostic: "none",
    importSummary: { total: 0, ready: 0 },
    resultSlugs: [],
    planHint: null,
    operational: { kind: "none" },
    courses: [{ slug: "trafego-pago-na-pratica", title: "Tráfego Pago na Prática", lessons: formation() }],
    ...patch,
  };
}

function withCourse(lessons: DashboardLesson[], patch: Partial<DashboardBuildInput> = {}): DashboardBuildInput {
  const course: StudentCourseInput = { slug: "trafego-pago-na-pratica", title: "Tráfego Pago na Prática", lessons };
  return base({ lessons, courses: [course], ...patch });
}

test("usuário novo não ganha curso, progresso nem ação de negócio", () => {
  const view = buildStudentDashboard(base());
  assert.equal(view.learningContinuation, null);
  assert.equal(view.businessNextAction, null);
  assert.deepEqual(view.myCourses, []);
  assert.equal(view.nextAction.kind, "start");
  assert.equal(view.diagnostic, "none");
});

test("aula gratuita em andamento continua o estudo sem porcentagem inventada", () => {
  const lessons = formation();
  lessons[1] = { ...lessons[1]!, accessible: true, inProgress: true, percent: 62 };
  const view = buildStudentDashboard(withCourse(lessons));
  assert.equal(view.learningContinuation?.state, "in_progress");
  assert.equal(view.learningContinuation?.cta, "Continuar estudando");
  assert.equal(view.learningContinuation?.courseTitle, "Tráfego Pago na Prática");
  assert.equal(view.learningContinuation?.positionLabel, "Aula 2 de 12");
  assert.equal(view.learningContinuation?.percent, 62);
  assert.equal(view.learningContinuation?.href, "/aulas/aula-2?continuar=1");
  assert.equal(view.businessNextAction, null);
  assert.equal(view.myCourses[0]?.status, "partial");
  assert.equal(view.myCourses[0]?.cta, "Continuar");
  assert.equal(view.myCourses[0]?.progressLabel.includes("100%"), false);
});

test("aula paga comprada e não iniciada não cria progresso", () => {
  const lessons = formation();
  lessons[3] = { ...lessons[3]!, accessible: true, owned: true, percent: 0, completed: false, inProgress: false };
  const view = buildStudentDashboard(withCourse(lessons));
  assert.equal(view.learningContinuation?.state, "purchased_not_started");
  assert.equal(view.learningContinuation?.eyebrow, "Seu conteúdo está disponível");
  assert.equal(view.learningContinuation?.cta, "Começar minha aula");
  assert.equal(view.learningContinuation?.percent, null);
  assert.equal(view.learningContinuation?.href, "/aulas/aula-4");
  assert.equal(view.myCourses[0]?.status, "partial");
  assert.equal(view.myCourses[0]?.progressLabel.includes("100%"), false);
  assert.equal(view.myCourses[0]?.cta, "Começar");
});

test("curso inteiro acessível em andamento não vira acesso parcial", () => {
  const lessons = formation().map((row) => ({ ...row, accessible: true }));
  lessons[1] = { ...lessons[1]!, inProgress: true, percent: 20 };
  const view = buildStudentDashboard(withCourse(lessons));
  assert.equal(view.myCourses[0]?.status, "in_progress");
  assert.equal(view.myCourses[0]?.statusLabel, "Em andamento");
  assert.equal(view.myCourses[0]?.cta, "Continuar");
  assert.equal(view.myCourses[0]?.progressLabel, "0 de 12 aulas");
});

test("aula paga em andamento continua de onde parou", () => {
  const lessons = formation();
  lessons[3] = { ...lessons[3]!, accessible: true, owned: true, inProgress: true, percent: 40 };
  const view = buildStudentDashboard(withCourse(lessons));
  assert.equal(view.learningContinuation?.state, "in_progress");
  assert.equal(view.learningContinuation?.percent, 40);
  assert.equal(view.myCourses[0]?.status, "partial");
  assert.equal(view.myCourses[0]?.cta, "Continuar");
});

test("aula concluída com próxima acessível segue o estudo", () => {
  const lessons = formation();
  lessons[0] = { ...lessons[0]!, completed: true, percent: 100 };
  const view = buildStudentDashboard(withCourse(lessons));
  assert.equal(view.learningContinuation?.state, "ready_next");
  assert.equal(view.learningContinuation?.cta, "Continuar estudando");
  assert.equal(view.learningContinuation?.href, "/aulas/aula-2");
  assert.equal(view.myCourses[0]?.status, "partial");
});

test("acesso parcial não apresenta a formação como concluída", () => {
  const lessons = formation();
  lessons[3] = { ...lessons[3]!, accessible: true, owned: true, completed: true, percent: 100 };
  const cards = buildMyCourses(withCourse(lessons));
  assert.equal(cards[0]?.status, "partial");
  assert.equal(cards[0]?.statusLabel, "Acesso parcial");
  assert.equal(cards[0]?.progressLabel.includes("100%"), false);
  assert.match(cards[0]?.progressLabel ?? "", /aulas acessíveis/);
  assert.equal(cards[0]?.cta, "Continuar");
});

test("curso concluído oferece revisão e passa o foco para o negócio", () => {
  const lessons = formation().map((row) => ({ ...row, accessible: true, completed: true, percent: 100 }));
  const view = buildStudentDashboard(
    withCourse(lessons, {
      project: { id: "proj-1", name: "Padaria do Alexandre" },
      diagnostic: "completed",
      operational: { kind: "none" },
    }),
  );
  assert.equal(view.learningContinuation, null);
  assert.equal(view.myCourses[0]?.status, "completed");
  assert.equal(view.myCourses[0]?.cta, "Revisar");
  assert.equal(view.businessNextAction?.kind, "data");
});

test("projeto sem diagnóstico oferece fazer o diagnóstico", () => {
  const view = buildStudentDashboard(
    base({
      project: { id: "proj-1", name: "Padaria do Alexandre" },
      diagnostic: "none",
      operational: { kind: "diagnostic" },
    }),
  );
  assert.equal(view.learningContinuation, null);
  assert.equal(view.businessNextAction?.kind, "diagnostic");
  assert.equal(view.businessNextAction?.cta, "Fazer diagnóstico");
});

test("diagnóstico em andamento continua o diagnóstico", () => {
  const view = buildStudentDashboard(
    base({
      project: { id: "proj-1", name: "Padaria do Alexandre" },
      diagnostic: "in_progress",
      operational: { kind: "diagnostic" },
    }),
  );
  assert.equal(view.diagnostic, "in_progress");
  assert.equal(view.businessNextAction?.cta, "Continuar diagnóstico");
});

test("diagnóstico concluído guarda o caminho do resultado", () => {
  const view = buildStudentDashboard(
    base({
      project: { id: "proj-1", name: "Padaria do Alexandre" },
      diagnostic: "completed",
      diagnosticHref: "/app/projetos/proj-1/diagnosticos/diag-1",
      diagnosticCompletedLabel: "29 de out. de 2026",
      operational: { kind: "none" },
    }),
  );
  assert.equal(view.diagnostic, "completed");
  assert.equal(view.diagnosticHref, "/app/projetos/proj-1/diagnosticos/diag-1");
  assert.equal(view.diagnosticCompletedLabel, "29 de out. de 2026");
});

test("aula em andamento e tarefa operacional aparecem juntas", () => {
  const lessons = formation();
  lessons[1] = { ...lessons[1]!, inProgress: true, percent: 62 };
  const input = withCourse(lessons, {
    project: { id: "proj-1", name: "Padaria do Alexandre" },
    diagnostic: "completed",
    operational: { kind: "task", title: "Revisar a campanha" },
  });
  const view = buildStudentDashboard(input);
  assert.equal(view.learningContinuation?.cta, "Continuar estudando");
  assert.equal(view.businessNextAction?.kind, "task");
  assert.equal(view.businessNextAction?.title, "Revisar a campanha");
  assert.equal(resolveBusinessNextAction(input)?.kind, "task");
  const html = renderToStaticMarkup(createElement(StudentDashboard, { view }));
  assert.match(html, /Continuar estudando/);
  assert.match(html, /Próxima ação no seu negócio/);
  assert.match(html, /Revisar a campanha/);
  assert.match(html, /Meus cursos/);
  assert.match(html, /Meu negócio/);
  assert.match(html, /Padaria do Alexandre/);
});

test("navegação persistente marca a seção atual", () => {
  assert.equal(activeStudentItem("/app"), "inicio");
  assert.equal(activeStudentItem("/app/aprendizado"), "cursos");
  assert.equal(activeStudentItem("/app/projetos/proj-1/plano"), "negocio");
  assert.equal(activeStudentItem("/app/alertas"), "alertas");
  assert.equal(activeStudentItem("/app/compras/pedido-1"), "compras");
  assert.equal(activeStudentItem("/app/checkout"), null);
  const layout = readFileSync(new URL("../src/app/(app)/app/layout.tsx", import.meta.url), "utf8");
  const nav = readFileSync(new URL("../src/lib/home/student-nav.ts", import.meta.url), "utf8");
  assert.match(layout, /StudentNav/);
  assert.match(nav, /Início/);
  assert.match(nav, /Meus cursos/);
  assert.match(nav, /Meu negócio/);
  assert.match(nav, /Alertas/);
  assert.match(nav, /Compras/);
  assert.doesNotMatch(nav, /\/app\/diagnosticos/);
});
