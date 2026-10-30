import { QUESTIONS } from "@/lib/diagnostic/definition";
import { dimensionLabel, knownDimension, parseAnswers, resultSnapshotSchema } from "@/lib/diagnostic/score";

export const DIAGNOSTIC_NAME = "Prontidão para tráfego";
export const DIAGNOSTIC_RESULT_TITLE = "Diagnóstico de Prontidão para Tráfego";

export type DiagnosticProgress = {
  answered: number;
  total: number;
  label: string;
};

/** Progresso pelas respostas salvas. Não usa currentStep e não inventa percentual. */
export function diagnosticAnswerProgress(answers: unknown): DiagnosticProgress {
  const parsed = parseAnswers(answers) ?? {};
  const answered = QUESTIONS.filter((question) => Boolean(parsed[question.id as keyof typeof parsed])).length;
  const total = QUESTIONS.length;
  return { answered, total, label: `${answered} de ${total} respostas` };
}

export type StartPlan =
  | { action: "not_found" }
  | { action: "inactive" }
  | { action: "reuse"; diagnosticId: string }
  | { action: "create" };

/** Decisão de criação. IN_PROGRESS da mesma versão é reutilizado. Projeto inativo não ganha registro novo. */
export function planDiagnosticStart(input: {
  actorId: string;
  project: { userId: string; status: string } | null;
  inProgressId: string | null;
}): StartPlan {
  if (!input.project || input.project.userId !== input.actorId) return { action: "not_found" };
  if (input.inProgressId) return { action: "reuse", diagnosticId: input.inProgressId };
  if (input.project.status !== "ACTIVE") return { action: "inactive" };
  return { action: "create" };
}

export type CenterDiagnostic = {
  id: string;
  projectId: string;
  projectName: string;
  status: "IN_PROGRESS" | "COMPLETED";
  answers: unknown;
  completedAt: Date | null;
  updatedAt: Date;
  resultSnapshot: unknown;
};

export type CenterCard = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  status: "IN_PROGRESS" | "COMPLETED";
  statusLabel: string;
  dateLabel: string | null;
  progressLabel: string | null;
  score: number | null;
  bottleneckLabel: string | null;
  href: string;
  cta: string;
};

export function buildDiagnosticsCenter(
  records: readonly CenterDiagnostic[],
  formatDate: (date: Date) => string,
): CenterCard[] {
  return [...records]
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
    .map((record) => {
      if (record.status === "IN_PROGRESS") {
        const progress = diagnosticAnswerProgress(record.answers);
        return {
          id: record.id,
          projectId: record.projectId,
          projectName: record.projectName,
          name: DIAGNOSTIC_NAME,
          status: "IN_PROGRESS" as const,
          statusLabel: "Em andamento",
          dateLabel: null,
          progressLabel: progress.label,
          score: null,
          bottleneckLabel: null,
          href: `/app/projetos/${record.projectId}/diagnostico`,
          cta: "Continuar diagnóstico",
        };
      }
      const snapshot = resultSnapshotSchema.safeParse(record.resultSnapshot);
      return {
        id: record.id,
        projectId: record.projectId,
        projectName: record.projectName,
        name: DIAGNOSTIC_NAME,
        status: "COMPLETED" as const,
        statusLabel: "Concluído",
        dateLabel: record.completedAt ? formatDate(record.completedAt) : null,
        progressLabel: null,
        score: snapshot.success ? snapshot.data.overallScore : null,
        bottleneckLabel: snapshot.success ? dimensionLabel(knownDimension(snapshot.data.primaryBottleneck)) : null,
        href: `/app/projetos/${record.projectId}/diagnosticos/${record.id}`,
        cta: "Ver resultado",
      };
    });
}

export type NewDiagnosticChoice = {
  id: string;
  name: string;
  mode: "start" | "continue";
  href: string | null;
};

export function newDiagnosticChoices(
  projects: readonly { id: string; name: string; status: string }[],
  inProgressByProject: ReadonlyMap<string, string>,
): NewDiagnosticChoice[] {
  return projects
    .filter((project) => project.status === "ACTIVE")
    .map((project) => {
      const openId = inProgressByProject.get(project.id);
      if (openId) {
        return { id: project.id, name: project.name, mode: "continue" as const, href: `/app/projetos/${project.id}/diagnostico` };
      }
      return { id: project.id, name: project.name, mode: "start" as const, href: null };
    });
}

export function isSerializationConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String(error.code);
  return code === "P2034" || code === "40001";
}

export async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      last = error;
      if (!isSerializationConflict(error) || attempt === 2) throw error;
    }
  }
  throw last;
}
