"use server";

import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/auth/messages";
import { requireSession } from "@/lib/auth/session";
import { completeDiagnosticForUser, saveDiagnosticProgress, startDiagnosticForUser } from "@/lib/diagnostic/service";
import { linkTrafficReadinessFromReturn } from "@/lib/learning/tool";

export async function startDiagnosticAction(formData: FormData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") ?? "");
  const returnTo = safeReturnPath(String(formData.get("returnTo") ?? ""));
  const result = await startDiagnosticForUser(session.user.id, projectId);
  if (!result.ok) redirect("/app/diagnosticos");
  const destination = `/app/projetos/${result.diagnostic.projectId}/diagnostico`;
  redirect(returnTo ? `${destination}?returnTo=${encodeURIComponent(returnTo)}` : destination);
}

export async function saveDiagnosticAction(projectId: string, diagnosticId: string, answers: unknown, step: number) {
  const session = await requireSession();
  return saveDiagnosticProgress(session.user.id, projectId, diagnosticId, answers, step);
}

export async function completeDiagnosticAction(projectId: string, diagnosticId: string) {
  const session = await requireSession();
  return completeDiagnosticForUser(session.user.id, projectId, diagnosticId);
}

export async function linkLessonToolFromReturn(returnTo: string, projectId: string, diagnosticId: string) {
  const session = await requireSession();
  return linkTrafficReadinessFromReturn({ userId: session.user.id, returnTo, projectId, diagnosticId });
}
