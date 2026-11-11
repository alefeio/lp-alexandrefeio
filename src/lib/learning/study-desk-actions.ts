"use server";

import { getSession } from "@/lib/auth/session";
import { loadStudyDesk } from "@/lib/learning/load-study-desk";
import type { StudyDesk } from "@/lib/learning/study-desk";

export type StudyDeskLoadResult = { ok: true; desk: StudyDesk } | { ok: false; message: string };

/** Carrega a Mesa do usuário autenticado. Sem userId arbitrário no cliente. */
export async function fetchStudyDesk(): Promise<StudyDeskLoadResult> {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, message: "Entre na sua conta para abrir a Mesa." };
  const desk = await loadStudyDesk(session.user.id);
  return { ok: true, desk };
}
