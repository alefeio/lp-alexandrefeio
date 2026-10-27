import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync("src/components/diagnostic/DiagnosticWizard.tsx", "utf8");
const resultPage = readFileSync("src/app/(app)/app/projetos/[id]/diagnosticos/[diagnosticId]/page.tsx", "utf8");
const service = readFileSync("src/lib/diagnostic/service.ts", "utf8");

test("diagnóstico não dispara start/completed por renderização ou storage", () => {
  assert.equal(wizard.includes("DiagnosticBeacon"), false);
  assert.equal(resultPage.includes("DiagnosticBeacon"), false);
  assert.equal(resultPage.includes("diagnostic_completed"), false);
  assert.equal(wizard.includes("localStorage"), false);
  assert.equal(wizard.includes("sessionStorage"), false);
  assert.equal(wizard.includes("persistJourneyEvent"), false);
});

test("client emite somente via trackEvent quando o domínio confirma as transições", () => {
  assert.match(wizard, /if \(startedNow\) trackEvent\("diagnostic_started", diagnosticAnalyticsPayload\(\{\}\)\)/);
  assert.match(wizard, /if \(result\.completedNow\) \{\s*trackEvent\("diagnostic_completed", diagnosticAnalyticsPayload\(\{ band: result\.resultBand \}\)\);\s*\}/);
  assert.equal(wizard.includes("gtag("), false);
  assert.equal(wizard.includes("dataLayer"), false);
});

test("completed é emitido antes de qualquer returnTo/router.push", () => {
  const completed = wizard.indexOf('trackEvent("diagnostic_completed"');
  const returnTo = wizard.indexOf("if (returnTo)");
  const firstPushAfterCompleted = wizard.indexOf("router.push", completed);
  assert.ok(completed >= 0);
  assert.ok(returnTo > completed);
  assert.ok(firstPushAfterCompleted > completed);
});

test("serviço usa estado persistido como autoridade e não cria campo de analytics", () => {
  assert.match(service, /AND NOT \("answers" \?\| ARRAY\['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15'\]\)/);
  assert.match(service, /status: "IN_PROGRESS"/);
  assert.match(service, /completedNow: true/);
  assert.match(service, /completedNow: false/);
  assert.equal(service.includes("analyticsStartedAt"), false);
  assert.equal(service.includes("analyticsCompletedAt"), false);
  assert.equal(service.includes("$queryRawUnsafe"), false);
  assert.equal(service.includes("$executeRawUnsafe"), false);
});
