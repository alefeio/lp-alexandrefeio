"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { addCampaignBriefTask, saveCampaignBrief, syncCampaignBrief } from "@/lib/learning/actions";
import { DAILY_BUDGET_NOTE, OBSERVATION_DAYS, centsToReaisInput, dailyBudgetReferenceCents, type CampaignBrief } from "@/lib/learning/campaign-brief";
import type { CampaignBriefPanel } from "@/lib/learning/brief";
import { formatPriceCents } from "@/lib/learning/money";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { DESTINATION_LABEL, OBJECTIVE_LABEL } from "@/lib/project/labels";
import { DESTINATION_TYPES, PROJECT_OBJECTIVES, parseMoneyToCents } from "@/lib/project/schema";

export function CampaignBriefTool({
  panel,
  description,
  onSaved,
}: {
  panel: CampaignBriefPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="brief" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o Brief Inicial de Campanha na conta do aluno. Esta pré-visualização não cria projeto, resultado, tarefa nem progresso.
        </p>
        <fieldset disabled className="mt-5 space-y-4 opacity-70">
          <DemoField label="Oferta principal" value="Ultrassonografia obstétrica" />
          <DemoField label="Conversão principal" value="Envio do formulário de orçamento." />
          <DemoField label="Orçamento mensal" value="600" />
          <p className="text-sm leading-relaxed text-muted">{DAILY_BUDGET_NOTE}</p>
        </fieldset>
      </div>
    );
  }
  return <LiveBrief panel={panel} description={description} onSaved={onSaved} />;
}

