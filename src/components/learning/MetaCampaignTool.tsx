"use client";

import { useState } from "react";
import Link from "next/link";
import { saveMetaCampaign } from "@/lib/learning/actions";
import { buttonClass } from "@/lib/button-styles";
import { centsToReaisInput } from "@/lib/learning/campaign-brief";
import {
  AUDIENCE_APPROACH_LABEL,
  AUDIENCE_APPROACHES,
  BUDGET_STRATEGIES,
  BUDGET_STRATEGY_LABEL,
  BUSINESS_GOAL_LABEL,
  BUSINESS_GOALS,
  CONVERSION_PATH_LABEL,
  CONVERSION_PATH_NOTICE,
  CONVERSION_PATHS,
  FRAGMENTATION_NOTICE,
  META_OBJECTIVE_LABEL,
  META_OBJECTIVES,
  META_READINESS_LABEL,
  PLACEMENT_STRATEGIES,
  PLACEMENT_STRATEGY_LABEL,
  PLACEMENT_SURFACE_LABEL,
  PLACEMENT_SURFACES,
  formatMetaCampaignSummary,
  metaCampaignIssues,
  type MetaCampaignFormInput,
  type MetaCampaignPlan,
} from "@/lib/learning/meta-campaign";
import type { MetaCampaignPanel } from "@/lib/learning/meta-campaign-plan";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

const fieldClass = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

type DraftSet = MetaCampaignFormInput["adSets"][number];

function emptySet(): DraftSet {
  return {
    name: "",
    purpose: "",
    audienceApproaches: ["AUTOMATED_BROAD"],
    location: "",
    minimumAge: "",
    ageNotes: "",
    language: "",
    audienceSuggestions: [],
    customAudienceStrategy: "",
    lookalikeStrategy: "",
    exclusions: [],
    placementStrategy: "ADVANTAGE_PLUS",
    manualPlacementReason: "",
    surfaces: [],
    optimizationIntent: "",
    budgetAllocation: "",
  };
}

