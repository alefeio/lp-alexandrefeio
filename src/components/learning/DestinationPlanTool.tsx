"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { addDestinationPlanTask, saveDestinationPlan, syncDestinationPlan } from "@/lib/learning/actions";
import {
  BUSINESS_OUTCOME_LABEL,
  BUSINESS_OUTCOME_METHODS,
  TRACKING_STATUS_LABEL,
  TRACKING_STATUSES,
  TRAFFIC_SOURCE_LABEL,
  TRAFFIC_SOURCE_METHODS,
  destinationReadiness,
  nextLessonSlugs,
  type DestinationPlan,
} from "@/lib/learning/destination-plan";
import { formatPriceCents } from "@/lib/learning/money";
import type { DestinationPlanPanel } from "@/lib/learning/measurement";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { DESTINATION_LABEL, OBJECTIVE_LABEL } from "@/lib/project/labels";
import { DESTINATION_TYPES, PROJECT_OBJECTIVES } from "@/lib/project/schema";

const fieldClass = "mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base";

export function DestinationPlanTool({
  panel,
  description,
  onSaved,
}: {
  panel: DestinationPlanPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="destino" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o Plano de Destino e Mensuração na conta do aluno. Esta pré-visualização não cria projeto, resultado, tarefa nem progresso.
        </p>
        <fieldset disabled className="mt-5 space-y-4 opacity-70">
          <DemoField label="CTA principal" value="Solicitar orçamento" />
          <DemoField label="Conversão principal" value="Envio concluído do formulário de orçamento." />
        </fieldset>
      </div>
    );
  }
  return <LivePlan panel={panel} description={description} onSaved={onSaved} />;
}

