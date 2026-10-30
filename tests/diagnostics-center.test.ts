import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { QUESTIONS } from "../src/lib/diagnostic/definition";
import {
  buildDiagnosticsCenter,
  diagnosticAnswerProgress,
  isSerializationConflict,
  newDiagnosticChoices,
  planDiagnosticStart,
  withSerializableRetry,
  type CenterDiagnostic,
} from "../src/lib/diagnostic/center";
import { activeStudentItem } from "../src/lib/home/student-nav";
import { needsSession } from "../src/proxy";

const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(date);

function record(patch: Partial<CenterDiagnostic> & Pick<CenterDiagnostic, "id" | "projectId" | "projectName" | "status">): CenterDiagnostic {
  return {
    answers: {},
    completedAt: null,
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    resultSnapshot: null,
    ...patch,
  };
}

const snapshot = {
  version: "traffic-readiness-v1",
  overallScore: 42,
  band: "base",
  bandLabel: "Base",
  dimensionScores: { OBJECTIVE: 0, OFFER: 100, AUDIENCE: 100, DESTINATION: 100, MEASUREMENT: 100, OPERATIONS: 100 },
  primaryBottleneck: "OBJECTIVE",
  strengths: [],
  attention: ["OBJECTIVE"],
  channelHint: "none",
  channelExplanation: "Indicação inicial.",
  nextStepTitle: "Defina o objetivo principal da campanha.",
  nextStepDescription: "Escolha um resultado.",
  recommendationType: "LEARN",
  recommendationPriority: "HIGH",
  lessonSlug: "objetivo-oferta-orcamento",
};

test("progresso conta respostas salvas e deriva o total das perguntas", () => {
  const answers = { q1: "leads", q2: "clear", q3: "yes", q4: "yes", q5: "clear", q6: "clear", q7: "searches", q8: "instagram" };
  const progress = diagnosticAnswerProgress(answers);
  assert.equal(progress.answered, 8);
  assert.equal(progress.total, QUESTIONS.length);
  assert.equal(progress.label, `8 de ${QUESTIONS.length} respostas`);
  assert.equal(diagnosticAnswerProgress({ q5Note: "rascunho" }).answered, 0);
});

test("start explícito cria, repetição reutiliza e usuário cruzado ou projeto inativo não cria", () => {
  const active = { userId: "user-a", status: "ACTIVE" };
  assert.deepEqual(planDiagnosticStart({ actorId: "user-a", project: active, inProgressId: null }), { action: "create" });
  assert.deepEqual(planDiagnosticStart({ actorId: "user-a", project: active, inProgressId: "diag-1" }), {
    action: "reuse",
    diagnosticId: "diag-1",
  });
  assert.deepEqual(planDiagnosticStart({ actorId: "user-b", project: active, inProgressId: null }), { action: "not_found" });
  assert.deepEqual(planDiagnosticStart({ actorId: "user-a", project: null, inProgressId: null }), { action: "not_found" });
  assert.deepEqual(planDiagnosticStart({ actorId: "user-a", project: { userId: "user-a", status: "ARCHIVED" }, inProgressId: null }), {
    action: "inactive",
  });
  assert.equal(planDiagnosticStart({ actorId: "user-a", project: { userId: "user-a", status: "ARCHIVED" }, inProgressId: "diag-1" }).action, "reuse");

  const store: { id: string }[] = [];
  function start() {
    const open = store[0]?.id ?? null;
    const decision = planDiagnosticStart({ actorId: "user-a", project: active, inProgressId: open });
    if (decision.action === "create") {
      store.push({ id: "diag-1" });
      return { created: true, id: "diag-1" };
    }
    if (decision.action === "reuse") return { created: false, id: decision.diagnosticId };
    return { created: false, id: null };
  }
  assert.deepEqual(start(), { created: true, id: "diag-1" });
  assert.deepEqual(start(), { created: false, id: "diag-1" });
  assert.equal(store.length, 1);
});

test("conflito serializável dispara nova leitura", async () => {
  assert.equal(isSerializationConflict({ code: "P2034" }), true);
  assert.equal(isSerializationConflict({ code: "40001" }), true);
  assert.equal(isSerializationConflict(new Error("outro")), false);
  let calls = 0;
  const value = await withSerializableRetry(async () => {
    calls += 1;
    if (calls === 1) throw { code: "P2034" };
    return "diag-1";
  });
  assert.equal(value, "diag-1");
  assert.equal(calls, 2);
});

