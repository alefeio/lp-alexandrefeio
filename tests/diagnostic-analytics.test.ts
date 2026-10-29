import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("diagnostic completion analytics emit only after first confirmed completion", () => {
  const wizard = readFileSync("src/components/diagnostic/DiagnosticWizard.tsx", "utf8");
  const completeCall = wizard.indexOf("completeDiagnosticAction(projectId, diagnosticId)");
  const firstCompletionGuard = wizard.indexOf("if (result.completedNow)");
  const completionEvent = wizard.indexOf('trackEvent("diagnostic_completed"');

  assert.ok(completeCall >= 0);
  assert.ok(firstCompletionGuard > completeCall);
  assert.ok(completionEvent > firstCompletionGuard);

  const resultPage = readFileSync("src/app/(app)/app/projetos/[id]/diagnosticos/[diagnosticId]/page.tsx", "utf8");
  assert.equal(resultPage.includes('trackEvent("diagnostic_completed"'), false);
});
