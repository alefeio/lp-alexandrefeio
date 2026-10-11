import Link from "next/link";
import { notFound } from "next/navigation";
import { BudgetForm, DueReminderForm, LessonTaskForm, ManualTaskForm, RecommendationPlanButton, ReminderForm } from "@/components/plan/PlanForms";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { buttonClass } from "@/lib/button-styles";
import { dimensionLabel, knownDimension } from "@/lib/diagnostic/score";
import { formatPriceCents } from "@/lib/learning/money";
import { coverageDays, coverageLabel } from "@/lib/plan/budget";
import { isTaskOverdue } from "@/lib/plan/next-action";
import { taskStatusAction } from "@/lib/plan/actions";
import { getPlanForUser } from "@/lib/plan/service";

export const metadata = { title: "Plano vivo" };

const OBJECTIVE: Record<string, string> = {
  LEADS: "Receber contatos",
  SALES: "Vender diretamente",
  WHATSAPP: "WhatsApp",
  STORE_VISITS: "Visitas à loja",
  AWARENESS: "Reconhecimento",
  UNDEFINED: "Ainda não definido",
};

export default async function LivePlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const plan = await getPlanForUser(session.user.id, id);
  if (!plan) notFound();
  const { project, latest, next } = plan;
  const archived = project.status === "ARCHIVED";
  const now = new Date();
  const open = project.tasks.filter((task) => task.status === "TODO" || task.status === "IN_PROGRESS");
  const nowTasks = open.filter((task) => task.status === "IN_PROGRESS" || isTaskOverdue(task, now) || task.priority === "HIGH");
  const laterTasks = open.filter((task) => !nowTasks.includes(task));
  const doneTasks = project.tasks.filter((task) => task.status === "DONE").slice(0, 8);
  const reviews = project.reminders.filter((item) => item.type === "REVIEW" && !item.dismissedAt);
  const nextTask = next.kind === "task" ? project.tasks.find((task) => task.id === next.taskId) : null;
  const nextRecommendation = next.kind === "recommendation" ? project.recommendations.find((item) => item.id === next.recommendationId) : null;
  const days = project.budgetPlan ? coverageDays(project.budgetPlan.currentBalanceCents, project.budgetPlan.plannedDailyBudgetCents) : null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Plano vivo</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{project.name}</h1>
      {archived ? <p className="mt-2 text-sm text-muted">Arquivado. O histórico continua aqui, sem ações novas.</p> : null}

      <section className="mt-8 space-y-3 text-base leading-relaxed">
        <p><strong>Objetivo. </strong>{project.objective ? OBJECTIVE[project.objective] : "Ainda não definido no projeto."}</p>
        <p><strong>Principal gargalo. </strong>{dimensionLabel(knownDimension(latest?.primaryBottleneck))}</p>
        <p>
          <strong>Próxima ação. </strong>
          {nextTask ? nextTask.title : nextRecommendation ? nextRecommendation.title : next.kind === "diagnostic" ? "Fazer o diagnóstico." : next.kind === "wait" ? "Aguardar a revisão marcada." : "Nenhuma ação urgente."}
        </p>
      </section>

      <TaskGroup title="Agora" tasks={nowTasks} projectId={project.id} archived={archived} now={now} />
      <TaskGroup title="Planejado" tasks={laterTasks} projectId={project.id} archived={archived} now={now} />
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Aguardando revisão</h2>
        {reviews.length === 0 ? <p className="mt-2 text-sm text-muted">Nenhuma revisão marcada.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {reviews.map((item) => (
              <li key={item.id}>{item.title} · {formatWhen(item.remindAt)}</li>
            ))}
          </ul>
        )}
      </section>
      <TaskGroup title="Concluído recentemente" tasks={doneTasks} projectId={project.id} archived={archived} now={now} />
      {project.tasks.some((task) => task.status === "CANCELLED") ? (
        <p className="mt-6 text-sm text-muted">
          Cancelada: {project.tasks.filter((task) => task.status === "CANCELLED").map((task) => task.title).join(", ")}.
        </p>
      ) : null}

      <section className="mt-10" id="recarga">
        <h2 className="text-lg font-semibold">Orçamento e recarga</h2>
        {project.budgetPlan && days !== null ? (
          <p className="mt-2 text-base leading-relaxed">
            Saldo informado {formatPriceCents(project.budgetPlan.currentBalanceCents)}. Uso planejado {formatPriceCents(project.budgetPlan.plannedDailyBudgetCents)} por dia. Cobertura estimada: {coverageLabel(days)}. Estimativa baseada nos valores informados por você.
          </p>
        ) : <p className="mt-2 text-sm text-muted">Ainda não há planejamento de recarga.</p>}
        <BudgetForm projectId={project.id} archived={archived} />
      </section>

      <section className="mt-10" id="acao">
        <h2 className="text-lg font-semibold">Adicionar ação</h2>
        <ManualTaskForm projectId={project.id} archived={archived} />
        <ReminderForm projectId={project.id} archived={archived} />
        {project.recommendations.filter((item) => item.type !== "WAIT" && item.tasks.length === 0).slice(0, 1).map((item) => (
          <div key={item.id} className="mt-6">
            <p className="text-sm text-muted">Orientação do diagnóstico</p>
            <p className="mt-1 font-medium">{item.title}</p>
            <RecommendationPlanButton projectId={project.id} recommendationId={item.id} type={item.type} already={false} />
          </div>
        ))}
        {project.lessonResults[0] ? (
          <div className="mt-6">
            <p className="text-sm font-medium">Resultado de aula neste projeto</p>
            <LessonTaskForm projectId={project.id} lessonResultId={project.lessonResults[0].id} />
          </div>
        ) : null}
      </section>

      <Link className={`${buttonClass("secondary")} mt-10`} href={`/app/projetos/${project.id}`}>Voltar ao projeto</Link>
    </Container>
  );
}

