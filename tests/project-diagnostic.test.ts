import assert from "node:assert/strict";
import { config as loadEnv } from "dotenv";
import test from "node:test";

loadEnv({ path: ".env.local" });
import { needsSession } from "../src/proxy";
import { DIAGNOSTIC_COURSE_SLUG, diagnosticAnalyticsPayload, diagnosticPayloadIsPublic } from "../src/lib/diagnostic/analytics";
import { DIAGNOSTIC_VERSION, DIMENSIONS, LESSON_BY_DIMENSION } from "../src/lib/diagnostic/definition";
import { answersComplete, channelHint, dimensionScore, isCritical, overallScore, primaryBottleneck, scoreDiagnostic, type DiagnosticAnswers } from "../src/lib/diagnostic/score";
import { parseMoneyToCents, projectInputSchema } from "../src/lib/project/schema";

const full: DiagnosticAnswers = {
  q1: "leads",
  q2: "clear",
  q3: "yes",
  q4: "yes",
  q5: "clear",
  q6: "clear",
  q7: "searches",
  q8: "instagram",
  q9: "yes",
  q10: "works",
  q11: "yes",
  q12: "both",
  q13: "up-to-300",
  q14: "yes",
  q15: "yes",
};

test("nota máxima, orçamento baixo e Instagram não reduzem a dimensão", () => {
  assert.equal(answersComplete(full), true);
  for (const dimension of DIMENSIONS) assert.equal(dimensionScore(dimension, full), 100);
  assert.equal(overallScore(Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, 100])) as Record<(typeof DIMENSIONS)[number], number>), 100);
  const result = scoreDiagnostic(full);
  assert.equal(result.overallScore, 100);
  assert.equal(result.primaryBottleneck, null);
  assert.equal(result.band, "ready");
  assert.equal(dimensionScore("DESTINATION", full), 100);
  assert.equal(dimensionScore("OPERATIONS", full), 100);
});

test("nota geral não esconde gargalo crítico e a prioridade segue a dependência", () => {
  const answers: DiagnosticAnswers = { ...full, q1: "unknown", q11: "no", q12: "none" };
  const result = scoreDiagnostic(answers);
  assert.equal(isCritical("OBJECTIVE", answers), true);
  assert.equal(isCritical("MEASUREMENT", answers), true);
  assert.ok(result.overallScore >= 60);
  assert.equal(result.primaryBottleneck, "OBJECTIVE");
  assert.equal(result.recommendationPriority, "HIGH");
  assert.equal(result.nextStepTitle, "Defina o objetivo principal da campanha.");
  assert.equal(result.lessonSlug, LESSON_BY_DIMENSION.OBJECTIVE);
});

test("regras críticas por dimensão", () => {
  assert.equal(isCritical("OFFER", { ...full, q3: "no" }), true);
  assert.equal(isCritical("AUDIENCE", { ...full, q6: "no" }), true);
  assert.equal(isCritical("DESTINATION", { ...full, q8: "undefined" }), true);
  assert.equal(isCritical("DESTINATION", { ...full, q9: "no" }), true);
  assert.equal(isCritical("DESTINATION", { ...full, q9: "unsure" }), true);
  assert.equal(isCritical("MEASUREMENT", { ...full, q12: "unknown" }), true);
  assert.equal(isCritical("OPERATIONS", { ...full, q14: "none" }), true);
  assert.equal(primaryBottleneck({ ...full, q3: "no", q14: "none" }, scoreDiagnostic({ ...full, q3: "no", q14: "none" }).dimensionScores), "OFFER");
});

test("indicação inicial de canal não trata WhatsApp como Meta", () => {
  assert.equal(channelHint({ ...full, q7: "searches", q1: "whatsapp" }).hint, "google");
  assert.equal(channelHint({ ...full, q7: "discovers" }).hint, "meta");
  assert.equal(channelHint({ ...full, q7: "both" }).hint, "both");
  assert.equal(channelHint({ ...full, q7: "unknown" }).hint, "none");
  assert.match(channelHint(full).explanation, /inicial/i);
});

test("analytics do diagnóstico usa somente contexto público mínimo", () => {
  const started = diagnosticAnalyticsPayload({});
  assert.deepEqual(started, {
    course_slug: "trafego-pago-na-pratica",
    diagnostic_type: "traffic-readiness",
    diagnostic_version: "traffic-readiness-v1",
  });
  assert.equal(DIAGNOSTIC_COURSE_SLUG, "trafego-pago-na-pratica");
  assert.equal(diagnosticPayloadIsPublic(started), true);
  assert.equal(started.diagnostic_version, DIAGNOSTIC_VERSION);

  const completed = diagnosticAnalyticsPayload({ band: "incomplete" });
  assert.deepEqual(completed, {
    course_slug: "trafego-pago-na-pratica",
    diagnostic_type: "traffic-readiness",
    diagnostic_version: "traffic-readiness-v1",
    result_band: "incomplete",
  });
  assert.equal(diagnosticPayloadIsPublic(completed), true);

  for (const forbidden of ["user_id", "project_id", "diagnostic_id", "name", "email", "phone", "company", "answers", "notes", "overallScore", "dimensionScores"]) {
    assert.equal(forbidden in completed, false);
  }
});

test("dinheiro fica em centavos e URL inválida não passa", () => {
  assert.equal(parseMoneyToCents("300"), 30000);
  assert.equal(parseMoneyToCents("10,50"), 1050);
  assert.equal(parseMoneyToCents(""), null);
  assert.equal(parseMoneyToCents("1.2.3"), "invalid");
  const created = projectInputSchema.safeParse({ name: "Padaria" });
  assert.equal(created.success, true);
  if (created.success) assert.equal(created.data.monthlyMediaBudgetCents, null);
  const badUrl = projectInputSchema.safeParse({ name: "Padaria", websiteUrl: "javascript:alert(1)" });
  assert.equal(badUrl.success, false);
});

test("/app, projetos e aprendizado continuam protegidos", () => {
  assert.equal(needsSession("/app"), true);
  assert.equal(needsSession("/app/aprendizado"), true);
  assert.equal(needsSession("/app/projetos"), true);
  assert.equal(needsSession("/app/projetos/novo"), true);
  assert.equal(needsSession("/aulas/como-funciona-o-trafego-pago"), false);
});
