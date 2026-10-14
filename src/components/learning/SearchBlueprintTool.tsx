"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { DAILY_BUDGET_NOTE, dailyBudgetReferenceCents } from "@/lib/learning/campaign-brief";
import { formatPriceCents } from "@/lib/learning/money";
import { saveSearchBlueprint, syncSearchBlueprint } from "@/lib/learning/actions";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import type { SearchBlueprintPanel } from "@/lib/learning/search-campaign";
import {
  BRAND_STRATEGIES,
  BRAND_STRATEGY_LABEL,
  OPTIMIZATION_FOCUSES,
  OPTIMIZATION_FOCUS_LABEL,
  SEARCH_PARTNER_LABEL,
  SEARCH_PARTNER_DECISIONS,
  blueprintReadiness,
  type SearchAdGroup,
  type SearchBlueprint,
} from "@/lib/learning/search-blueprint";
import { DESTINATION_LABEL, OBJECTIVE_LABEL } from "@/lib/project/labels";
import { DESTINATION_TYPES, PROJECT_OBJECTIVES, parseMoneyToCents } from "@/lib/project/schema";

const fieldClass = "mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base";
const MISSING_BRIEF =
  "Você ainda não possui um Brief Inicial de Campanha para este projeto. Pode estruturar a campanha mesmo assim, mas a Aula 4 ajuda a definir oferta, objetivo e orçamento.";
const MISSING_PLAN =
  "Seu destino e sua mensuração ainda não foram planejados nesta plataforma. A Aula 5 ajuda a preparar essa parte antes do lançamento.";
const PLAN_PENDING =
  "Você pode estruturar sua campanha agora, mas ainda existem pendências de destino ou mensuração que devem ser resolvidas antes do lançamento.";
const META_NOTE =
  "Seu diagnóstico indicou Meta Ads como ponto de partida mais provável. Você pode estudar e planejar Google Search normalmente, mas vale revisar o motivo da indicação antes de investir.";

export function SearchBlueprintTool({
  panel,
  description,
  onSaved,
}: {
  panel: SearchBlueprintPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="blueprint" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o Blueprint de Campanha de Pesquisa na conta do aluno. Esta pré-visualização não cria projeto, resultado, tarefa nem progresso.
        </p>
        <fieldset disabled className="mt-5 space-y-4 opacity-70">
          <DemoField label="Nome da campanha" value="Pesquisa | Ultrassom Obstétrico | Belém" />
          <DemoField label="Grupo de anúncios" value="Ultrassom Obstétrico" />
        </fieldset>
      </div>
    );
  }
  return <LiveBlueprint panel={panel} description={description} onSaved={onSaved} />;
}

