"use client";

import { useState } from "react";
import Link from "next/link";
import { saveLeadConversion } from "@/lib/learning/actions";
import { buttonClass } from "@/lib/button-styles";
import { centsToReaisInput } from "@/lib/learning/campaign-brief";
import {
  ADS_MANAGER_CONFIRMATION,
  BUSINESS_GOAL_LABEL,
  BUSINESS_GOALS,
  CAPACITY_LABEL,
  CAPACITY_STATUSES,
  CONVERSION_LOCATION_LABEL,
  CONVERSION_LOCATIONS,
  LEAD_PATH_LABEL,
  LEAD_PATHS,
  LEAD_READINESS_LABEL,
  MEASUREMENT_STAGES,
  META_OBJECTIVE_LABEL,
  META_OBJECTIVES,
  PERFORMANCE_GOAL_LABEL,
  PERFORMANCE_GOALS,
  STAGE_LABEL,
  formatLeadConversionSummary,
  leadConversionIssues,
  type LeadConversionFormInput,
  type LeadConversionPlan,
} from "@/lib/learning/lead-conversion";
import type { LeadConversionPanel } from "@/lib/learning/lead-conversion-plan";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

const fieldClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

type DraftSet = LeadConversionFormInput["adSets"][number];

function emptySet(): DraftSet {
  return { name: "", purpose: "", location: "", creativeAngle: "", offerMessage: "", cta: "" };
}

export function LeadConversionTool({
  panel,
  description,
  onSaved,
}: {
  panel: LeadConversionPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return <p className="mt-3 text-sm leading-relaxed text-muted">A prévia mostra a estrutura do plano. Ela não cria projeto, resultado nem progresso.</p>;
  }
  if (!panel.authenticated) {
    return <p className="mt-3 text-sm leading-relaxed">Entre na sua conta para salvar o plano neste projeto. A ferramenta não publica anúncio.</p>;
  }
  return <LiveForm panel={panel} description={description} onSaved={onSaved} />;
}