function LiveBrief({
  panel,
  description,
  onSaved,
}: {
  panel: Extract<CampaignBriefPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = current.projects.find((item) => item.id === selected) ?? null;
  const saved = project?.brief && !editing ? project.brief : null;

  async function onSubmit(formData: FormData) {
    if (!project) return;
    setPending(true);
    setError(null);
    const result = await saveCampaignBrief(current.lessonSlug, current.blockKey, {
      projectId: project.id,
      offer: String(formData.get("offer") ?? ""),
      objective: String(formData.get("objective") ?? ""),
      primaryConversion: String(formData.get("primaryConversion") ?? ""),
      destination: String(formData.get("destination") ?? ""),
      monthlyBudget: String(formData.get("monthlyBudget") ?? ""),
      initialObservationDays: Number(formData.get("initialObservationDays")),
      validationBeforeLaunch: String(formData.get("validationBeforeLaunch") ?? ""),
    });
    setPending(false);
    if (!result.ok || !isLiveBrief(result.panel)) {
      setError(result.ok ? "Não foi possível salvar o brief." : result.message);
      return;
    }
    setCurrent(result.panel);
    setEditing(false);
    onSaved(result.snapshot);
  }

  async function onSync() {
    if (!project) return;
    setPending(true);
    setError(null);
    const result = await syncCampaignBrief(current.lessonSlug, project.id);
    setPending(false);
    if (!result.ok || !isLiveBrief(result.panel)) {
      setError(result.ok ? "Não foi possível atualizar o projeto." : result.message);
      return;
    }
    setCurrent(result.panel);
  }

  async function onPlan() {
    if (!project) return;
    setPending(true);
    setError(null);
    const result = await addCampaignBriefTask(current.lessonSlug, project.id);
    setPending(false);
    if (!result.ok || !isLiveBrief(result.panel)) {
      setError(result.ok ? "Não foi possível adicionar ao plano." : result.message);
      return;
    }
    setCurrent(result.panel);
  }

  return (
    <div id="brief" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated ? (
        <p className="mt-5 text-base leading-relaxed">Entre na sua conta para montar o brief deste negócio.</p>
      ) : null}
      {current.authenticated && current.projects.length === 0 ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Para montar o brief, primeiro precisamos saber qual negócio você quer planejar.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.createProjectHref}>
            Criar meu projeto
          </Link>
        </div>
      ) : null}
      {current.authenticated && current.projects.length > 0 ? (
        <div className="mt-5 space-y-4">
          {current.chooseProject ? (
            <label className="block text-sm font-medium" htmlFor="negocio-do-brief">
              Qual negócio você quer planejar?
              <select
                id="negocio-do-brief"
                className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setEditing(false);
                }}
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
          {project && saved ? <SavedBrief brief={saved} /> : null}
          {project && saved ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => setEditing(true)}>
                Editar brief
              </button>
              <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => void onSync()}>
                Atualizar meu projeto com estas informações
              </button>
              <Link className={buttonClass("secondary")} href={project.projectHref}>
                Ver meu projeto
              </Link>
              {project.hasPreparationTask ? (
                <p className="text-sm text-muted">A preparação desta campanha já está no plano.</p>
              ) : (
                <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => void onPlan()}>
                  Adicionar preparação da campanha ao meu plano
                </button>
              )}
            </div>
          ) : null}
          {project && !saved ? (
            <BriefForm key={`${project.id}-${editing ? "edit" : "new"}`} project={project} pending={pending} onSubmit={onSubmit} />
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BriefForm({
  project,
  pending,
  onSubmit,
}: {
  project: Extract<CampaignBriefPanel, { mode: "live" }>["projects"][number];
  pending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const source = project.brief ?? null;
  const [monthly, setMonthly] = useState(source ? centsToReaisInput(source.monthlyBudgetCents) : project.prefill.monthlyBudget);
  const daily = useMemo(() => {
    const cents = parseMoneyToCents(monthly);
    if (cents === "invalid" || cents == null || cents <= 0) return null;
    return dailyBudgetReferenceCents(cents);
  }, [monthly]);
  const context = contextLine(project.prefill);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      {context ? <p className="text-sm leading-relaxed text-muted">{context}</p> : null}
      <Field label="Oferta principal" name="offer" defaultValue={source?.offer ?? project.prefill.offer} maxLength={160} required />
      <SelectField label="Objetivo" name="objective" defaultValue={source?.objective ?? project.prefill.objective} options={PROJECT_OBJECTIVES} labels={OBJECTIVE_LABEL} />
      <Field
        label="Conversão principal"
        name="primaryConversion"
        defaultValue={source?.primaryConversion ?? ""}
        maxLength={200}
        required
        placeholder="Envio do formulário de orçamento."
      />
      <SelectField label="Destino" name="destination" defaultValue={source?.destination ?? project.prefill.destination} options={DESTINATION_TYPES} labels={DESTINATION_LABEL} />
      <label className="block text-sm font-medium">
        Orçamento mensal
        <input
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          name="monthlyBudget"
          inputMode="decimal"
          required
          value={monthly}
          onChange={(event) => setMonthly(event.target.value)}
          placeholder="600"
        />
      </label>
      <p className="text-sm leading-relaxed text-muted">
        Referência diária: {daily == null ? "informe um orçamento mensal maior que zero." : formatPriceCents(daily)}
      </p>
      <p className="text-sm leading-relaxed text-muted">{DAILY_BUDGET_NOTE}</p>
      <label className="block text-sm font-medium">
        Por quanto tempo você pretende observar este primeiro teste antes de uma revisão planejada?
        <select
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          name="initialObservationDays"
          defaultValue={String(source?.initialObservationDays ?? 14)}
          required
        >
          {OBSERVATION_DAYS.map((days) => (
            <option key={days} value={days}>
              {days} dias
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm leading-relaxed text-muted">Este prazo marca a primeira revisão planejada. Ele não impede corrigir um erro antes.</p>
      <label className="block text-sm font-medium">
        O que preciso validar antes de lançar
        <textarea
          className="mt-2 min-h-24 w-full rounded-lg border border-border bg-white px-3 py-3 text-base"
          name="validationBeforeLaunch"
          maxLength={500}
          required
          defaultValue={source?.validationBeforeLaunch ?? ""}
          placeholder="Confirmar se o formulário dispara o evento de conversão."
        />
      </label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar brief"}
      </button>
    </form>
  );
}

function SavedBrief({ brief }: { brief: CampaignBrief }) {
  return (
    <div className="border-t border-border pt-5">
      <p className="font-medium">Brief Inicial de Campanha</p>
      <dl className="mt-3 space-y-2 text-base">
        <Row term="Oferta" value={brief.offer} />
        <Row term="Objetivo" value={OBJECTIVE_LABEL[brief.objective]} />
        <Row term="Conversão principal" value={brief.primaryConversion} />
        <Row term="Destino" value={DESTINATION_LABEL[brief.destination]} />
        <Row term="Orçamento mensal" value={formatPriceCents(brief.monthlyBudgetCents)} />
        <Row term="Referência diária" value={formatPriceCents(brief.dailyBudgetReferenceCents)} />
        <Row term="Primeira revisão" value={`${brief.initialObservationDays} dias`} />
        <Row term="Antes de lançar preciso validar" value={brief.validationBeforeLaunch} />
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-muted">{DAILY_BUDGET_NOTE}</p>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  maxLength,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  name,
  defaultValue,
  options,
  labels,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly T[];
  labels: Record<T, string>;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base" name={name} defaultValue={defaultValue} required>
        <option value="">Escolha</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function DemoField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base" defaultValue={value} readOnly />
    </label>
  );
}

function contextLine(prefill: Extract<CampaignBriefPanel, { mode: "live" }>["projects"][number]["prefill"]): string | null {
  const parts: string[] = [];
  if (prefill.websiteUrl) parts.push(`site ${prefill.websiteUrl}`);
  if (prefill.serviceArea) parts.push(`área ${prefill.serviceArea}`);
  if (prefill.averageTicketCents != null) parts.push(`ticket médio ${formatPriceCents(prefill.averageTicketCents)}`);
  if (prefill.usesGoogleAds != null) parts.push(prefill.usesGoogleAds ? "já usa Google Ads" : "não usa Google Ads");
  if (prefill.usesMetaAds != null) parts.push(prefill.usesMetaAds ? "já usa Meta Ads" : "não usa Meta Ads");
  if (parts.length === 0) return null;
  return `Já registrado neste projeto: ${parts.join("; ")}.`;
}

function isLiveBrief(panel: { mode?: string; kind?: string } | null | undefined): panel is Extract<CampaignBriefPanel, { mode: "live" }> {
  return Boolean(panel && panel.mode === "live" && panel.kind === "brief");
}

function initialProject(panel: Extract<CampaignBriefPanel, { mode: "live" }>): string {
  if (panel.projects.length === 1) return panel.projects[0].id;
  if (panel.linkedProjectId && panel.projects.some((project) => project.id === panel.linkedProjectId)) return panel.linkedProjectId;
  return "";
}
