"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { actionTypeLabel } from "@/lib/campaign-data/next-action";
import { openCampaignNextAction, saveCampaignNextAction } from "@/lib/learning/actions";
import type { CampaignNextActionPanel, NextActionView } from "@/lib/learning/campaign-next-action-plan";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export function CampaignNextActionTool({
  panel,
  description,
  onSaved,
}: {
  panel: CampaignNextActionPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [view, setView] = useState<NextActionView | null>(panel?.mode === "live" ? panel.view : null);
  const [projectId, setProjectId] = useState(panel?.mode === "live" ? panel.linkedProjectId ?? panel.projects[0]?.id ?? "" : "");
  const [importId, setImportId] = useState(panel?.mode === "live" ? panel.view?.diagnosis.campaignDataImportId ?? "" : "");
  const [choiceKey, setChoiceKey] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [createTask, setCreateTask] = useState(false);
  const [createReminder, setCreateReminder] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const selected = useMemo(() => {
    if (!view) return null;
    return view.choices.find((item) => `${item.actionType}:${item.title}` === choiceKey) ?? view.choices[0] ?? null;
  }, [choiceKey, view]);

  if (!panel || panel.mode === "preview") {
    return <p className="mt-3 text-sm leading-relaxed text-muted">A prévia não lê diagnóstico privado. No projeto, o plano usa o arquivo READY e o diagnóstico do mesmo projeto.</p>;
  }
  if (!panel.authenticated) {
    return (
      <p className="mt-3 text-sm">
        <Link className="underline underline-offset-4" href={`/entrar?next=${encodeURIComponent(`/aulas/${panel.lessonSlug}`)}`}>Entre na sua conta</Link> para montar o plano no seu projeto.
      </p>
    );
  }

  const project = panel.projects.find((item) => item.id === projectId) ?? null;
  const lessonSlug = panel.lessonSlug;
  const blockKey = panel.blockKey;

  async function readPlan() {
    if (!projectId || !importId) return;
    setPending(true);
    setMessage("");
    const opened = await openCampaignNextAction(projectId, importId);
    setPending(false);
    if (!opened.ok) {
      setMessage(opened.message);
      return;
    }
    setView(opened.view);
    setChoiceKey(`${opened.view.plan.actionType}:${opened.view.plan.title}`);
    setReviewDate("");
    setCreateTask(false);
    setCreateReminder(false);
  }

  async function save() {
    if (!projectId || !importId || !selected) return;
    setPending(true);
    setMessage("");
    const saved = await saveCampaignNextAction(lessonSlug, blockKey, {
      projectId,
      importId,
      actionType: selected.actionType,
      title: selected.title,
      reviewDate: reviewDate || null,
      createTask: createTask && (selected.actionType === "EXECUTE" || selected.actionType === "ANALYZE"),
      createReminder: createReminder && selected.actionType === "WAIT",
    });
    setPending(false);
    if (!saved.ok) {
      setMessage(saved.message);
      return;
    }
    if (saved.view && "plan" in saved.view) setView(saved.view);
    onSaved(saved.snapshot);
    setMessage(saved.overrideWarned ? "Plano registrado. Sua escolha diverge da sugestão e ficou anotada." : "Plano de próxima ação registrado neste projeto.");
  }

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm leading-relaxed text-muted">{description}</p>
      {panel.projects.length === 0 ? (
        <p className="text-sm">Nenhum projeto ativo. <Link className="underline underline-offset-4" href={panel.createProjectHref}>Criar projeto</Link></p>
      ) : null}
      {panel.chooseProject ? (
        <label className="block text-sm">
          Projeto
          <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" value={projectId} onChange={(event) => { setProjectId(event.target.value); setImportId(""); setView(null); }}>
            {panel.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      ) : null}
      {project ? (
        <label className="block text-sm">
          Arquivo READY
          <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" value={importId} onChange={(event) => { setImportId(event.target.value); setView(null); }}>
            <option value="">Escolha um arquivo</option>
            {project.imports.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fileName} · {item.rowCount ?? "?"} linhas{item.hasDiagnosisResult ? " · com diagnóstico" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {project && project.imports.length === 0 ? (
        <p className="text-sm">Este projeto ainda não tem arquivo READY. Envie os dados do projeto antes de montar o plano.</p>
      ) : null}
      <button type="button" className={buttonClass("secondary")} disabled={pending || !projectId || !importId} onClick={() => void readPlan()}>
        Montar plano
      </button>

      {view ? (
        <div className="space-y-4 rounded-lg border border-border bg-surface px-4 py-4">
          <p className="text-sm text-muted">{view.fileName}</p>
          <p className="text-sm"><span className="font-medium">Gargalo:</span> {view.bottleneckLabel} · {view.diagnosis.evidenceStrength}</p>
          <p className="text-sm leading-relaxed">{view.plan.reason}</p>
          <div>
            <p className="text-sm font-medium">Sugestão do sistema</p>
            <p className="mt-1 text-sm">{actionTypeLabel(view.plan.actionType)} · {view.plan.priority} · {view.plan.title}</p>
          </div>
          {view.plan.hypothesis ? <p className="text-sm leading-relaxed"><span className="font-medium">Hipótese:</span> {view.plan.hypothesis}</p> : null}
          <div>
            <p className="text-sm font-medium">O que observar</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {view.plan.observationPlan.whatToObserve.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Não mexer agora</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {view.plan.observationPlan.doNotChange.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
          {view.plan.caveats.length > 0 ? (
            <div>
              <p className="text-sm font-medium">Limitações</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                {view.plan.caveats.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sua decisão</legend>
            {view.choices.map((item) => {
              const key = `${item.actionType}:${item.title}`;
              return (
                <label key={key} className="flex gap-2 text-sm">
                  <input
                    type="radio"
                    name="next-action-choice"
                    checked={(choiceKey || `${view.plan.actionType}:${view.plan.title}`) === key}
                    onChange={() => setChoiceKey(key)}
                  />
                  <span>
                    <span className="font-medium">{actionTypeLabel(item.actionType)}</span>
                    {item.system ? " · sugerido" : ""} — {item.title}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {selected?.actionType === "WAIT" ? (
            <label className="block text-sm">
              Data de revisão
              <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
              {view.observationDays ? <span className="mt-1 block text-xs text-muted">No brief deste projeto, a janela sugerida foi de {view.observationDays} dias. Isso é contexto, não obrigação.</span> : null}
            </label>
          ) : null}

          {(selected?.actionType === "EXECUTE" || selected?.actionType === "ANALYZE") ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createTask} onChange={(event) => setCreateTask(event.target.checked)} />
              Adicionar ao meu plano
            </label>
          ) : null}
          {selected?.actionType === "WAIT" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={createReminder} onChange={(event) => setCreateReminder(event.target.checked)} />
              Criar lembrete para revisar
            </label>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass("primary")} disabled={pending || !selected} onClick={() => void save()}>
              Registrar plano
            </button>
            <Link className={buttonClass("secondary")} href={`/app/projetos/${projectId}/plano`}>Ver meu plano</Link>
            <Link className="text-sm underline underline-offset-4" href="/app/aprendizado">Ver meu aprendizado</Link>
            <Link className="text-sm text-muted underline underline-offset-4" href="/trafego-pago">Prefiro delegar a gestão</Link>
          </div>
          {view.saved ? <p className="text-sm text-muted">Já existe um plano salvo neste projeto. Registrar de novo atualiza o resultado com segurança.</p> : null}
        </div>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
