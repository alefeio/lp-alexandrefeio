"use server";

import { requireSession } from "@/lib/auth/session";
import { completeDiagnosticForUser, saveDiagnosticProgress } from "@/lib/diagnostic/service";

export async function saveDiagnosticAction(projectId: string, diagnosticId: string, answers: unknown, step: number) {
  const session = await requireSession();
  return saveDiagnosticProgress(session.user.id, projectId, diagnosticId, answers, step);
}

export async function completeDiagnosticAction(projectId: string, diagnosticId: string) {
  const session = await requireSession();
  return completeDiagnosticForUser(session.user.id, projectId, diagnosticId);
}