function LiveBlueprint({
  panel,
  description,
  onSaved,
}: {
  panel: Extract<SearchBlueprintPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = current.projects.find((item) => item.id === selected) ?? null;
  const saved = project?.blueprint && !editing ? project.blueprint : null;

  async function onSubmit(input: Parameters<typeof saveSearchBlueprint>[2]) {
    setPending(true);
    setError(null);
    const result = await saveSearchBlueprint(current.lessonSlug, current.blockKey, input);
    setPending(false);
    if (!result.ok || !isLiveBlueprint(result.panel)) {
      setError(result.ok ? "Não foi possível salvar o Blueprint." : result.message);
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
    const result = await syncSearchBlueprint(current.lessonSlug, project.id);
    setPending(false);
    if (!result.ok || !isLiveBlueprint(result.panel)) {
      setError(result.ok ? "Não foi possível atualizar o projeto." : result.message);
      return;
    }
    setCurrent(result.panel);
  }

  return (
    <div id="blueprint" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated ? <p className="mt-5 text-base leading-relaxed">Entre na sua conta para montar o Blueprint deste negócio.</p> : null}
      {current.authenticated && current.projects.length === 0 ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Para montar o Blueprint, primeiro precisamos saber qual negócio você quer preparar.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.createProjectHref}>
            Criar meu projeto
          </Link>
        </div>
      ) : null}
      {current.authenticated && current.projects.length > 0 ? (
        <div className="mt-5 space-y-5">
          {current.chooseProject ? (
            <label className="block text-sm font-medium" htmlFor="negocio-do-blueprint">
              Qual negócio você quer preparar?
              <select
                id="negocio-do-blueprint"
                className={fieldClass}
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
          {project ? <ContextNotes project={project} lessonFourHref={current.lessonFourHref} lessonFiveHref={current.lessonFiveHref} /> : null}
          {project && saved ? <SavedBlueprint blueprint={saved} projectName={project.name} /> : null}
          {project && saved ? (
            <div className="flex flex-col gap-3">
              <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => setEditing(true)}>
                Editar Blueprint
              </button>
              <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => void onSync()}>
                Atualizar meu projeto com estas informações
              </button>
              <Link className={buttonClass("secondary")} href={project.projectHref}>
                Ver meu projeto
              </Link>
              {saved.readinessStatus === "READY_FOR_KEYWORDS" ? (
                <Link className={buttonClass("primary")} href={current.keywordsHref}>
                  Seguir para palavras-chave
                </Link>
              ) : null}
            </div>
          ) : null}
          {project && !saved ? (
            <BlueprintForm key={`${project.id}-${editing ? "edit" : "new"}`} project={project} pending={pending} onSubmit={onSubmit} />
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

function ContextNotes({
  project,
  lessonFourHref,
  lessonFiveHref,
}: {
  project: Extract<SearchBlueprintPanel, { mode: "live" }>["projects"][number];
  lessonFourHref: string;
  lessonFiveHref: string;
}) {
  const channel =
    project.channelHint === "google"
      ? "Seu diagnóstico indicou Google Ads como ponto de partida para este projeto."
      : project.channelHint === "both"
        ? "Seu diagnóstico indicou o Google como uma das opções para este projeto."
        : project.channelHint === "meta"
          ? META_NOTE
          : null;
  return (
    <div className="space-y-3">
      {channel ? <p className="text-sm leading-relaxed text-muted">{channel}</p> : null}
      {!project.hasBrief ? (
        <Note href={lessonFourHref} label="Ver Aula 4">
          {MISSING_BRIEF}
        </Note>
      ) : null}
      {!project.hasDestinationPlan ? (
        <Note href={lessonFiveHref} label="Ver Aula 5">
          {MISSING_PLAN}
        </Note>
      ) : null}
      {project.destinationNeedsPreparation ? <Note href={lessonFiveHref} label="Ver Aula 5">{PLAN_PENDING}</Note> : null}
    </div>
  );
}

function Note({ href, label, children }: { href: string; label: string; children: string }) {
  return (
    <div className="rounded-lg border border-border px-4 py-4">
      <p className="text-sm leading-relaxed text-muted">{children}</p>
      <Link className={`${buttonClass("secondary")} mt-3`} href={href}>
        {label}
      </Link>
    </div>
  );
}

function BlueprintForm({
  project,
  pending,
  onSubmit,
}: {
  project: Extract<SearchBlueprintPanel, { mode: "live" }>["projects"][number];
  pending: boolean;
  onSubmit: (input: Parameters<typeof saveSearchBlueprint>[2]) => Promise<void>;
}) {
  const source = project.prefill;
  const [groups, setGroups] = useState<SearchAdGroup[]>(source.adGroups);
  const [monthly, setMonthly] = useState(source.monthlyBudget);
  const money = parseMoneyToCents(monthly);
  const daily = typeof money === "number" && money > 0 ? dailyBudgetReferenceCents(money) : null;

  function updateGroup(index: number, patch: Partial<SearchAdGroup>) {
    setGroups((current) => current.map((group, item) => (item === index ? { ...group, ...patch } : group)));
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onSubmit({
          projectId: project.id,
          campaignName: String(form.get("campaignName") ?? ""),
          offer: String(form.get("offer") ?? ""),
          businessObjective: String(form.get("businessObjective") ?? ""),
          primaryConversion: String(form.get("primaryConversion") ?? ""),
          destinationType: String(form.get("destinationType") ?? ""),
          destinationUrl: String(form.get("destinationUrl") ?? ""),
          locationPlan: String(form.get("locationPlan") ?? ""),
          languagePlan: String(form.get("languagePlan") ?? ""),
          monthlyBudget: monthly,
          optimizationFocus: String(form.get("optimizationFocus") ?? ""),
          brandStrategy: String(form.get("brandStrategy") ?? ""),
          searchPartnersDecision: String(form.get("searchPartnersDecision") ?? ""),
          adGroups: groups,
          preLaunchIssue: String(form.get("preLaunchIssue") ?? ""),
        });
      }}
    >
      <Section title="Campanha">
        <Field label="Nome da campanha" name="campaignName" defaultValue={source.campaignName} maxLength={120} required placeholder="Pesquisa | Ultrassom Obstétrico | Belém" />
        <p className="text-sm leading-relaxed text-muted">O nome organiza a campanha. Não é um fator de performance. Uma sugestão é Pesquisa | Oferta | Região.</p>
        <Field label="Oferta desta campanha" name="offer" defaultValue={source.offer} maxLength={200} required />
        <SelectField label="Objetivo" name="businessObjective" defaultValue={source.businessObjective} options={PROJECT_OBJECTIVES} labels={OBJECTIVE_LABEL} />
        <Field label="Conversão principal" name="primaryConversion" defaultValue={source.primaryConversion} maxLength={200} required />
        <SelectField label="Destino" name="destinationType" defaultValue={source.destinationType} options={DESTINATION_TYPES} labels={DESTINATION_LABEL} />
        <Field label="Endereço do destino" name="destinationUrl" defaultValue={source.destinationUrl} maxLength={300} placeholder="https://" />
        <p className="text-sm leading-relaxed text-muted">O que você ajustar aqui fica no Blueprint. O Plano de Destino da Aula 5 não muda sozinho.</p>
      </Section>
      <Section title="Região">
        <Field label="Em quais lugares meu cliente precisa estar para que esta campanha faça sentido?" name="locationPlan" defaultValue={source.locationPlan} maxLength={300} required placeholder="Belém e região, ou Brasil inteiro para atendimento online" />
        <p className="text-sm leading-relaxed text-muted">Cidade, estado, país ou uma área que você descreva. Idioma não substitui localização.</p>
        <Field label="Idioma, se quiser registrar" name="languagePlan" defaultValue={source.languagePlan} maxLength={80} placeholder="Português" />
      </Section>
      <Section title="Orçamento e otimização">
        <label className="block text-sm font-medium">
          Orçamento mensal
          <input className={fieldClass} inputMode="decimal" value={monthly} maxLength={20} placeholder="600" onChange={(event) => setMonthly(event.target.value)} />
        </label>
        {daily != null ? <p className="text-sm leading-relaxed">Referência diária: {formatPriceCents(daily)}. {DAILY_BUDGET_NOTE}</p> : <p className="text-sm leading-relaxed text-muted">{DAILY_BUDGET_NOTE}</p>}
        <SelectField label="Foco inicial" name="optimizationFocus" defaultValue={source.optimizationFocus} options={OPTIMIZATION_FOCUSES} labels={OPTIMIZATION_FOCUS_LABEL} />
        <p className="text-sm leading-relaxed text-muted">
          Antes de otimizar por conversões, confirme que a ação usada como conversão representa algo útil e está sendo registrada corretamente.
          {project.conversionSignalReady ? " A mensuração deste projeto está preparada. Conversões pode ser um foco coerente, se essa ação for útil." : ""}
        </p>
      </Section>
      <Section title="Marca e distribuição">
        <SelectField label="Se pessoas já pesquisam pelo nome da sua empresa, você pretende tratar essas buscas separadamente?" name="brandStrategy" defaultValue={source.brandStrategy} options={BRAND_STRATEGIES} labels={BRAND_STRATEGY_LABEL} />
        <SelectField label="Parceiros de pesquisa" name="searchPartnersDecision" defaultValue={source.searchPartnersDecision} options={SEARCH_PARTNER_DECISIONS} labels={SEARCH_PARTNER_LABEL} />
        <p className="text-sm leading-relaxed text-muted">Se você ainda não tem uma hipótese, pode registrar Ainda preciso decidir e revisar na configuração. Incluir ou excluir não é melhor em todos os casos.</p>
      </Section>
      <Section title="Grupos de anúncios">
        <p className="text-sm leading-relaxed text-muted">De 1 a 6 grupos. Cada um reúne buscas que podem receber a mesma mensagem e o mesmo destino. As palavras-chave ficam para a próxima aula.</p>
        {groups.map((group, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border px-4 py-4">
            <p className="text-sm font-medium">Grupo {index + 1}</p>
            <GroupField label="Nome" value={group.name} maxLength={100} placeholder="Ultrassom Obstétrico" onChange={(value) => updateGroup(index, { name: value })} />
            <GroupField label="Tema" value={group.theme} maxLength={200} placeholder="Exame de ultrassonografia obstétrica" onChange={(value) => updateGroup(index, { theme: value })} />
            <GroupField label="Intenção" value={group.intent} maxLength={300} placeholder="Pessoas procurando realizar ultrassonografia obstétrica." onChange={(value) => updateGroup(index, { intent: value })} />
            {groups.length > 1 ? (
              <button className={buttonClass("secondary")} type="button" onClick={() => setGroups((current) => current.filter((_, item) => item !== index))}>
                Remover grupo
              </button>
            ) : null}
          </div>
        ))}
        {groups.length < 6 ? (
          <button className={buttonClass("secondary")} type="button" onClick={() => setGroups((current) => [...current, { name: "", theme: "", intent: "" }])}>
            Adicionar grupo
          </button>
        ) : null}
      </Section>
      <Section title="Revisão">
        <label className="block text-sm font-medium">
          O que ainda preciso resolver antes de configurar esta campanha?
          <textarea className="mt-2 min-h-24 w-full rounded-lg border border-border bg-white px-3 py-3 text-base" name="preLaunchIssue" maxLength={500} defaultValue={source.preLaunchIssue} />
        </label>
      </Section>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar Blueprint"}
      </button>
    </form>
  );
}

function SavedBlueprint({ blueprint, projectName }: { blueprint: SearchBlueprint; projectName: string }) {
  const readiness = blueprintReadiness(blueprint);
  const objective = OBJECTIVE_LABEL[blueprint.businessObjective];
  const destination = DESTINATION_LABEL[blueprint.destinationType];
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Blueprint de Campanha de Pesquisa</h3>
      <dl className="space-y-3 text-base leading-relaxed">
        <Row term="Projeto" value={projectName} />
        <Row term="Campanha" value={blueprint.campaignName} />
        <Row term="Oferta" value={blueprint.offer} />
        <Row term="Objetivo" value={objective} />
        <Row term="Conversão" value={blueprint.primaryConversion} />
        <Row term="Destino" value={blueprint.destinationUrl ? `${destination} — ${blueprint.destinationUrl}` : destination} />
        <Row term="Região" value={blueprint.locationPlan} />
        {blueprint.languagePlan ? <Row term="Idioma" value={blueprint.languagePlan} /> : null}
        <Row term="Orçamento mensal" value={blueprint.monthlyBudgetCents == null ? "Ainda não definido" : formatPriceCents(blueprint.monthlyBudgetCents)} />
        <Row term="Referência diária" value={blueprint.dailyBudgetReferenceCents == null ? "Ainda não definida" : formatPriceCents(blueprint.dailyBudgetReferenceCents)} />
        <Row term="Foco de otimização" value={OPTIMIZATION_FOCUS_LABEL[blueprint.optimizationFocus]} />
        <Row term="Marca" value={BRAND_STRATEGY_LABEL[blueprint.brandStrategy]} />
        <Row term="Parceiros de pesquisa" value={SEARCH_PARTNER_LABEL[blueprint.searchPartnersDecision]} />
      </dl>
      <div>
        <p className="text-sm text-muted">Grupos</p>
        <ol className="mt-2 space-y-3">
          {blueprint.adGroups.map((group, index) => (
            <li key={`${group.name}-${index}`}>
              <p className="font-medium">{index + 1}. {group.name}</p>
              <p>Tema: {group.theme}</p>
              <p>Intenção: {group.intent}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="font-medium">{readiness.status === "READY_FOR_KEYWORDS" ? "Pronto para escolher palavras-chave" : "Existem pendências antes da próxima etapa"}</p>
      {readiness.issues.length > 0 ? (
        <div>
          <p>Seu Blueprint possui {readiness.issues.length} pendência{readiness.issues.length === 1 ? "" : "s"} antes da próxima etapa.</p>
          <ul className="mt-2 list-disc pl-5">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-4">
      <legend className="text-base font-medium">{title}</legend>
      {children}
    </fieldset>
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
      <input className={fieldClass} name={name} defaultValue={defaultValue} maxLength={maxLength} required={required} placeholder={placeholder} />
    </label>
  );
}

function GroupField({
  label,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input className={fieldClass} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
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
      <select className={fieldClass} name={name} defaultValue={defaultValue} required>
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
      <input className={fieldClass} defaultValue={value} readOnly />
    </label>
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

function initialProject(panel: Extract<SearchBlueprintPanel, { mode: "live" }>): string {
  if (panel.projects.length === 1) return panel.projects[0].id;
  if (panel.linkedProjectId && panel.projects.some((project) => project.id === panel.linkedProjectId)) return panel.linkedProjectId;
  return "";
}

function isLiveBlueprint(panel: { mode?: string; kind?: string } | null | undefined): panel is Extract<SearchBlueprintPanel, { mode: "live" }> {
  return Boolean(panel && panel.mode === "live" && panel.kind === "blueprint");
}
