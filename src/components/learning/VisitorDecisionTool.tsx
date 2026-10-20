"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import { saveVisitorDecision } from "@/lib/learning/actions";
import type { VisitorDecisionPanel } from "@/lib/learning/visitor-decision";
import { actionChangeNeeded, type PreferredConversionMethod } from "@/lib/landing-page/decision-journey";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

const STEPS = ["Projeto", "Conhecimento", "Decisão", "Dúvidas", "Avanço", "Etapas", "Revisão"] as const;

const AWARENESS = [
  ["LITTLE_OR_NOTHING", "Sabe quase nada sobre você"],
  ["KNOWS_THE_PROBLEM", "Já conhece o problema"],
  ["KNOWS_THE_SOLUTION", "Já conhece esse tipo de solução"],
  ["KNOWS_THE_OFFER", "Já conhece a sua oferta"],
  ["READY_TO_ACT", "Já está pronto para agir"],
  ["UNKNOWN", "Ainda não dá para saber"],
] as const;

const LEVELS = [
  ["LOW", "Baixa"],
  ["MEDIUM", "Média"],
  ["HIGH", "Alta"],
  ["UNKNOWN", "Ainda não sei"],
] as const;

const PROCESS = [
  ["YES", "Sim"],
  ["NO", "Não"],
  ["UNKNOWN", "Ainda não sei"],
] as const;

const PROOF = [
  ["HAS_PROOF", "Já possui provas reais"],
  ["NEEDS_PROOF", "Precisam ser preparadas"],
  ["NOT_RELEVANT", "Não são relevantes agora"],
  ["UNKNOWN", "Ainda não sei"],
] as const;

const METHODS = [
  ["WHATSAPP", "WhatsApp"],
  ["FORM", "Formulário"],
  ["BOOKING", "Agendamento"],
  ["PURCHASE", "Compra"],
  ["SIGN_UP", "Inscrição"],
  ["LINK", "Link"],
  ["OTHER", "Outro caminho"],
] as const;

const CATEGORIES = [
  ["", "Sem categoria"],
  ["PRICE", "Preço"],
  ["TRUST", "Confiança"],
  ["TIMING", "Prazo"],
  ["FIT", "Encaixe"],
  ["PROCESS", "Processo"],
  ["RISK", "Risco"],
  ["LOCATION", "Localização"],
  ["COMPARISON", "Comparação"],
  ["OTHER", "Outra"],
] as const;

const STAGES = [
  ["ARRIVAL", "Chega"],
  ["UNDERSTAND", "Precisa entender"],
  ["RECOGNIZE_VALUE", "Precisa perceber valor"],
  ["BUILD_TRUST", "Precisa confiar"],
  ["RESOLVE_OBJECTION", "Precisa resolver dúvidas"],
  ["ACT", "Age"],
] as const;

type StageType = (typeof STAGES)[number][0];
type ObjectionDraft = { objection: string; category: string; importance: "LOW" | "MEDIUM" | "HIGH" };

export function VisitorDecisionTool({
  panel,
  description,
  onSaved,
}: {
  panel: VisitorDecisionPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.preview) {
    return (
      <div id="jornada-do-visitante" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Esta pré-visualização não cria jornada, progresso nem resultado. O mapa real só é salvo na conta do aluno, no projeto que já tem brief.
        </p>
      </div>
    );
  }
  return <LiveJourney panel={panel} description={description} onSaved={onSaved} />;
}