function LivePlan({
  panel,
  description,
  onSaved,
}: {
  panel: Extract<DestinationPlanPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const project = current.projects.find((item) => item.id === selected) ?? null;
  const saved = project?.plan && !editing ? project.plan : null;

  async function onSubmit(formData: FormData) {
    if (!project) return;
    setPending(true);
    setError(null);
    const result = await saveDestinationPlan(current.lessonSlug, current.blockKey, {
      projectId: project.id,
      destinationType: String(formData.get("destinationType") ?? ""),
      destinationUrl: String(formData.get("destinationUrl") ?? ""),
      primaryCta: String(formData.get("primaryCta") ?? ""),
      primaryConversion: String(formData.get("primaryConversion") ?? ""),
      offerIsClear: formData.get("offerIsClear") === "on",
      ctaIsVisible: formData.get("ctaIsVisible") === "on",
      mobileChecked: formData.get("mobileChecked") === "on",
      conversionPathTested: formData.get("conversionPathTested") === "on",
      trafficSourceMethod: String(formData.get("trafficSourceMethod") ?? ""),
      platformConversionStatus: String(formData.get("platformConversionStatus") ?? ""),
      analyticsStatus: String(formData.get("analyticsStatus") ?? ""),
      businessOutcomeMethod: String(formData.get("businessOutcomeMethod") ?? ""),
      preLaunchIssue: String(formData.get("preLaunchIssue") ?? ""),
    });
    setPending(false);
    if (!result.ok || !isLivePlan(result.panel)) {
      setError(result.ok ? "Não foi possível salvar o plano." : result.message);
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
    const result = await syncDestinationPlan(current.lessonSlug, project.id);
    setPending(false);
    if (!result.ok || !isLivePlan(result.panel)) {
      setError(result.ok ? "Não foi possível atualizar o projeto." : result.message);
      return;
    }
    setCurrent(result.panel);
  }

  async function onTask() {
    if (!project) return;
    setPending(true);
    setError(null);
    const result = await addDestinationPlanTask(current.lessonSlug, project.id);
    setPending(false);
    if (!result.ok || !isLivePlan(result.panel)) {
      setError(result.ok ? "Não foi possível adicionar ao plano." : result.message);
      return;
    }
    setCurrent(result.panel);
  }

  return (
    <div id="destino" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated ? <p className="mt-5 text-base leading-relaxed">Entre na sua conta para montar o plano deste negócio.</p> : null}
      {current.authenticated && current.projects.length === 0 ? (
        <div className="mt-5">
          <p className="text-base leading-relaxed">Para montar o plano, primeiro precisamos saber qual negócio você quer preparar.</p>
          <Link className={`${buttonClass("primary")} mt-4`} href={current.createProjectHref}>
            Criar meu projeto
          </Link>
        </div>
      ) : null}
      {current.authenticated && current.projects.length > 0 ? (
        <div className="mt-5 space-y-5">
          {current.chooseProject ? (
            <label className="block text-sm font-medium" htmlFor="negocio-do-plano">
              Qual negócio você quer preparar?
              <select
                id="negocio-do-plano"
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
          {project && !project.brief ? (
            <div className="rounded-lg border border-border px-4 py-4">
              <p className="text-sm leading-relaxed text-muted">
                Você ainda não possui um Brief Inicial de Campanha para este projeto. Pode continuar, mas a Aula 4 ajuda a definir oferta, objetivo e orçamento antes desta etapa.
              </p>
              <Link className={`${buttonClass("secondary")} mt-3`} href={current.lessonFourHref}>
                Ver Aula 4
              </Link>
            </div>
          ) : null}
          {project?.brief ? <BriefContext brief={project.brief} /> : null}
          {project && saved ? <SavedPlan plan={saved} projectName={project.name} /> : null}
          {project && saved ? (
            <div className="flex flex-col gap-3">
              <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => setEditing(true)}>
                Editar plano
              </button>
              <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => void onSync()}>
                Atualizar meu projeto com estas informações
              </button>
              <Link className={buttonClass("secondary")} href={project.projectHref}>
                Ver meu projeto
              </Link>
              {saved.readinessStatus === "NEEDS_PREPARATION" ? (
                project.hasPreparationTask ? (
                  <p className="text-sm text-muted">A preparação deste destino já está no plano.</p>
                ) : (
                  <button className={buttonClass("secondary")} type="button" disabled={pending} onClick={() => void onTask()}>
                    Adicionar preparação do destino ao meu plano
                  </button>
                )
              ) : null}
            </div>
          ) : null}
          {project && saved ? <NextStep hint={project.channelHint} lessons={current.nextLessons} /> : null}
          {project && !saved ? (
            <PlanForm key={`${project.id}-${editing ? "edit" : "new"}`} project={project} pending={pending} onSubmit={onSubmit} />
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

function BriefContext({ brief }: { brief: NonNullable<Extract<DestinationPlanPanel, { mode: "live" }>["projects"][number]["brief"]> }) {
  const objective = PROJECT_OBJECTIVES.includes(brief.objective as (typeof PROJECT_OBJECTIVES)[number])
    ? OBJECTIVE_LABEL[brief.objective as (typeof PROJECT_OBJECTIVES)[number]]
    : brief.objective;
  return (
    <div className="rounded-lg border border-border px-4 py-4 text-sm leading-relaxed">
      <p className="font-medium">Brief Inicial de Campanha</p>
      <p className="mt-2">Oferta: {brief.offer}</p>
      <p>Objetivo: {objective}</p>
      <p>Orçamento mensal: {formatPriceCents(brief.monthlyBudgetCents)}</p>
      <p>Primeira revisão: {brief.initialObservationDays} dias</p>
    </div>
  );
}

function PlanForm({
  project,
  pending,
  onSubmit,
}: {
  project: Extract<DestinationPlanPanel, { mode: "live" }>["projects"][number];
  pending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const source = project.plan;
  const checks = source?.destinationChecks;
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <Section title="Destino">
        <SelectField label="Para onde o tráfego vai" name="destinationType" defaultValue={source?.destinationType ?? project.prefill.destinationType} options={DESTINATION_TYPES} labels={DESTINATION_LABEL} />
        <Field label="Endereço do destino" name="destinationUrl" defaultValue={source?.destinationUrl ?? project.prefill.destinationUrl} maxLength={300} placeholder="https://" />
        <p className="text-sm leading-relaxed text-muted">Obrigatório para landing page e site. No WhatsApp, use um link https se tiver, ou deixe em branco.</p>
      </Section>
      <Section title="Ação">
        <Field label="CTA principal" name="primaryCta" defaultValue={source?.primaryCta ?? ""} maxLength={120} required placeholder="Solicitar orçamento" />
        <Field label="Conversão principal" name="primaryConversion" defaultValue={source?.primaryConversion ?? project.prefill.primaryConversion} maxLength={200} required placeholder="Envio concluído do formulário de orçamento." />
        <p className="text-sm leading-relaxed text-muted">O CTA convida. A conversão é a ação que você vai tratar como avanço.</p>
      </Section>
      <Section title="Verificações do destino">
        <p className="text-sm leading-relaxed text-muted">Marque só o que você mesmo conferiu. O sistema não auditou a página.</p>
        <Check name="offerIsClear" label="A oferta está clara no destino." defaultChecked={checks?.offerIsClear ?? false} />
        <Check name="ctaIsVisible" label="A principal ação está fácil de encontrar." defaultChecked={checks?.ctaIsVisible ?? false} />
        <Check name="mobileChecked" label="Eu conferi o destino em um celular." defaultChecked={checks?.mobileChecked ?? false} />
        <Check name="conversionPathTested" label="Eu testei o caminho completo até a conversão." defaultChecked={checks?.conversionPathTested ?? false} />
      </Section>
      <Section title="Origem">
        <SelectField label="Como saberei de onde a pessoa veio?" name="trafficSourceMethod" defaultValue={source?.trafficSourceMethod ?? ""} options={TRAFFIC_SOURCE_METHODS} labels={TRAFFIC_SOURCE_LABEL} />
      </Section>
      <Section title="Conversão na plataforma">
        <SelectField label="Rastreamento da conversão na plataforma" name="platformConversionStatus" defaultValue={source?.platformConversionStatus ?? ""} options={TRACKING_STATUSES} labels={TRACKING_STATUS_LABEL} />
        <p className="text-sm leading-relaxed text-muted">Ainda não configurado não impede sozinho este plano. Depende do canal.</p>
      </Section>
      <Section title="Análise do site">
        <SelectField label="Ferramenta de análise do site" name="analyticsStatus" defaultValue={source?.analyticsStatus ?? ""} options={TRACKING_STATUSES} labels={TRACKING_STATUS_LABEL} />
        <p className="text-sm leading-relaxed text-muted">Google Analytics ou equivalente. Não é obrigatório para toda campanha.</p>
      </Section>
      <Section title="Resultado comercial">
        <SelectField label="Depois que o contato acontece, onde você registra o resultado?" name="businessOutcomeMethod" defaultValue={source?.businessOutcomeMethod ?? ""} options={BUSINESS_OUTCOME_METHODS} labels={BUSINESS_OUTCOME_LABEL} />
      </Section>
      <Section title="Pendência">
        <label className="block text-sm font-medium">
          O que ainda preciso resolver antes de lançar
          <textarea className="mt-2 min-h-24 w-full rounded-lg border border-border bg-white px-3 py-3 text-base" name="preLaunchIssue" maxLength={500} defaultValue={source?.preLaunchIssue ?? ""} placeholder="Não testei o formulário." />
        </label>
      </Section>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar plano"}
      </button>
    </form>
  );
}

function SavedPlan({ plan, projectName }: { plan: DestinationPlan; projectName: string }) {
  const readiness = destinationReadiness(plan);
  const checks = [
    ["Oferta clara", plan.destinationChecks.offerIsClear],
    ["Ação fácil de encontrar", plan.destinationChecks.ctaIsVisible],
    ["Conferido no celular", plan.destinationChecks.mobileChecked],
    ["Caminho testado", plan.destinationChecks.conversionPathTested],
  ] as const;
  return (
    <div className="border-t border-border pt-5">
      <p className="font-medium">Plano de Destino e Mensuração</p>
      <dl className="mt-3 space-y-2 text-base">
        <Row term="Projeto" value={projectName} />
        <Row term="Destino" value={destinationLine(plan)} />
        <Row term="CTA principal" value={plan.primaryCta} />
        <Row term="Conversão principal" value={plan.primaryConversion} />
        <div>
          <dt className="text-sm text-muted">Verificações</dt>
          <dd>
            <ul className="mt-1 space-y-1">
              {checks.map(([label, done]) => (
                <li key={label}>
                  {done ? "✓" : "pendente"} {label}
                </li>
              ))}
            </ul>
          </dd>
        </div>
        <Row term="Origem do tráfego" value={TRAFFIC_SOURCE_LABEL[plan.trafficSourceMethod]} />
        <Row term="Conversão na plataforma" value={TRACKING_STATUS_LABEL[plan.platformConversionStatus]} />
        <Row term="Análise" value={TRACKING_STATUS_LABEL[plan.analyticsStatus]} />
        <Row term="Resultado comercial" value={BUSINESS_OUTCOME_LABEL[plan.businessOutcomeMethod]} />
      </dl>
      <p className="mt-4 font-medium">{readiness.status === "READY_TO_CONFIGURE" ? "Pronto para configurar a campanha" : "Existem pendências antes do lançamento"}</p>
      {readiness.issues.length > 0 ? (
        <div className="mt-2">
          <p className="text-sm text-muted">Seu plano possui {readiness.issues.length} {readiness.issues.length === 1 ? "pendência" : "pendências"} antes do lançamento.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base">
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NextStep({
  hint,
  lessons,
}: {
  hint: MeasurementHint;
  lessons: { slug: string; title: string }[];
}) {
  const slugs = nextLessonSlugs(hint);
  const suggested = slugs.flatMap((slug) => {
    const lesson = lessons.find((item) => item.slug === slug);
    return lesson ? [lesson] : [];
  });
  if (suggested.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Ainda não há uma indicação de canal para este projeto. Se o Google Ads fizer sentido, o próximo conteúdo é a campanha de Pesquisa. Se Meta Ads fizer mais sentido, siga para o módulo de Meta Ads. Os módulos são recomendados, não obrigatórios.
      </p>
    );
  }
  return (
    <div className="text-sm leading-relaxed">
      <p className="font-medium">Próximo conteúdo sugerido</p>
      <ul className="mt-2 space-y-2">
        {suggested.map((lesson) => (
          <li key={lesson.slug}>
            <Link className="underline underline-offset-4" href={`/aulas/${lesson.slug}`}>
              {lesson.title}
            </Link>
          </li>
        ))}
      </ul>
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

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 text-base leading-relaxed">
      <input className="mt-1" type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
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

function destinationLine(plan: DestinationPlan): string {
  const label = DESTINATION_LABEL[plan.destinationType];
  return plan.destinationUrl ? `${label} — ${plan.destinationUrl}` : label;
}

function isLivePlan(panel: { mode?: string; kind?: string } | null | undefined): panel is Extract<DestinationPlanPanel, { mode: "live" }> {
  return Boolean(panel && panel.mode === "live" && panel.kind === "destination");
}

function initialProject(panel: Extract<DestinationPlanPanel, { mode: "live" }>): string {
  if (panel.projects.length === 1) return panel.projects[0].id;
  if (panel.linkedProjectId && panel.projects.some((project) => project.id === panel.linkedProjectId)) return panel.linkedProjectId;
  return "";
}

type MeasurementHint = Extract<DestinationPlanPanel, { mode: "live" }>["projects"][number]["channelHint"];