test("central vazia, em andamento, concluído e histórico de projetos diferentes", () => {
  assert.deepEqual(buildDiagnosticsCenter([], formatDate), []);
  const august = record({
    id: "old",
    projectId: "bakery",
    projectName: "Padaria do Alexandre",
    status: "COMPLETED",
    completedAt: new Date("2026-08-10T12:00:00Z"),
    updatedAt: new Date("2026-08-10T12:00:00Z"),
    resultSnapshot: snapshot,
  });
  const october = record({
    id: "new",
    projectId: "bakery",
    projectName: "Padaria do Alexandre",
    status: "COMPLETED",
    completedAt: new Date("2026-10-29T12:00:00Z"),
    updatedAt: new Date("2026-10-29T12:00:00Z"),
    resultSnapshot: { ...snapshot, overallScore: 70, primaryBottleneck: null },
  });
  const running = record({
    id: "open",
    projectId: "clinic",
    projectName: "Clínica",
    status: "IN_PROGRESS",
    answers: { q1: "leads", q2: "clear" },
    updatedAt: new Date("2026-10-28T12:00:00Z"),
  });
  const cards = buildDiagnosticsCenter([august, running, october], formatDate);
  assert.deepEqual(cards.map((card) => card.id), ["new", "open", "old"]);
  const open = cards.find((card) => card.id === "open");
  assert.equal(open?.projectName, "Clínica");
  assert.equal(open?.statusLabel, "Em andamento");
  assert.equal(open?.progressLabel, `2 de ${QUESTIONS.length} respostas`);
  assert.equal(open?.cta, "Continuar diagnóstico");
  assert.equal(open?.href, "/app/projetos/clinic/diagnostico");
  const latest = cards.find((card) => card.id === "new");
  assert.equal(latest?.projectName, "Padaria do Alexandre");
  assert.equal(latest?.cta, "Ver resultado");
  assert.equal(latest?.score, 70);
  assert.equal(latest?.href, "/app/projetos/bakery/diagnosticos/new");
  const previous = cards.find((card) => card.id === "old");
  assert.equal(previous?.score, 42);
  assert.equal(previous?.bottleneckLabel, "Objetivo");
  assert.equal(cards.filter((card) => card.projectId === "bakery").length, 2);
});

test("escolha de novo diagnóstico não cria sozinha e não duplica o que está em andamento", () => {
  const choices = newDiagnosticChoices(
    [
      { id: "bakery", name: "Padaria", status: "ACTIVE" },
      { id: "clinic", name: "Clínica", status: "ACTIVE" },
      { id: "old", name: "Arquivado", status: "ARCHIVED" },
    ],
    new Map([["clinic", "diag-clinic"]]),
  );
  assert.deepEqual(choices.map((choice) => choice.mode), ["start", "continue"]);
  assert.equal(choices.find((choice) => choice.id === "clinic")?.href, "/app/projetos/clinic/diagnostico");
  assert.equal(choices.some((choice) => choice.id === "old"), false);
});

test("navegação marca diagnóstico sem tomar o resto do projeto", () => {
  assert.equal(activeStudentItem("/app/diagnosticos"), "diagnosticos");
  assert.equal(activeStudentItem("/app/diagnosticos/novo"), "diagnosticos");
  assert.equal(activeStudentItem("/app/projetos/x/diagnostico"), "diagnosticos");
  assert.equal(activeStudentItem("/app/projetos/x/diagnosticos/y"), "diagnosticos");
  assert.equal(activeStudentItem("/app/projetos/x/plano"), "negocio");
  assert.equal(activeStudentItem("/app/projetos/x/dados"), "negocio");
  assert.equal(needsSession("/app/diagnosticos"), true);
  const nav = readFileSync(new URL("../src/lib/home/student-nav.ts", import.meta.url), "utf8");
  assert.match(nav, /Diagnósticos/);
});

test("abrir a central ou o diagnóstico não cria registro", () => {
  const center = readFileSync(new URL("../src/app/(app)/app/diagnosticos/page.tsx", import.meta.url), "utf8");
  const wizard = readFileSync(new URL("../src/app/(app)/app/projetos/[id]/diagnostico/page.tsx", import.meta.url), "utf8");
  const fresh = readFileSync(new URL("../src/app/(app)/app/diagnosticos/novo/page.tsx", import.meta.url), "utf8");
  const result = readFileSync(new URL("../src/app/(app)/app/projetos/[id]/diagnosticos/[diagnosticId]/page.tsx", import.meta.url), "utf8");
  for (const source of [center, wizard, fresh, result]) {
    assert.equal(source.includes("diagnostic.create"), false);
    assert.equal(source.includes("resumeDiagnosticForUser"), false);
    assert.equal(source.includes("startDiagnosticForUser"), false);
  }
  assert.match(center, /listDiagnosticsForUser/);
  assert.match(wizard, /findInProgressDiagnosticForUser/);
  assert.match(wizard, /Iniciar diagnóstico/);
  assert.match(fresh, /Iniciar diagnóstico/);
  assert.match(result, /Meus diagnósticos/);
  assert.match(result, /Fazer novo diagnóstico/);
  assert.match(result, /resultSnapshot/);
  const action = readFileSync(new URL("../src/lib/diagnostic/actions.ts", import.meta.url), "utf8");
  assert.match(action, /startDiagnosticAction/);
  assert.match(action, /safeReturnPath/);
  const service = readFileSync(new URL("../src/lib/diagnostic/service.ts", import.meta.url), "utf8");
  assert.match(service, /findInProgressDiagnosticForUser/);
  assert.match(service, /startDiagnosticForUser/);
  assert.match(service, /Serializable/);
  assert.match(service, /withSerializableRetry/);
  assert.equal(service.includes("resumeDiagnosticForUser"), false);
});