export function MetaCampaignTool({
  panel,
  description,
  onSaved,
}: {
  panel: MetaCampaignPanel | null;
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
  panel: Extract<MetaCampaignPanel, { mode: "live" }>;
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
  const [saved, setSaved] = useState<MetaCampaignPlan | null>(current?.plan ?? null);

  async function onSubmit(input: MetaCampaignFormInput) {
    setPending(true);
    setMessage("");
    const result = await saveMetaCampaign(panel.lessonSlug, panel.blockKey, input);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    onSaved(result.snapshot);
    const savedPanel = result.panel;
    const next = savedPanel && savedPanel.mode === "live" && "kind" in savedPanel && savedPanel.kind === "meta"
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
      {saved ? <Summary plan={saved} lessonTenReady={panel.lessonTenReady} lessonTenHref={panel.lessonTenHref} /> : null}
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
  prefill: Extract<MetaCampaignPanel, { mode: "live" }>["projects"][number]["prefill"];
  plan: MetaCampaignPlan | null;
  pending: boolean;
  onSubmit: (input: MetaCampaignFormInput) => Promise<void>;
}) {
  const [campaignName, setCampaignName] = useState(plan?.campaignName ?? prefill.campaignName);
  const [offer, setOffer] = useState(plan?.offer || prefill.offer);
  const [businessGoal, setBusinessGoal] = useState(plan?.businessGoal || prefill.businessGoal);
  const [businessGoalDetail, setBusinessGoalDetail] = useState(plan?.businessGoalDetail ?? "");
  const [desiredConversion, setDesiredConversion] = useState(plan?.desiredConversion || prefill.desiredConversion);
  const [metaObjective, setMetaObjective] = useState(plan?.metaObjective ?? "");
  const [conversionPath, setConversionPath] = useState(plan?.conversionPath ?? "");
  const [destination, setDestination] = useState(plan?.destination || prefill.destination);
  const [monthlyBudget, setMonthlyBudget] = useState(plan ? centsToReaisInput(plan.monthlyBudgetCents) : prefill.monthlyBudgetCents ? centsToReaisInput(prefill.monthlyBudgetCents) : "");
  const [budgetStrategy, setBudgetStrategy] = useState(plan?.budgetStrategy ?? "");
  const [sets, setSets] = useState<DraftSet[]>(plan ? plan.adSets.map(fromPlan) : [emptySet()]);
  const [preLaunchIssue, setPreLaunchIssue] = useState(plan?.preLaunchIssue ?? "");
  const [representsOffer, setRepresentsOffer] = useState(plan?.representsOffer ?? false);
  const [audienceLogicReviewed, setAudienceLogicReviewed] = useState(plan?.audienceLogicReviewed ?? false);
  const [placementsAndBudgetReviewed, setPlacementsAndBudgetReviewed] = useState(plan?.placementsAndBudgetReviewed ?? false);
  const [claimsReviewed, setClaimsReviewed] = useState(plan?.claimsReviewed ?? false);
  const [suggestionDraft, setSuggestionDraft] = useState<string[]>(sets.map(() => ""));

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
          businessGoalDetail,
          desiredConversion,
          metaObjective,
          conversionPath,
          destination,
          monthlyBudget,
          budgetStrategy,
          adSets: sets.map((set) => ({
            ...set,
            audienceSuggestions: set.audienceSuggestions.map((item) => item.trim()).filter(Boolean),
            exclusions: set.exclusions.map((item) => item.trim()).filter(Boolean),
          })),
          preLaunchIssue,
          representsOffer,
          audienceLogicReviewed,
          placementsAndBudgetReviewed,
          claimsReviewed,
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
      <label className="block">Detalhe do resultado<input className={fieldClass} value={businessGoalDetail} onChange={(event) => setBusinessGoalDetail(event.target.value)} /></label>
      <label className="block">Conversão desejada<input className={fieldClass} value={desiredConversion} onChange={(event) => setDesiredConversion(event.target.value)} /></label>
      <label className="block">
        Objetivo da Meta
        <select className={fieldClass} value={metaObjective} onChange={(event) => setMetaObjective(event.target.value as typeof metaObjective)}>
          <option value="">Escolha</option>
          {META_OBJECTIVES.map((objective) => <option key={objective} value={objective}>{META_OBJECTIVE_LABEL[objective]}</option>)}
        </select>
      </label>
      <label className="block">
        Caminho da conversão
        <select className={fieldClass} value={conversionPath} onChange={(event) => setConversionPath(event.target.value as typeof conversionPath)}>
          <option value="">Escolha</option>
          {CONVERSION_PATHS.map((path) => <option key={path} value={path}>{CONVERSION_PATH_LABEL[path]}</option>)}
        </select>
      </label>
      <p className="text-muted">{CONVERSION_PATH_NOTICE}</p>
      <label className="block">Destino<input className={fieldClass} value={destination} onChange={(event) => setDestination(event.target.value)} /></label>
      <label className="block">
        Orçamento mensal
        <input className={fieldClass} value={monthlyBudget} onChange={(event) => setMonthlyBudget(event.target.value)} />
      </label>
      {prefill.dailyBudgetReferenceCents != null ? <p className="text-muted">Referência diária da aula anterior: {centsToReaisInput(prefill.dailyBudgetReferenceCents)} reais em 30 dias. Não é o gasto da plataforma.</p> : null}
      <label className="block">
        Estratégia de orçamento
        <select className={fieldClass} value={budgetStrategy} onChange={(event) => setBudgetStrategy(event.target.value as typeof budgetStrategy)}>
          <option value="">Escolha</option>
          {BUDGET_STRATEGIES.map((strategy) => <option key={strategy} value={strategy}>{BUDGET_STRATEGY_LABEL[strategy]}</option>)}
        </select>
      </label>
      {sets.map((set, index) => (
        <fieldset key={`${projectId}-${index}`} className="space-y-3 rounded-lg border border-border p-4">
          <legend>Conjunto {index + 1}</legend>
          <label className="block">Nome<input className={fieldClass} value={set.name} onChange={(event) => updateSet(index, { name: event.target.value })} /></label>
          <label className="block">Propósito<input className={fieldClass} value={set.purpose} onChange={(event) => updateSet(index, { purpose: event.target.value })} /></label>
          <fieldset>
            <legend>Lógica de público</legend>
            {AUDIENCE_APPROACHES.map((approach) => (
              <label key={approach} className="mr-4 inline-flex gap-2">
                <input
                  type="checkbox"
                  checked={set.audienceApproaches.includes(approach)}
                  onChange={() => {
                    const selected = set.audienceApproaches.includes(approach);
                    const next = selected
                      ? set.audienceApproaches.filter((item) => item !== approach)
                      : [...set.audienceApproaches, approach];
                    if (next.length === 0 || next.length > 4) return;
                    updateSet(index, { audienceApproaches: next });
                  }}
                />
                {AUDIENCE_APPROACH_LABEL[approach]}
              </label>
            ))}
          </fieldset>
          <label className="block">Localização<input className={fieldClass} value={set.location} onChange={(event) => updateSet(index, { location: event.target.value })} /></label>
          <label className="block">Idade mínima, se houver motivo<input className={fieldClass} value={set.minimumAge} onChange={(event) => updateSet(index, { minimumAge: event.target.value })} /></label>
          <label className="block">Nota sobre idade<input className={fieldClass} value={set.ageNotes} onChange={(event) => updateSet(index, { ageNotes: event.target.value })} /></label>
          <label className="block">Idioma<input className={fieldClass} value={set.language} onChange={(event) => updateSet(index, { language: event.target.value })} /></label>
          <div>
            <p>Sinais de sugestão ({set.audienceSuggestions.length}/10)</p>
            <ul>{set.audienceSuggestions.map((item) => <li key={item}>{item}</li>)}</ul>
            <div className="flex gap-2">
              <input className={fieldClass} value={suggestionDraft[index] ?? ""} onChange={(event) => setSuggestionDraft(suggestionDraft.map((item, current) => current === index ? event.target.value : item))} />
              <button type="button" className={buttonClass("secondary")} onClick={() => {
                const next = (suggestionDraft[index] ?? "").trim();
                if (!next || set.audienceSuggestions.length >= 10) return;
                updateSet(index, { audienceSuggestions: [...set.audienceSuggestions, next] });
                setSuggestionDraft(suggestionDraft.map((item, current) => current === index ? "" : item));
              }}>Adicionar sinal</button>
            </div>
          </div>
          <label className="block">Fonte da audiência própria, se houver<input className={fieldClass} value={set.customAudienceStrategy} onChange={(event) => updateSet(index, { customAudienceStrategy: event.target.value })} /></label>
          <label className="block">Fonte da audiência semelhante, se houver<input className={fieldClass} value={set.lookalikeStrategy} onChange={(event) => updateSet(index, { lookalikeStrategy: event.target.value })} /></label>
          <label className="block">Exclusões, separadas por vírgula<input className={fieldClass} value={set.exclusions.join(", ")} onChange={(event) => updateSet(index, { exclusions: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
          <label className="block">
            Posicionamentos
            <select className={fieldClass} value={set.placementStrategy} onChange={(event) => updateSet(index, { placementStrategy: event.target.value as DraftSet["placementStrategy"] })}>
              {PLACEMENT_STRATEGIES.map((strategy) => <option key={strategy} value={strategy}>{PLACEMENT_STRATEGY_LABEL[strategy]}</option>)}
            </select>
          </label>
          {set.placementStrategy === "MANUAL" ? (
            <>
              <label className="block">Motivo do posicionamento manual<input className={fieldClass} value={set.manualPlacementReason} onChange={(event) => updateSet(index, { manualPlacementReason: event.target.value })} /></label>
              <fieldset>
                <legend>Superfícies planejadas</legend>
                {PLACEMENT_SURFACES.map((surface) => (
                  <label key={surface} className="mr-4 inline-flex gap-2">
                    <input
                      type="checkbox"
                      checked={set.surfaces.includes(surface)}
                      onChange={() => {
                        const next = set.surfaces.includes(surface)
                          ? set.surfaces.filter((item) => item !== surface)
                          : [...set.surfaces, surface];
                        updateSet(index, { surfaces: next });
                      }}
                    />
                    {PLACEMENT_SURFACE_LABEL[surface]}
                  </label>
                ))}
              </fieldset>
            </>
          ) : null}
          <label className="block">O que este conjunto deve otimizar<input className={fieldClass} value={set.optimizationIntent} onChange={(event) => updateSet(index, { optimizationIntent: event.target.value })} /></label>
        </fieldset>
      ))}
      {sets.length >= 4 ? <p>{FRAGMENTATION_NOTICE}</p> : null}
      {sets.length < 6 ? <button type="button" className={buttonClass("secondary")} onClick={() => { setSets([...sets, emptySet()]); setSuggestionDraft([...suggestionDraft, ""]); }}>Adicionar conjunto</button> : null}
      <label className="block">Pendência antes de configurar<textarea className={fieldClass} value={preLaunchIssue} onChange={(event) => setPreLaunchIssue(event.target.value)} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={representsOffer} onChange={(event) => setRepresentsOffer(event.target.checked)} />O plano representa a oferta.</label>
      <label className="flex gap-2"><input type="checkbox" checked={audienceLogicReviewed} onChange={(event) => setAudienceLogicReviewed(event.target.checked)} />A lógica de público foi revista.</label>
      <label className="flex gap-2"><input type="checkbox" checked={placementsAndBudgetReviewed} onChange={(event) => setPlacementsAndBudgetReviewed(event.target.checked)} />Posicionamentos e orçamento foram revistos.</label>
      <label className="flex gap-2"><input type="checkbox" checked={claimsReviewed} onChange={(event) => setClaimsReviewed(event.target.checked)} />Afirmações, área e condições foram revistas.</label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>{pending ? "Salvando" : "Salvar plano"}</button>
    </form>
  );
}

function Context({ prefill }: { prefill: Extract<MetaCampaignPanel, { mode: "live" }>["projects"][number]["prefill"] }) {
  const channel = prefill.channelHint === "meta"
    ? "O diagnóstico indicou Meta como contexto. Isso não bloqueia outras escolhas."
    : prefill.channelHint === "both"
      ? "O diagnóstico indicou Google e Meta. Use o que combinar com esta oferta."
      : prefill.channelHint === "google"
        ? "O diagnóstico indicou Google. Esta aula continua disponível."
        : prefill.channelHint === "none"
          ? "O diagnóstico não indicou um canal. A aula segue normalmente."
          : "Sem diagnóstico neste projeto. A aula segue normalmente.";
  return (
    <div className="space-y-1 text-muted">
      <p>{channel}</p>
      <p>{prefill.hasBrief ? "Oferta, resultado e orçamento vieram do mesmo projeto." : "Sem brief anterior. Preencha o que a campanha precisa."}</p>
      <p>{prefill.hasDestination ? "O destino deste projeto foi reutilizado." : "Sem plano de destino anterior."}</p>
    </div>
  );
}

function Summary({ plan, lessonTenReady, lessonTenHref }: { plan: MetaCampaignPlan; lessonTenReady: boolean; lessonTenHref: string }) {
  const issues = metaCampaignIssues(plan);
  return (
    <div className="space-y-2">
      {formatMetaCampaignSummary(plan).map((line) => <p key={line}>{line}</p>)}
      <p><strong>Status: </strong>{META_READINESS_LABEL[plan.readinessStatus]}</p>
      {issues.map((issue) => <p key={issue}>{issue}</p>)}
      {lessonTenReady ? <Link className="underline underline-offset-4" href={lessonTenHref}>Criar campanhas para leads e WhatsApp</Link> : <p>Criar campanhas para leads e WhatsApp. Disponível em breve.</p>}
    </div>
  );
}

function fromPlan(set: MetaCampaignPlan["adSets"][number]): DraftSet {
  return {
    name: set.name,
    purpose: set.purpose,
    audienceApproaches: set.audienceApproaches,
    location: set.location,
    minimumAge: set.minimumAge == null ? "" : String(set.minimumAge),
    ageNotes: set.ageNotes ?? "",
    language: set.language ?? "",
    audienceSuggestions: set.audienceSuggestions,
    customAudienceStrategy: set.customAudienceStrategy ?? "",
    lookalikeStrategy: set.lookalikeStrategy ?? "",
    exclusions: set.exclusions,
    placementStrategy: set.placementStrategy,
    manualPlacementReason: set.manualPlacementReason ?? "",
    surfaces: set.surfaces,
    optimizationIntent: set.optimizationIntent,
    budgetAllocation: set.budgetAllocation ?? "",
  };
}
