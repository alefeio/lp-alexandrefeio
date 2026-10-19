"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { bottleneckLabel } from "@/lib/campaign-data/diagnosis";
import { openCampaignDiagnosis, saveCampaignDiagnosis } from "@/lib/learning/actions";
import type { DiagnosisView, CampaignDiagnosisPanel } from "@/lib/learning/campaign-diagnosis-plan";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export function CampaignDiagnosisTool({
  panel,
  description,
  onSaved,
}: {
  panel: CampaignDiagnosisPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [view, setView] = useState<DiagnosisView | null>(panel?.mode === "live" ? panel.view : null);
  const [projectId, setProjectId] = useState(panel?.mode === "live" ? panel.linkedProjectId ?? panel.projects[0]?.id ?? "" : "");
  const [importId, setImportId] = useState(panel?.mode === "live" ? panel.view?.result.campaignDataImportId ?? "" : "");
  const [dimension, setDimension] = useState(view?.result.selectedDimension ?? "");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (!panel || panel.mode === "preview") {
    return <p className="mt-3 text-sm leading-relaxed text-muted">A prévia não lê arquivo privado. No projeto, o diagnóstico usa só um arquivo pronto.</p>;
  }
  if (!panel.authenticated) {
    return (
      <p className="mt-3 text-sm">
        <Link className="underline underline-offset-4" href={`/entrar?next=${encodeURIComponent(`/aulas/${panel.lessonSlug}`)}`}>Entre na sua conta</Link> para ler um arquivo do seu projeto.
      </p>
    );
  }

  const project = panel.projects.find((item) => item.id === projectId) ?? null;
  const activeDimension = view?.dimensions.find((item) => item.dimension === dimension) ?? view?.dimensions.find((item) => item.dimension === view.result.selectedDimension) ?? null;

  async function readFile() {
    if (!projectId || !importId) return;
    setPending(true);
    setMessage("");
    const opened = await openCampaignDiagnosis(projectId, importId);
    setPending(false);
    if (!opened.ok) {
      setMessage(opened.message);
      return;
    }
    setView(opened.view);
    setDimension(opened.view.result.selectedDimension ?? "");
  }

  async function save() {
    if (!projectId || !importId) return;
    setPending(true);
    setMessage("");
    const saved = await saveCampaignDiagnosis(panel && panel.mode === "live" ? panel.lessonSlug : "", panel && panel.mode === "live" ? panel.blockKey : "", projectId, importId);
    setPending(false);
    if (!saved.ok) {
      setMessage(saved.message);
      return;
    }
    if (saved.view && "lines" in saved.view) setView(saved.view);
    onSaved(saved.snapshot);
    setMessage("Diagnóstico registrado neste projeto.");
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
      {project && project.imports.length === 0 ? <p className="text-sm">Este projeto ainda não tem arquivo pronto.</p> : null}
      {project && project.imports.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            Arquivo pronto
            <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" value={importId} onChange={(event) => setImportId(event.target.value)}>
              <option value="">Escolha</option>
              {project.imports.map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
            </select>
          </label>
          <button className={buttonClass("secondary")} type="button" disabled={pending || !importId} onClick={() => void readFile()}>Ler arquivo</button>
        </div>
      ) : null}
      {view ? <DiagnosisBody view={view} dimension={activeDimension} onDimension={(value) => setDimension(value)} /> : null}
      {view ? <button className={buttonClass("primary")} type="button" disabled={pending} onClick={() => void save()}>Registrar diagnóstico</button> : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

function DiagnosisBody({
  view,
  dimension,
  onDimension,
}: {
  view: DiagnosisView;
  dimension: DiagnosisView["dimensions"][number] | null;
  onDimension: (value: string) => void;
}) {
  const period = view.result.period.start && view.result.period.end ? `${view.result.period.start} a ${view.result.period.end}` : "Este arquivo não informa o período.";
  return (
    <div className="space-y-5">
      <section>
        <h3 className="font-medium">Dados disponíveis neste arquivo</h3>
        <p className="mt-2 text-sm text-muted">{view.fileName} · {view.rowCount} linhas · {view.columnCount} colunas · {period}</p>
        {view.contextNote ? <p className="mt-2 text-sm">{view.contextNote}</p> : null}
        <ul className="mt-3 space-y-1 text-sm">
          {view.lines.map((line) => <li key={line.metric}>{line.available ? "✓" : "—"} {line.label}: {line.text}</li>)}
        </ul>
      </section>
      {view.dimensions.length > 0 ? (
        <section>
          <h3 className="font-medium">Analisar por</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {view.dimensions.map((item) => (
              <button key={item.dimension} className={buttonClass(dimension?.dimension === item.dimension ? "primary" : "secondary")} type="button" onClick={() => onDimension(item.dimension)}>
                {item.label}
              </button>
            ))}
          </div>
          {dimension ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">{dimension.label}</th>
                    <th className="py-2 pr-3 font-medium">Custo</th>
                    <th className="py-2 pr-3 font-medium">Cliques</th>
                    <th className="py-2 pr-3 font-medium">Conversões</th>
                    <th className="py-2 font-medium">Parte do custo</th>
                  </tr>
                </thead>
                <tbody>
                  {dimension.segments.map((segment) => (
                    <tr key={segment.key} className="border-b border-border">
                      <td className="py-2 pr-3">{segment.key}</td>
                      <td className="py-2 pr-3">{segment.spend ?? "—"}</td>
                      <td className="py-2 pr-3">{segment.clicks ?? "—"}</td>
                      <td className="py-2 pr-3">{segment.conversions ?? "—"}</td>
                      <td className="py-2">{segment.spendShare == null ? "—" : `${Math.round(segment.spendShare * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
      <section>
        <h3 className="font-medium">Diagnóstico</h3>
        <p className="mt-2 text-sm">Principal ponto de atenção: {bottleneckLabel(view.result.primaryBottleneck)}. Força: {strengthLabel(view.result.evidenceStrength)}.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {view.result.evidences.map((item, index) => <li key={`${item.code}-${index}`}>{item.explanation}</li>)}
        </ul>
        <h3 className="mt-4 font-medium">Limitações</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {view.result.caveats.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </div>
  );
}

function strengthLabel(value: string): string {
  if (value === "STRONG") return "forte";
  if (value === "MODERATE") return "moderada";
  return "limitada";
}