function LiveForm({
  panel,
  description,
  onSaved,
}: {
  panel: Extract<LeadConversionPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const initialId = panel.linkedProjectId && panel.projects.some((project) => project.id === panel.linkedProjectId)
    ? panel.linkedProjectId
    : panel.projects[0]?.id ?? "";
  const [projectId, setProjectId] = useState(initialId);
  const current = panel.projects.find((project) => project.id === projectId) ?? null;
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<LeadConversionPlan | null>(current?.plan ?? null);

  async function onSubmit(input: LeadConversionFormInput) {
    setPending(true);
    setMessage("");
    const result = await saveLeadConversion(panel.lessonSlug, panel.blockKey, input);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onSaved(result.snapshot);
    const savedPanel = result.panel;
    const next = savedPanel && savedPanel.mode === "live" && "kind" in savedPanel && savedPanel.kind === "leads"
      ? savedPanel.projects.find((project) => project.id === input.projectId)?.plan ?? null
      : null;
    setSaved(next);
  }

  return (
    <div className="mt-4 space-y-4 text-sm leading-relaxed">
      <p>{description}</p>
      {panel.projects.length === 0 ? (
        <p>
          Crie um projeto para guardar o plano. <Link className="underline underline-offset-4" href={panel.createProjectHref}>Novo projeto</Link>
        </p>
      ) : (
        <>
          {panel.chooseProject ? (
            <label className="block">
              Projeto
              <select className={fieldClass} value={projectId} onChange={(event) => { setProjectId(event.target.value); setSaved(panel.projects.find((project) => project.id === event.target.value)?.plan ?? null); }}>
                {panel.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
          ) : null}
          {current ? <PlanForm key={current.id} projectId={current.id} prefill={current.prefill} plan={saved ?? current.plan} pending={pending} onSubmit={onSubmit} /> : null}
        </>
      )}
      {message ? <p>{message}</p> : null}
      {saved ? <Summary plan={saved} lessonElevenReady={panel.lessonElevenReady} lessonElevenHref={panel.lessonElevenHref} /> : null}
    </div>
  );
}

function PlanForm({
  projectId,
  prefill,
  plan,
  pending,
  onSubmit,
}: {
  projectId: string;
  prefill: Extract<LeadConversionPanel, { mode: "live" }>["projects"][number]["prefill"];
  plan: LeadConversionPlan | null;
  pending: boolean;
  onSubmit: (input: LeadConversionFormInput) => Promise<void>;
}) {
  const [campaignName, setCampaignName] = useState(plan?.campaignName || prefill.campaignName);
  const [offer, setOffer] = useState(plan?.offer || prefill.offer);
  const [businessGoal, setBusinessGoal] = useState(plan?.businessGoal || prefill.businessGoal);
  const [leadPath, setLeadPath] = useState(plan?.leadPath || prefill.leadPath);
  const [platformObjective, setPlatformObjective] = useState(plan?.platformObjective || prefill.platformObjective);
  const [conversionLocation, setConversionLocation] = useState(plan?.conversionLocation ?? "");
  const [performanceGoal, setPerformanceGoal] = useState(plan?.performanceGoal ?? "");
  const [confirmed, setConfirmed] = useState(plan?.confirmedAgainstCurrentMetaUi ?? false);
  const [destination, setDestination] = useState(plan?.destination || prefill.destination);
  const [leadDefinition, setLeadDefinition] = useState(plan?.leadDefinition ?? "");
  const [qualifiedLeadDefinition, setQualifiedLeadDefinition] = useState(plan?.qualifiedLeadDefinition ?? "");
  const [sets, setSets] = useState<DraftSet[]>(plan?.adSets.length ? plan.adSets : prefill.adSets.length ? prefill.adSets : [emptySet()]);
  const [monthlyBudget, setMonthlyBudget] = useState(
    plan?.monthlyBudgetCents != null ? centsToReaisInput(plan.monthlyBudgetCents) : prefill.monthlyBudgetCents ? centsToReaisInput(prefill.monthlyBudgetCents) : "",
  );
  const [whatsappReady, setWhatsappReady] = useState(plan?.whatsappReady ?? false);
  const [initialMessage, setInitialMessage] = useState(plan?.initialMessage ?? "");
  const [questions, setQuestions] = useState<string[]>(plan?.qualificationQuestions ?? []);
  const [questionDraft, setQuestionDraft] = useState("");
  const [responseOwner, setResponseOwner] = useState(plan?.responseOwner ?? "");
  const [serviceHours, setServiceHours] = useState(plan?.serviceHours ?? "");
  const [followUpPlan, setFollowUpPlan] = useState(plan?.followUpPlan ?? "");
  const [successDefinition, setSuccessDefinition] = useState(plan?.successDefinition ?? "");
  const [formPurpose, setFormPurpose] = useState(plan?.formPurpose ?? "");
  const [formQuestions, setFormQuestions] = useState<string[]>(plan?.formQuestions ?? []);
  const [formDraft, setFormDraft] = useState("");
  const [completionAction, setCompletionAction] = useState(plan?.completionAction ?? "");
  const [followUpOwner, setFollowUpOwner] = useState(plan?.followUpOwner ?? "");
  const [formFollowUpPlan, setFormFollowUpPlan] = useState(plan?.formFollowUpPlan ?? "");
  const [privacyNoticeReady, setPrivacyNoticeReady] = useState(plan?.privacyNoticeReady ?? false);
  const [finalUrl, setFinalUrl] = useState(plan?.finalUrl || prefill.finalUrl);
  const [conversionEvent, setConversionEvent] = useState(plan?.conversionEvent || prefill.conversionEvent);
  const [formOrCta, setFormOrCta] = useState(plan?.formOrCta ?? "");
  const [measurementStatus, setMeasurementStatus] = useState(plan?.measurementStatus || prefill.measurementStatus);
  const [businessResultTracking, setBusinessResultTracking] = useState(plan?.businessResultTracking || prefill.businessResultTracking);
  const [pathNote, setPathNote] = useState(plan?.pathNote ?? "");
  const [source, setSource] = useState(plan?.contactFlow.source ?? "");
  const [initialResponse, setInitialResponse] = useState(plan?.contactFlow.initialResponse ?? "");
  const [qualification, setQualification] = useState(plan?.contactFlow.qualification ?? "");
  const [nextStep, setNextStep] = useState(plan?.contactFlow.nextStep ?? "");
  const [followUp, setFollowUp] = useState(plan?.contactFlow.followUp ?? "");
  const [finalOutcome, setFinalOutcome] = useState(plan?.contactFlow.finalOutcome ?? "");
  const [operationsOwner, setOperationsOwner] = useState(plan?.operationsPlan.responseOwner ?? "");
  const [serviceWindow, setServiceWindow] = useState(plan?.operationsPlan.serviceWindow ?? "");
  const [capacityStatus, setCapacityStatus] = useState(plan?.operationsPlan.capacityStatus ?? "");
  const [followUpMethod, setFollowUpMethod] = useState(plan?.operationsPlan.followUpMethod ?? "");
  const [stages, setStages] = useState<string[]>(plan?.measurementStages ?? []);
  const [creativeAngle, setCreativeAngle] = useState(plan?.creativeAngle ?? "");
  const [offerMessage, setOfferMessage] = useState(plan?.offerMessage ?? "");
  const [cta, setCta] = useState(plan?.cta ?? "");
  const [preLaunchIssue, setPreLaunchIssue] = useState(plan?.preLaunchIssue ?? "");
  const [actionReviewed, setActionReviewed] = useState(plan?.actionReviewed ?? false);
  const [platformReviewed, setPlatformReviewed] = useState(plan?.platformReviewed ?? false);
  const [channelReviewed, setChannelReviewed] = useState(plan?.channelReviewed ?? false);
  const [qualificationReviewed, setQualificationReviewed] = useState(plan?.qualificationReviewed ?? false);
  const [measurementReviewed, setMeasurementReviewed] = useState(plan?.measurementReviewed ?? false);
  const [capacityReviewed, setCapacityReviewed] = useState(plan?.capacityReviewed ?? false);
  const preserved = plan?.preservedAdSetCount ?? prefill.preservedAdSetCount;
  const setLimit = preserved > 0 ? preserved : 3;

  function updateSet(index: number, patch: Partial<DraftSet>) {
    setSets(sets.map((set, current) => (current === index ? { ...set, ...patch } : set)));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          projectId,
          campaignName,
          offer,
          businessGoal,
          leadPath,
          platformObjective,
          conversionLocation,
          performanceGoal,
          confirmedAgainstCurrentMetaUi: confirmed,
          destination,
          leadDefinition,
          qualifiedLeadDefinition,
          adSets: sets,
          preservedAdSetCount: preserved,
          monthlyBudget,
          whatsappReady,
          initialMessage,
          qualificationQuestions: questions,
          responseOwner,
          serviceHours,
          followUpPlan,
          successDefinition,
          formPurpose,
          formQuestions,
          completionAction,
          followUpOwner,
          formFollowUpPlan,
          privacyNoticeReady,
          finalUrl,
          conversionEvent,
          formOrCta,
          measurementStatus,
          businessResultTracking,
          pathNote,
          source,
          initialResponse,
          qualification,
          nextStep,
          followUp,
          finalOutcome,
          operationsOwner,
          serviceWindow,
          capacityStatus,
          followUpMethod,
          measurementStages: stages,
          creativeAngle,
          offerMessage,
          cta,
          preLaunchIssue,
          actionReviewed,
          platformReviewed,
          channelReviewed,
          qualificationReviewed,
          measurementReviewed,
          capacityReviewed,
        });
      }}
    >
      <Context prefill={prefill} />
      <label className="block">Campanha<input className={fieldClass} value={campaignName} onChange={(event) => setCampaignName(event.target.value)} /></label>
      <label className="block">Oferta<input className={fieldClass} value={offer} onChange={(event) => setOffer(event.target.value)} /></label>
      <label className="block">
        Objetivo do negócio
        <select className={fieldClass} value={businessGoal} onChange={(event) => setBusinessGoal(event.target.value as typeof businessGoal)}>
          <option value="">Escolha</option>
          {BUSINESS_GOALS.map((goal) => <option key={goal} value={goal}>{BUSINESS_GOAL_LABEL[goal]}</option>)}
        </select>
      </label>
      <label className="block">
        Caminho do contato
        <select className={fieldClass} value={leadPath} onChange={(event) => setLeadPath(event.target.value as typeof leadPath)}>
          <option value="">Escolha</option>
          {LEAD_PATHS.map((path) => <option key={path} value={path}>{LEAD_PATH_LABEL[path]}</option>)}
        </select>
      </label>
      <label className="block">
        Objetivo no Ads Manager
        <select className={fieldClass} value={platformObjective} onChange={(event) => setPlatformObjective(event.target.value as typeof platformObjective)}>
          <option value="">Escolha</option>
          {META_OBJECTIVES.map((objective) => <option key={objective} value={objective}>{META_OBJECTIVE_LABEL[objective]}</option>)}
        </select>
      </label>
      <label className="block">
        Local da conversão
        <select className={fieldClass} value={conversionLocation} onChange={(event) => setConversionLocation(event.target.value as typeof conversionLocation)}>
          <option value="">Escolha</option>
          {CONVERSION_LOCATIONS.map((location) => <option key={location} value={location}>{CONVERSION_LOCATION_LABEL[location]}</option>)}
        </select>
      </label>
      <label className="block">
        Meta de desempenho
        <select className={fieldClass} value={performanceGoal} onChange={(event) => setPerformanceGoal(event.target.value as typeof performanceGoal)}>
          <option value="">Escolha</option>
          {PERFORMANCE_GOALS.map((goal) => <option key={goal} value={goal}>{PERFORMANCE_GOAL_LABEL[goal]}</option>)}
        </select>
      </label>
      <p className="text-muted">{ADS_MANAGER_CONFIRMATION}</p>
      <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Conferi essa combinação na interface atual.</label>
      <label className="block">Destino<input className={fieldClass} value={destination} onChange={(event) => setDestination(event.target.value)} /></label>
      <label className="block">O que é um lead nesta campanha<input className={fieldClass} value={leadDefinition} onChange={(event) => setLeadDefinition(event.target.value)} /></label>
      <label className="block">O que é um lead qualificado<input className={fieldClass} value={qualifiedLeadDefinition} onChange={(event) => setQualifiedLeadDefinition(event.target.value)} /></label>
      {prefill.monthlyBudgetCents != null ? <p className="text-muted">Orçamento mensal já definido: {centsToReaisInput(prefill.monthlyBudgetCents)} reais. Não é uma previsão de leads.</p> : null}
      <label className="block">Orçamento mensal<input className={fieldClass} value={monthlyBudget} onChange={(event) => setMonthlyBudget(event.target.value)} /></label>
      {sets.map((set, index) => (
        <fieldset key={`${projectId}-${index}`} className="space-y-3 rounded-lg border border-border p-4">
          <legend>Conjunto {index + 1}</legend>
          <label className="block">Nome<input className={fieldClass} value={set.name} onChange={(event) => updateSet(index, { name: event.target.value })} /></label>
          <label className="block">Propósito<input className={fieldClass} value={set.purpose} onChange={(event) => updateSet(index, { purpose: event.target.value })} /></label>
          <label className="block">Localização<input className={fieldClass} value={set.location} onChange={(event) => updateSet(index, { location: event.target.value })} /></label>
          <label className="block">Ângulo do anúncio<input className={fieldClass} value={set.creativeAngle} onChange={(event) => updateSet(index, { creativeAngle: event.target.value })} /></label>
          <label className="block">Mensagem da oferta<input className={fieldClass} value={set.offerMessage} onChange={(event) => updateSet(index, { offerMessage: event.target.value })} /></label>
          <label className="block">Chamada para a ação<input className={fieldClass} value={set.cta} onChange={(event) => updateSet(index, { cta: event.target.value })} /></label>
        </fieldset>
      ))}
      {sets.length < setLimit ? <button type="button" className={buttonClass("secondary")} onClick={() => setSets([...sets, emptySet()])}>Adicionar conjunto</button> : null}
      {leadPath === "WHATSAPP" ? (
        <fieldset className="space-y-3">
          <legend>Fluxo de WhatsApp</legend>
          <label className="flex gap-2"><input type="checkbox" checked={whatsappReady} onChange={(event) => setWhatsappReady(event.target.checked)} />A conta comercial está conectada e pronta para receber conversa.</label>
          <label className="block">Mensagem inicial<input className={fieldClass} maxLength={300} value={initialMessage} onChange={(event) => setInitialMessage(event.target.value)} /></label>
          <QuestionList label="Perguntas de qualificação" items={questions} draft={questionDraft} onDraft={setQuestionDraft} onAdd={() => addQuestion(questions, questionDraft, setQuestions, setQuestionDraft)} />
          <label className="block">Quem responde<input className={fieldClass} value={responseOwner} onChange={(event) => setResponseOwner(event.target.value)} /></label>
          <label className="block">Horário de atendimento<input className={fieldClass} value={serviceHours} onChange={(event) => setServiceHours(event.target.value)} /></label>
          <label className="block">Plano de retorno<input className={fieldClass} value={followUpPlan} onChange={(event) => setFollowUpPlan(event.target.value)} /></label>
          <label className="block">O que conta como sucesso<input className={fieldClass} value={successDefinition} onChange={(event) => setSuccessDefinition(event.target.value)} /></label>
        </fieldset>
      ) : null}
      {leadPath === "INSTANT_FORM" ? (
        <fieldset className="space-y-3">
          <legend>Formulário instantâneo</legend>
          <label className="block">Finalidade do formulário<input className={fieldClass} value={formPurpose} onChange={(event) => setFormPurpose(event.target.value)} /></label>
          <QuestionList label="Perguntas do formulário" items={formQuestions} draft={formDraft} onDraft={setFormDraft} onAdd={() => addQuestion(formQuestions, formDraft, setFormQuestions, setFormDraft)} />
          <label className="block">O que acontece depois do envio<input className={fieldClass} value={completionAction} onChange={(event) => setCompletionAction(event.target.value)} /></label>
          <label className="block">Quem faz o retorno<input className={fieldClass} value={followUpOwner} onChange={(event) => setFollowUpOwner(event.target.value)} /></label>
          <label className="block">Como será o retorno<input className={fieldClass} value={formFollowUpPlan} onChange={(event) => setFormFollowUpPlan(event.target.value)} /></label>
          <label className="flex gap-2"><input type="checkbox" checked={privacyNoticeReady} onChange={(event) => setPrivacyNoticeReady(event.target.checked)} />A finalidade do dado está informada.</label>
        </fieldset>
      ) : null}
      {leadPath === "WEBSITE" ? (
        <fieldset className="space-y-3">
          <legend>Site</legend>
          <label className="block">Endereço da página<input className={fieldClass} value={finalUrl} onChange={(event) => setFinalUrl(event.target.value)} /></label>
          <label className="block">Evento ou conversão<input className={fieldClass} value={conversionEvent} onChange={(event) => setConversionEvent(event.target.value)} /></label>
          <label className="block">Formulário ou chamada da página<input className={fieldClass} value={formOrCta} onChange={(event) => setFormOrCta(event.target.value)} /></label>
          <label className="block">
            Mensuração do site
            <select className={fieldClass} value={measurementStatus} onChange={(event) => setMeasurementStatus(event.target.value as typeof measurementStatus)}>
              <option value="CONFIGURED">Configurada</option>
              <option value="NOT_CONFIGURED">Ainda não configurada</option>
              <option value="NOT_SURE">Ainda não sei</option>
            </select>
          </label>
          <label className="block">Como o resultado comercial é registrado<input className={fieldClass} value={businessResultTracking} onChange={(event) => setBusinessResultTracking(event.target.value)} /></label>
        </fieldset>
      ) : null}
      {leadPath === "OTHER" || leadPath === "OTHER_MESSAGING" ? (
        <label className="block">Como esse caminho vira um contato útil<textarea className={fieldClass} value={pathNote} onChange={(event) => setPathNote(event.target.value)} /></label>
      ) : null}
      <fieldset className="space-y-3">
        <legend>Fluxo de atendimento</legend>
        <label className="block">Origem<input className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)} /></label>
        <label className="block">Primeira resposta<input className={fieldClass} value={initialResponse} onChange={(event) => setInitialResponse(event.target.value)} /></label>
        <label className="block">Qualificação<input className={fieldClass} value={qualification} onChange={(event) => setQualification(event.target.value)} /></label>
        <label className="block">Próximo passo<input className={fieldClass} value={nextStep} onChange={(event) => setNextStep(event.target.value)} /></label>
        <label className="block">Retorno<input className={fieldClass} value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
        <label className="block">Resultado final<input className={fieldClass} value={finalOutcome} onChange={(event) => setFinalOutcome(event.target.value)} /></label>
      </fieldset>
      <fieldset className="space-y-3">
        <legend>Operação</legend>
        <label className="block">Quem atende<input className={fieldClass} value={operationsOwner} onChange={(event) => setOperationsOwner(event.target.value)} /></label>
        <label className="block">Janela de atendimento<input className={fieldClass} value={serviceWindow} onChange={(event) => setServiceWindow(event.target.value)} /></label>
        <label className="block">
          Capacidade
          <select className={fieldClass} value={capacityStatus} onChange={(event) => setCapacityStatus(event.target.value as typeof capacityStatus)}>
            <option value="">Escolha</option>
            {CAPACITY_STATUSES.map((status) => <option key={status} value={status}>{CAPACITY_LABEL[status]}</option>)}
          </select>
        </label>
        <label className="block">Como o retorno é feito<input className={fieldClass} value={followUpMethod} onChange={(event) => setFollowUpMethod(event.target.value)} /></label>
      </fieldset>
      <fieldset>
        <legend>Estágios que o negócio registra</legend>
        {MEASUREMENT_STAGES.map((stage) => (
          <label key={stage} className="mr-4 inline-flex gap-2">
            <input
              type="checkbox"
              checked={stages.includes(stage)}
              onChange={() => setStages(stages.includes(stage) ? stages.filter((item) => item !== stage) : [...stages, stage])}
            />
            {STAGE_LABEL[stage]}
          </label>
        ))}
      </fieldset>
      <label className="block">Ângulo geral do anúncio<input className={fieldClass} value={creativeAngle} onChange={(event) => setCreativeAngle(event.target.value)} /></label>
      <label className="block">Mensagem da oferta<input className={fieldClass} value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} /></label>
      <label className="block">Chamada principal<input className={fieldClass} value={cta} onChange={(event) => setCta(event.target.value)} /></label>
      <label className="block">Pendência antes de anunciar<textarea className={fieldClass} value={preLaunchIssue} onChange={(event) => setPreLaunchIssue(event.target.value)} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={actionReviewed} onChange={(event) => setActionReviewed(event.target.checked)} />Sei qual ação quero gerar.</label>
      <label className="flex gap-2"><input type="checkbox" checked={platformReviewed} onChange={(event) => setPlatformReviewed(event.target.checked)} />Revisei objetivo, local e meta de desempenho.</label>
      <label className="flex gap-2"><input type="checkbox" checked={channelReviewed} onChange={(event) => setChannelReviewed(event.target.checked)} />O canal está pronto.</label>
      <label className="flex gap-2"><input type="checkbox" checked={qualificationReviewed} onChange={(event) => setQualificationReviewed(event.target.checked)} />Defini a qualificação e o lead útil.</label>
      <label className="flex gap-2"><input type="checkbox" checked={measurementReviewed} onChange={(event) => setMeasurementReviewed(event.target.checked)} />Sei como registrar o resultado.</label>
      <label className="flex gap-2"><input type="checkbox" checked={capacityReviewed} onChange={(event) => setCapacityReviewed(event.target.checked)} />Consigo atender o volume esperado.</label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>{pending ? "Salvando" : "Salvar plano"}</button>
    </form>
  );
}