function TaskGroup({
  title,
  tasks,
  projectId,
  archived,
  now,
}: {
  title: string;
  tasks: { id: string; title: string; status: string; priority: string; dueAt: Date | null; description: string | null }[];
  projectId: string;
  archived: boolean;
  now: Date;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {tasks.length === 0 ? <p className="mt-2 text-sm text-muted">Nada nesta lista.</p> : (
        <ul className="mt-3 space-y-4">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-medium">{task.title}</p>
              {task.description ? <p className="mt-1 text-sm text-muted">{task.description}</p> : null}
              <p className="mt-2 text-sm text-muted">
                {task.priority === "HIGH" ? "Prioridade alta" : task.priority === "LOW" ? "Prioridade baixa" : "Prioridade média"}
                {task.dueAt ? ` · ${formatWhen(task.dueAt)}` : ""}
                {isTaskOverdue(task, now) ? " · Atrasada" : ""}
              </p>
              {!archived && task.status !== "DONE" ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {task.status === "TODO" ? (
                    <form action={taskStatusAction.bind(null, projectId, task.id, "IN_PROGRESS")}>
                      <button className={buttonClass("secondary")} type="submit">Começar</button>
                    </form>
                  ) : null}
                  <form action={taskStatusAction.bind(null, projectId, task.id, "DONE")}>
                    <button className={buttonClass("primary")} type="submit">Concluir</button>
                  </form>
                  <form action={taskStatusAction.bind(null, projectId, task.id, "CANCELLED")}>
                    <button className={buttonClass("secondary")} type="submit">Cancelar</button>
                  </form>
                </div>
              ) : null}
              {!archived && task.status === "DONE" ? (
                <form action={taskStatusAction.bind(null, projectId, task.id, "TODO")} className="mt-3">
                  <button className={buttonClass("secondary")} type="submit">Reabrir</button>
                </form>
              ) : null}
              {!archived && task.dueAt && task.status !== "DONE" ? (
                <DueReminderForm projectId={projectId} taskId={task.id} title={task.title} dueAt={task.dueAt.toISOString()} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatWhen(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
