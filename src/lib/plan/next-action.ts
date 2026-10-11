export type OpenStatus = "TODO" | "IN_PROGRESS";
export type PlanPriority = "HIGH" | "MEDIUM" | "LOW";

export type NextTask = {
  id: string;
  priority: PlanPriority;
  status: OpenStatus | "DONE" | "CANCELLED";
  dueAt: Date | null;
  updatedAt: Date;
};

export type NextRecommendation = {
  id: string;
  priority: PlanPriority;
  type: "LEARN" | "EXECUTE" | "ANALYZE" | "WAIT";
  hasActiveTask: boolean;
};

export type NextReminder = {
  id: string;
  type: "DEADLINE" | "REVIEW" | "BUDGET" | "PLANNING";
  remindAt: Date;
  dismissedAt: Date | null;
};

export type NextAction =
  | { kind: "task"; taskId: string; reason: "overdue-high" | "overdue" | "high-due" | "in-progress" | "todo" }
  | { kind: "recommendation"; recommendationId: string }
  | { kind: "wait"; reminderId: string }
  | { kind: "diagnostic" }
  | { kind: "none" };

const PRIORITY_RANK: Record<PlanPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function isOpen(task: NextTask): task is NextTask & { status: OpenStatus } {
  return task.status === "TODO" || task.status === "IN_PROGRESS";
}

function byDueThenUpdate(a: NextTask, b: NextTask) {
  const aDue = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bDue = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

/**
 * Próxima ação, nesta ordem:
 * 1. tarefa HIGH aberta e vencida;
 * 2. qualquer tarefa aberta vencida;
 * 3. tarefa HIGH aberta com o prazo mais próximo;
 * 4. tarefa em andamento;
 * 5. tarefa a fazer, por prioridade e depois por prazo;
 * 6. recomendação sem tarefa ativa, HIGH antes das demais; WAIT não vira tarefa;
 * 7. lembrete de revisão de uma recomendação WAIT, se faltar no máximo 7 dias;
 * 8. convite ao diagnóstico, quando ainda não há diagnóstico concluído;
 * 9. nenhuma ação operacional. O estudo continua em outro bloco da home.
 */
export function chooseNextAction(input: {
  tasks: NextTask[];
  recommendations: NextRecommendation[];
  reminders: NextReminder[];
  hasCompletedDiagnostic: boolean;
  now?: Date;
}): NextAction {
  const now = input.now ?? new Date();
  const open = input.tasks.filter(isOpen);
  const overdue = open.filter((task) => task.dueAt && task.dueAt.getTime() < now.getTime()).sort(byDueThenUpdate);
  const overdueHigh = overdue.find((task) => task.priority === "HIGH");
  if (overdueHigh) return { kind: "task", taskId: overdueHigh.id, reason: "overdue-high" };
  if (overdue[0]) return { kind: "task", taskId: overdue[0].id, reason: "overdue" };

  const highDue = open
    .filter((task) => task.priority === "HIGH" && task.dueAt && task.dueAt.getTime() >= now.getTime())
    .sort(byDueThenUpdate)[0];
  if (highDue) return { kind: "task", taskId: highDue.id, reason: "high-due" };

  const inProgress = open
    .filter((task) => task.status === "IN_PROGRESS")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  if (inProgress) return { kind: "task", taskId: inProgress.id, reason: "in-progress" };

  const todo = open
    .filter((task) => task.status === "TODO")
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDueThenUpdate(a, b))[0];
  if (todo) return { kind: "task", taskId: todo.id, reason: "todo" };

  const recommendation = input.recommendations
    .filter((item) => item.type !== "WAIT" && !item.hasActiveTask)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0];
  if (recommendation) return { kind: "recommendation", recommendationId: recommendation.id };

  const soon = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const wait = input.reminders
    .filter((item) => item.type === "REVIEW" && !item.dismissedAt && item.remindAt.getTime() <= soon)
    .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())[0];
  if (wait) return { kind: "wait", reminderId: wait.id };

  if (!input.hasCompletedDiagnostic) return { kind: "diagnostic" };
  return { kind: "none" };
}

export function isTaskOverdue(task: { status: string; dueAt: Date | null }, now = new Date()) {
  return (task.status === "TODO" || task.status === "IN_PROGRESS") && Boolean(task.dueAt && task.dueAt.getTime() < now.getTime());
}