function addQuestion(items: string[], draft: string, setItems: (items: string[]) => void, setDraft: (value: string) => void) {
  const next = draft.trim();
  if (!next || items.length >= 5) return;
  setItems([...items, next]);
  setDraft("");
}

function QuestionList({
  label,
  items,
  draft,
  onDraft,
  onAdd,
}: {
  label: string;
  items: string[];
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <p>{label} ({items.length}/5)</p>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      <div className="flex gap-2">
        <input className={fieldClass} value={draft} onChange={(event) => onDraft(event.target.value)} />
        <button type="button" className={buttonClass("secondary")} onClick={onAdd}>Adicionar</button>
      </div>
    </div>
  );
}

function Context({ prefill }: { prefill: Extract<LeadConversionPanel, { mode: "live" }>["projects"][number]["prefill"] }) {
  const channel = prefill.channelHint === "meta"
    ? "O diagnóstico indicou Meta como contexto."
    : prefill.channelHint === "both"
      ? "O diagnóstico indicou Google e Meta."
      : prefill.channelHint === "google"
        ? "O diagnóstico indicou Google. Esta aula continua disponível."
        : "Sem bloqueio de canal neste projeto.";
  return (
    <div className="space-y-1 text-muted">
      <p>{channel}</p>
      <p>{prefill.hasBlueprint ? "Objetivo, destino, orçamento e conjuntos vieram do mesmo projeto." : "Sem plano de estrutura anterior. A aula de objetivo e público ajuda, mas não é obrigatória."}</p>
      <p>{prefill.hasDestination ? "O destino deste projeto foi reutilizado." : "Sem plano de destino anterior."}</p>
      <p>{prefill.desiredConversion ? `Conversão já descrita: ${prefill.desiredConversion}` : "A conversão desejada ainda não veio de outra aula."}</p>
      {prefill.operationsAttention ? <p>O diagnóstico apontou a operação como atenção. Confira quem atende antes de aumentar o volume.</p> : null}
    </div>
  );
}

function Summary({ plan, lessonElevenReady, lessonElevenHref }: { plan: LeadConversionPlan; lessonElevenReady: boolean; lessonElevenHref: string }) {
  const issues = leadConversionIssues(plan);
  return (
    <div className="space-y-2">
      {formatLeadConversionSummary(plan).map((line) => <p key={line}>{line}</p>)}
      <p><strong>Status: </strong>{LEAD_READINESS_LABEL[plan.readinessStatus]}</p>
      {issues.map((issue) => <p key={issue}>{issue}</p>)}
      {lessonElevenReady ? <Link className="underline underline-offset-4" href={lessonElevenHref}>Ler os números e encontrar o gargalo</Link> : <p>Leia os números e encontre o gargalo. Disponível em breve.</p>}
    </div>
  );
}
