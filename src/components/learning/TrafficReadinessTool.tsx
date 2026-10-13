"use client";

import { useState } from "react";
import Link from "next/link";
import { RecommendationPlanButton } from "@/components/plan/PlanForms";
import { buttonClass } from "@/lib/button-styles";
import { linkLessonTool } from "@/lib/learning/actions";
import type { TrafficToolPanel, TrafficToolSummary } from "@/lib/learning/tool";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export function TrafficReadinessTool({
  panel,
  description,
  onLinked,
}: {
  panel: TrafficToolPanel | null;
  description: string;
  onLinked: (snapshot: LessonSnapshot, panel: Extract<TrafficToolPanel, { mode: "live" }>) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div className="mt-4 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco abre o diagnóstico da sua conta. Esta pré-visualização não cria diagnóstico nem grava progresso.
        </p>
      </div>
    );
  }
  return <LiveTool panel={panel} description={description} onLinked={onLinked} />;
}

function LiveTool({
  panel,
  description,
  onLinked,
}: {
  panel: Extract<TrafficToolPanel, { mode: "live" }>;
  description: string;
  onLinked: (snapshot: LessonSnapshot, panel: Extract<TrafficToolPanel, { mode: "live" }>) => void;
}) {
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(panel.projects.length === 1 ? panel.projects[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = current.projects.find((item) => item.id === selected) ?? null;

  async function applyLatest(summary: { id: string } | null, projectId: string) {
    if (!summary) return;
    setPending(true);
    setError(null);
    const result = await linkLessonTool(current.lessonSlug, current.blockKey, projectId, summary.id);
    setPending(false);
    if (!result.ok || !result.panel || result.panel.mode !== "live") {
      setError(result.ok ? "Não foi possível usar este diagnóstico." : result.message);
      return;
    }
    setCurrent(result.panel);
    onLinked(result.snapshot, result.panel);
  }

  return (
    <div id="diagnostico" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Crie sua conta para fazer seu diagnóstico e salvar o resultado.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.signupHref}>
            Criar conta e continuar
          </Link>
          <p className="mt-3 text-sm">
            <Link className="underline underline-offset-4" href={current.loginHref}>
              Já tenho conta
            </Link>
          </p>
        </div>
      ) : null}
      {current.authenticated && current.projects.length === 0 ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Para realizar o diagnóstico, primeiro precisamos saber qual negócio você quer analisar.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.createProjectHref}>
            Criar meu projeto
          </Link>
        </div>
      ) : null}
      {current.authenticated && current.projects.length > 0 ? (
        <div className="mt-5 space-y-4">
          {current.chooseProject ? (
            <label className="block text-sm font-medium" htmlFor="negocio-do-diagnostico">
              Qual negócio você quer analisar?
              <select
                id="negocio-do-diagnostico"
                className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Escolha um projeto</option>
                {current.projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-base">
              Projeto: <strong>{project?.name}</strong>
            </p>
          )}
          {project ? <ProjectActions project={project} pending={pending} onUse={(latest) => void applyLatest(latest, project.id)} /> : null}
        </div>
      ) : null}
      {current.linked ? <LinkedSummary summary={current.linked} /> : null}
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProjectActions({
  project,
  pending,
  onUse,
}: {
  project: Extract<TrafficToolPanel, { mode: "live" }>["projects"][number];
  pending: boolean;
  onUse: (latest: { id: string } | null) => void;
}) {
  return (
    <div className="space-y-3">
      {project.latest ? (
        <p className="text-sm leading-relaxed text-muted">
          Diagnóstico mais recente em {project.latest.completedAtLabel}: {project.latest.overallScore}/100. Principal gargalo: {project.latest.bottleneckLabel}.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row">
        {project.latest ? (
          <button className={buttonClass("primary")} type="button" disabled={pending} onClick={() => onUse(project.latest)}>
            Usar diagnóstico mais recente
          </button>
        ) : null}
        <Link className={buttonClass(project.latest ? "secondary" : "primary")} href={project.resumeHref ?? project.startHref}>
          {project.resumeHref ? "Continuar diagnóstico" : project.latest ? "Fazer novo diagnóstico" : "Fazer diagnóstico"}
        </Link>
      </div>
    </div>
  );
}

function LinkedSummary({ summary }: { summary: TrafficToolSummary }) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="font-medium">Diagnóstico concluído</p>
      <p className="mt-3 text-base">Prontidão: {summary.overallScore}/100</p>
      <p className="mt-2 text-base">Principal gargalo: {summary.bottleneckLabel}</p>
      <p className="mt-2 text-base">Próximo passo: {summary.nextStepTitle}</p>
      {summary.channelExplanation ? <p className="mt-2 text-base">{summary.channelExplanation}</p> : null}
      <p className="mt-4 text-sm">
        <Link className="underline underline-offset-4" href={summary.resultHref}>
          Ver diagnóstico completo
        </Link>
      </p>
      {summary.recommendation?.lesson ? (
        <p className="mt-4 text-sm leading-relaxed">
          Conteúdo recomendado para você:{" "}
          <Link className="underline underline-offset-4" href={summary.recommendation.lesson.href}>
            {summary.recommendation.lesson.title}
          </Link>
          {summary.recommendation.lesson.soon ? <span className="text-muted"> · Disponível em breve</span> : null}
        </p>
      ) : null}
      {summary.recommendation ? (
        summary.recommendation.type === "WAIT" ? (
          <p className="mt-4 text-sm">
            <Link className="underline underline-offset-4" href={summary.planHref}>
              Ver meu próximo passo
            </Link>
          </p>
        ) : (
          <RecommendationPlanButton
            projectId={summary.projectId}
            recommendationId={summary.recommendation.id}
            type={summary.recommendation.type}
            already={summary.recommendation.hasActiveTask}
          />
        )
      ) : null}
    </div>
  );
}