function LiveJourney({
  panel,
  description,
  onSaved,
}: {
  panel: VisitorDecisionPanel;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const initial = panel.pages.find((item) => item.id === panel.suggestedPageId) ?? null;
  const [step, setStep] = useState(0);
  const [pageId, setPageId] = useState(initial?.id ?? "");
  const [revision, setRevision] = useState(initial?.draftRevision ?? 0);
  const [awareness, setAwareness] = useState("UNKNOWN");
  const [explanation, setExplanation] = useState("UNKNOWN");
  const [complexity, setComplexity] = useState("UNKNOWN");
  const [trust, setTrust] = useState("UNKNOWN");
  const [processNeed, setProcessNeed] = useState("UNKNOWN");
  const [proof, setProof] = useState("UNKNOWN");
  const [contact, setContact] = useState("UNKNOWN");
  const [method, setMethod] = useState<PreferredConversionMethod>(methodFor(initial?.primaryActionType ?? ""));
  const [objections, setObjections] = useState<ObjectionDraft[]>(
    (initial?.objections ?? []).map((objection) => ({ objection, category: "", importance: "MEDIUM" })),
  );
  const [loadedFor, setLoadedFor] = useState(initial?.id ?? "");
  const [stages, setStages] = useState<Record<StageType, { on: boolean; goal: string }>>({
    ARRIVAL: { on: true, goal: "Reconhecer onde chegou" },
    UNDERSTAND: { on: false, goal: "Entender a oferta" },
    RECOGNIZE_VALUE: { on: false, goal: "Perceber que isso serve para si" },
    BUILD_TRUST: { on: false, goal: "Confiar o suficiente para avançar" },
    RESOLVE_OBJECTION: { on: false, goal: "Resolver a dúvida principal" },
    ACT: { on: true, goal: "Saber qual é a ação" },
  });
  const [confirmChange, setConfirmChange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const page = panel.pages.find((item) => item.id === pageId) ?? null;

  function selectPage(nextId: string) {
    const next = panel.pages.find((item) => item.id === nextId);
    setPageId(nextId);
    setRevision(next?.draftRevision ?? 0);
    setConfirmChange(false);
    setSaved(false);
    if (next && next.id !== loadedFor) {
      setObjections(next.objections.map((objection) => ({ objection, category: "", importance: "MEDIUM" })));
      setLoadedFor(next.id);
      if (next.primaryActionType) setMethod(methodFor(next.primaryActionType));
    }
  }

  if (!panel.authenticated) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed">Entre na sua conta para registrar a jornada no projeto da landing page.</p>
        <Link className={`${buttonClass("primary")} mt-4 inline-flex`} href={authNextHref("/entrar", "/aulas/jornada-do-visitante")}>
          Entrar
        </Link>
      </div>
    );
  }

  if (panel.pages.length === 0 || panel.pages.every((item) => !item.hasBrief)) {
    return <MissingBrief description={description} />;
  }

  const needsChange = page?.hasBrief && page.primaryActionType ? actionChangeNeeded(intentFrom(page.primaryActionType), method) : false;

  async function save(confirmed: boolean) {
    if (!page?.hasBrief) return;
    setPending(true);
    setError(null);
    const decisionStages = STAGES.filter((stage) => stages[stage[0]].on && stages[stage[0]].goal.trim()).map((stage) => ({
      type: stage[0],
      goal: stages[stage[0]].goal.trim(),
    }));
    const result = await saveVisitorDecision(panel.blockKey, {
      landingPageProjectId: page.id,
      expectedRevision: revision,
      confirmActionChange: confirmed,
      decisionJourney: {
        version: 1,
        awarenessLevel: awareness,
        explanationNeed: explanation,
        decisionComplexity: complexity,
        trustNeed: trust,
        objectionAnalysis: objections
          .map((item) => ({
            objection: item.objection.trim(),
            importance: item.importance,
            ...(item.category ? { category: item.category } : {}),
          }))
          .filter((item) => item.objection),
        processNeedsExplanation: processNeed,
        proofSituation: proof,
        contactImportance: contact,
        preferredConversionMethod: method,
        decisionStages,
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.draftRevision) setRevision(result.draftRevision);
    setSaved(true);
    onSaved(result.snapshot);
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "font-semibold text-foreground" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="mt-5 space-y-2">
          <legend className="text-sm font-medium">Landing page com estratégia definida</legend>
          {panel.pages.map((item) => (
            <label key={item.id} className="flex items-start gap-2 text-sm">
              <input type="radio" name="lp" checked={pageId === item.id} onChange={() => selectPage(item.id)} />
              <span>
                {item.title}
                <span className="block text-muted">{item.hasBrief ? item.offerName : "Ainda sem brief"}</span>
              </span>
            </label>
          ))}
          {page && !page.hasBrief ? <MissingBrief description="" compact /> : null}
          {page?.hasBrief ? (
            <p className="text-sm leading-relaxed text-muted">
              Oferta: {page.offerName}. Público: {page.audience}. Ação atual: {page.primaryActionType}.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {step === 1 ? (
        <div className="mt-5">
          <Select label="O que a pessoa já sabe ao chegar" value={awareness} onChange={setAwareness} options={AWARENESS} />
          {page?.arrivalNote ? <p className="mt-3 text-sm leading-relaxed">Contexto já registrado: {page.arrivalNote}</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5 space-y-3">
          <Select label="Quanto precisa entender antes de agir" value={explanation} onChange={setExplanation} options={LEVELS} />
          <Select label="Complexidade da decisão" value={complexity} onChange={setComplexity} options={LEVELS} />
          <Select label="Quanto precisa confiar antes de agir" value={trust} onChange={setTrust} options={LEVELS} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-5 space-y-3">
          {objections.map((item, index) => (
            <div key={`${item.objection}-${index}`} className="space-y-2 rounded-md border border-border p-3">
              <input
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                value={item.objection}
                onChange={(event) => setObjections((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, objection: event.target.value } : row))}
              />
              <div className="flex gap-2">
                <select className="rounded-lg border border-border bg-white px-2 py-2 text-sm" value={item.category} onChange={(event) => setObjections((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, category: event.target.value } : row))}>
                  {CATEGORIES.map((option) => <option key={option[0]} value={option[0]}>{option[1]}</option>)}
                </select>
                <select className="rounded-lg border border-border bg-white px-2 py-2 text-sm" value={item.importance} onChange={(event) => setObjections((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, importance: event.target.value as ObjectionDraft["importance"] } : row))}>
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                </select>
                <button type="button" className="text-sm underline" onClick={() => setObjections((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remover</button>
              </div>
            </div>
          ))}
          {objections.length < 8 ? (
            <button type="button" className={buttonClass("secondary")} onClick={() => setObjections((current) => [...current, { objection: "", category: "", importance: "MEDIUM" }])}>
              Adicionar dúvida
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-5 space-y-3">
          <Select label="Precisa explicar como funciona?" value={processNeed} onChange={setProcessNeed} options={PROCESS} />
          <Select label="Situação das provas reais" value={proof} onChange={setProof} options={PROOF} />
          <Select label="Importância do contato humano" value={contact} onChange={setContact} options={LEVELS} />
          <Select label="Como a pessoa deve avançar" value={method} onChange={(value) => { setMethod(value as PreferredConversionMethod); setConfirmChange(false); }} options={METHODS} />
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-5 space-y-3">
          {STAGES.map((stage) => (
            <div key={stage[0]}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stages[stage[0]].on}
                  onChange={(event) => setStages((current) => ({ ...current, [stage[0]]: { ...current[stage[0]], on: event.target.checked } }))}
                />
                {stage[1]}
              </label>
              {stages[stage[0]].on ? (
                <input
                  className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                  value={stages[stage[0]].goal}
                  onChange={(event) => setStages((current) => ({ ...current, [stage[0]]: { ...current[stage[0]], goal: event.target.value } }))}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {step === 6 ? (
        <div className="mt-5 space-y-3 text-sm leading-relaxed">
          <JourneyMap stages={STAGES.filter((stage) => stages[stage[0]].on)} />
          <p><strong>Necessidade de explicação:</strong> {labelOf(LEVELS, explanation)}</p>
          <p><strong>Confiança necessária:</strong> {labelOf(LEVELS, trust)}</p>
          <p><strong>Complexidade:</strong> {labelOf(LEVELS, complexity)}</p>
          <p><strong>Contato humano:</strong> {contact === "HIGH" ? "Importante" : labelOf(LEVELS, contact)}</p>
          <p><strong>Provas:</strong> {labelOf(PROOF, proof)}</p>
          {needsChange ? (
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={confirmChange} onChange={(event) => setConfirmChange(event.target.checked)} />
              <span>A ação principal vai mudar. Confirmo essa troca no projeto.</span>
            </label>
          ) : null}
          <button type="button" className={buttonClass("primary")} disabled={pending || !page?.hasBrief || (needsChange && !confirmChange)} onClick={() => void save(confirmChange)}>
            Salvar meu mapa
          </button>
          {error === "A ação principal vai mudar. Confirme antes de salvar." ? (
            <p>A ação anterior foi mantida. Confirme a troca para salvar, ou volte o método para a ação atual.</p>
          ) : null}
          {saved ? <p>Mapa salvo neste projeto. Na próxima aula, essas decisões serão transformadas na estrutura da sua página.</p> : null}
        </div>
      ) : null}

      {error && error !== "A ação principal vai mudar. Confirme antes de salvar." ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        {step > 0 ? <button type="button" className={buttonClass("secondary")} onClick={() => setStep((current) => current - 1)}>Voltar</button> : null}
        {step < STEPS.length - 1 ? <button type="button" className={buttonClass("primary")} onClick={() => setStep((current) => current + 1)}>Continuar</button> : null}
      </div>
    </div>
  );
}

function methodFor(type: string): PreferredConversionMethod {
  if (type === "WHATSAPP") return "WHATSAPP";
  if (type === "FORM" || type === "FORM_ANCHOR") return "FORM";
  if (type === "EXTERNAL_URL") return "LINK";
  return "OTHER";
}

function intentFrom(type: string): { type: "WHATSAPP" } | { type: "FORM" } | { type: "EXTERNAL_URL" } | { type: "INTERNAL_ROUTE"; path?: string } | { type: "FORM_ANCHOR" } {
  if (type === "WHATSAPP" || type === "FORM" || type === "EXTERNAL_URL" || type === "FORM_ANCHOR") return { type };
  if (type === "INTERNAL_ROUTE") return { type: "INTERNAL_ROUTE" };
  return { type: "FORM" };
}

function MissingBrief({ description, compact = false }: { description: string; compact?: boolean }) {
  return (
    <div className={compact ? "text-sm leading-relaxed" : "mt-4 rounded-lg border border-border bg-surface px-5 py-5"}>
      {description ? <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p> : null}
      <p className={description ? "mt-4 text-sm leading-relaxed" : "text-sm leading-relaxed"}>Defina primeiro a estratégia básica desta página.</p>
      <Link className={`${buttonClass("primary")} mt-4 inline-flex`} href="/aulas/oferta-publico-acao-principal">
        Preparar minha página na Aula 4
      </Link>
    </div>
  );
}

function JourneyMap({ stages }: { stages: readonly (readonly [string, string])[] }) {
  return (
    <ol className="space-y-1">
      {stages.map((stage, index) => (
        <li key={stage[0]}>
          {stage[1]}
          {index < stages.length - 1 ? <span className="block text-muted">↓</span> : null}
        </li>
      ))}
    </ol>
  );
}

function labelOf(options: readonly (readonly [string, string])[], value: string) {
  return options.find((option) => option[0] === value)?.[1] ?? value;
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="block text-sm">
      {label}
      <select className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option[0]} value={option[0]}>{option[1]}</option>
        ))}
      </select>
    </label>
  );
}
