"use client";

import { useState } from "react";
import {
  addRecommendationTaskAction,
  addReviewReminderAction,
  createManualTaskAction,
  createReminderAction,
  lessonTaskAction,
  saveBudgetAction,
} from "@/lib/plan/actions";
import { buttonClass } from "@/lib/button-styles";

const fieldClass = "min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground";

function useForm(action: (formData: FormData) => Promise<{ ok: false; message: string } | undefined | void>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await action(formData);
    if (result && !result.ok) setError(result.message);
    setPending(false);
  }
  return { error, pending, onSubmit };
}

export function ManualTaskForm({ projectId, archived }: { projectId: string; archived: boolean }) {
  const form = useForm((formData) => createManualTaskAction(projectId, formData));
  if (archived) return null;
  return (
    <form action={form.onSubmit} className="mt-4 space-y-3">
      <label className="block text-sm font-medium" htmlFor="task-title">Nova ação</label>
      <input id="task-title" name="title" required minLength={2} maxLength={140} className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="task-description">Descrição, se quiser</label>
      <textarea id="task-description" name="description" maxLength={500} rows={2} className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="task-priority">Prioridade</label>
      <select id="task-priority" name="priority" defaultValue="MEDIUM" className={fieldClass}>
        <option value="HIGH">Alta</option>
        <option value="MEDIUM">Média</option>
        <option value="LOW">Baixa</option>
      </select>
      <label className="block text-sm font-medium" htmlFor="task-due">Prazo, se houver</label>
      <input id="task-due" name="dueAt" type="datetime-local" className={fieldClass} />
      {form.error ? <p role="alert" className="text-sm text-danger">{form.error}</p> : null}
      <button className={buttonClass("primary")} type="submit" disabled={form.pending}>Adicionar ação</button>
    </form>
  );
}

export function ReminderForm({ projectId, archived }: { projectId: string; archived: boolean }) {
  const form = useForm((formData) => createReminderAction(projectId, formData));
  if (archived) return null;
  return (
    <form action={form.onSubmit} className="mt-4 space-y-3">
      <label className="block text-sm font-medium" htmlFor="reminder-title">Lembrete</label>
      <input id="reminder-title" name="title" required minLength={2} maxLength={140} className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="reminder-when">Quando</label>
      <input id="reminder-when" name="remindAt" type="datetime-local" required className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="reminder-type">Tipo</label>
      <select id="reminder-type" name="type" defaultValue="PLANNING" className={fieldClass}>
        <option value="PLANNING">Planejamento</option>
        <option value="REVIEW">Revisão</option>
        <option value="DEADLINE">Prazo</option>
      </select>
      <label className="flex min-h-12 items-center gap-2 text-sm">
        <input name="emailEnabled" type="checkbox" />
        Avisar também por e-mail
      </label>
      {form.error ? <p role="alert" className="text-sm text-danger">{form.error}</p> : null}
      <button className={buttonClass("secondary")} type="submit" disabled={form.pending}>Criar lembrete</button>
    </form>
  );
}

export function BudgetForm({ projectId, archived }: { projectId: string; archived: boolean }) {
  const form = useForm((formData) => saveBudgetAction(projectId, formData));
  if (archived) return null;
  return (
    <form action={form.onSubmit} className="mt-4 space-y-3">
      <label className="block text-sm font-medium" htmlFor="balance">Saldo informado, em reais</label>
      <input id="balance" name="currentBalance" inputMode="decimal" required className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="daily">Quanto pretende usar por dia, em reais</label>
      <input id="daily" name="plannedDaily" inputMode="decimal" required className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="asof">Data desse saldo</label>
      <input id="asof" name="balanceAsOf" type="date" required className={fieldClass} />
      <label className="block text-sm font-medium" htmlFor="lead">Avisar com antecedência</label>
      <select id="lead" name="reminderLeadDays" defaultValue="2" className={fieldClass}>
        <option value="1">1 dia antes</option>
        <option value="2">2 dias antes</option>
        <option value="3">3 dias antes</option>
      </select>
      <label className="flex min-h-12 items-center gap-2 text-sm">
        <input name="emailReminderEnabled" type="checkbox" />
        E-mail nesse aviso
      </label>
      {form.error ? <p role="alert" className="text-sm text-danger">{form.error}</p> : null}
      <button className={buttonClass("secondary")} type="submit" disabled={form.pending}>Salvar planejamento</button>
    </form>
  );
}

export function RecommendationPlanButton({
  projectId,
  recommendationId,
  type,
  already,
}: {
  projectId: string;
  recommendationId: string;
  type: string;
  already: boolean;
}) {
  const review = useForm((formData) => addReviewReminderAction(projectId, recommendationId, formData));
  const add = useForm(async () => addRecommendationTaskAction(projectId, recommendationId));
  if (already) return <p className="mt-3 text-sm">Esta orientação já está no plano.</p>;
  if (type === "WAIT") {
    return (
      <form action={review.onSubmit} className="mt-3 space-y-3">
        <p className="text-sm leading-relaxed">Aguarde antes de mexer de novo. Se quiser, marque quando revisar.</p>
        <label className="block text-sm font-medium" htmlFor={`review-${recommendationId}`}>Lembrar-me de revisar</label>
        <input id={`review-${recommendationId}`} name="remindAt" type="datetime-local" required className={fieldClass} />
        {review.error ? <p role="alert" className="text-sm text-danger">{review.error}</p> : null}
        <button className={buttonClass("secondary")} type="submit" disabled={review.pending}>Lembrar-me de revisar</button>
      </form>
    );
  }
  return (
    <form action={add.onSubmit} className="mt-3">
      {add.error ? <p role="alert" className="mb-2 text-sm text-danger">{add.error}</p> : null}
      <button className={buttonClass("primary")} type="submit" disabled={add.pending}>Adicionar ao meu plano</button>
    </form>
  );
}

export function DueReminderForm({ projectId, taskId, title, dueAt }: { projectId: string; taskId: string; title: string; dueAt: string }) {
  const form = useForm((formData) => createReminderAction(projectId, formData));
  return (
    <form action={form.onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="dueAt" value={dueAt} />
      <input type="hidden" name="type" value="DEADLINE" />
      <label className="text-sm" htmlFor={`lead-${taskId}`}>Lembrar antes</label>
      <select id={`lead-${taskId}`} name="leadDays" defaultValue="1" className={fieldClass}>
        <option value="0">No dia</option>
        <option value="1">1 dia antes</option>
        <option value="2">2 dias antes</option>
        <option value="3">3 dias antes</option>
        <option value="7">7 dias antes</option>
      </select>
      {form.error ? <p role="alert" className="text-sm text-danger">{form.error}</p> : null}
      <button className={buttonClass("secondary")} type="submit" disabled={form.pending}>Criar lembrete</button>
    </form>
  );
}

export function LessonTaskForm({ projectId, lessonResultId }: { projectId: string; lessonResultId: string }) {
  const form = useForm((formData) => lessonTaskAction(projectId, lessonResultId, formData));
  return (
    <form action={form.onSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor={`lesson-task-${lessonResultId}`}>Próxima ação desta aula</label>
      <input id={`lesson-task-${lessonResultId}`} name="title" required minLength={2} maxLength={140} placeholder="Próxima ação desta aula" className={fieldClass} />
      {form.error ? <p role="alert" className="text-sm text-danger">{form.error}</p> : null}
      <button className={buttonClass("secondary")} type="submit" disabled={form.pending}>Adicionar ao plano</button>
    </form>
  );
}
