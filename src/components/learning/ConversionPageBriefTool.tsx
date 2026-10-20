"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import { saveConversionBrief } from "@/lib/learning/actions";
import type { ConversionBriefPanel } from "@/lib/learning/conversion-page-brief";
import { TRAFFIC_SOURCE_LABELS, TRAFFIC_SOURCES } from "@/lib/learning/conversion-journey-map";
import { suggestLandingPageSlug } from "@/lib/landing-page/slug";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

const STEPS = ["Projeto", "Oferta", "Público", "Objetivo e ação", "Contexto", "Revisão"] as const;

const PAGE_GOALS = [
  ["GENERATE_LEAD", "Gerar um contato"],
  ["START_CONVERSATION", "Iniciar uma conversa"],
  ["REQUEST_QUOTE", "Receber pedidos de orçamento"],
  ["BOOK_APPOINTMENT", "Agendar um horário"],
  ["SELL", "Concluir uma venda"],
  ["SIGN_UP", "Receber uma inscrição"],
  ["INFORM_AND_ADVANCE", "Informar e levar ao próximo passo"],
  ["OTHER", "Outro objetivo desta página"],
] as const;

const ACTIONS = [
  ["WHATSAPP", "WhatsApp"],
  ["FORM", "Formulário"],
  ["EXTERNAL_URL", "Link externo"],
  ["INTERNAL_ROUTE", "Página interna"],
  ["FORM_ANCHOR", "Ir até o formulário da página"],
] as const;

const OUTCOMES = [
  ["LEAD", "Um contato"],
  ["QUOTE", "Um pedido de orçamento"],
  ["APPOINTMENT", "Um agendamento"],
  ["SALE", "Uma venda"],
  ["REGISTRATION", "Um cadastro"],
  ["CONVERSATION", "Uma conversa"],
  ["OTHER", "Outro resultado"],
] as const;

type ActionType = (typeof ACTIONS)[number][0];

export function ConversionPageBriefTool({
  panel,
  description,
  onSaved,
}: {
  panel: ConversionBriefPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  if (!panel || panel.preview) {
    return (
      <div id="brief-conversao" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Esta pré-visualização mostra a ferramenta, mas não cria projeto, progresso nem resultado. O brief real só é salvo com a conta do aluno.
        </p>
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
  panel: ConversionBriefPanel;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
}) {
  const signedOut = !panel.authenticated;
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"create" | "select">(panel.pages.length === 0 ? "create" : "select");
  const [pageId, setPageId] = useState(panel.pages.length === 1 ? panel.pages[0].id : "");
  const [revision, setRevision] = useState(panel.pages.length === 1 ? panel.pages[0].draftRevision : 0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [offerName, setOfferName] = useState("");
  const [offerSummary, setOfferSummary] = useState("");
  const [audience, setAudience] = useState("");
  const [situation, setSituation] = useState("");
  const [awareness, setAwareness] = useState("");
  const [problem, setProblem] = useState("");
  const [benefit, setBenefit] = useState("");
  const [pageGoal, setPageGoal] = useState("");
  const [pageGoalDetail, setPageGoalDetail] = useState("");
  const [actionType, setActionType] = useState<ActionType | "">("");
  const [actionLabel, setActionLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [internalPath, setInternalPath] = useState("");
  const [wantSecondary, setWantSecondary] = useState(false);
  const [secondaryType, setSecondaryType] = useState<ActionType | "">("");
  const [secondaryLabel, setSecondaryLabel] = useState("");
  const [outcome, setOutcome] = useState("");
  const [outcomeDetail, setOutcomeDetail] = useState("");
  const [objections, setObjections] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [arrivalNote, setArrivalNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const selectedPage = panel.pages.find((page) => page.id === pageId) ?? null;
  const futureSlug = mode === "select" ? selectedPage?.slug ?? "" : slug;

  function applyPrefill(nextProjectId: string) {
    const prefill = nextProjectId ? panel.prefillByProject[nextProjectId] : panel.standalonePrefill;
    if (!prefill) return;
    setNotes(prefill.notes);
    if (!offerName && prefill.offerName) {
      setOfferName(prefill.offerName);
      if (!slugTouched) {
        const suggested = suggestLandingPageSlug(prefill.offerName);
        setSlug(suggested);
        if (!title) setTitle(prefill.offerName);
      }
    }
    if (sources.length === 0 && prefill.trafficSources) setSources(prefill.trafficSources);
    if (!pageGoal && prefill.pageGoal) setPageGoal(prefill.pageGoal);
    if (!actionType && prefill.primaryActionType) setActionType(prefill.primaryActionType);
    if (!outcome && prefill.businessOutcome) setOutcome(prefill.businessOutcome);
    if (!arrivalNote && prefill.arrivalNote) setArrivalNote(prefill.arrivalNote);
  }

  function buildBrief() {
    const objectionList = objections
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
    const secondary = wantSecondary ? actionPayload(secondaryType, secondaryLabel, "", "", "") : undefined;
    const primary = actionPayload(actionType, actionLabel, phone, externalUrl, internalPath);
    return {
      version: 1 as const,
      offer: { name: offerName.trim(), ...(offerSummary.trim() ? { summary: offerSummary.trim() } : {}) },
      audience: {
        description: audience.trim(),
        ...(situation.trim() ? { situation: situation.trim() } : {}),
        ...(awareness.trim() ? { awareness: awareness.trim() } : {}),
      },
      problemOrContext: problem.trim(),
      primaryBenefit: benefit.trim(),
      pageGoal,
      ...(pageGoal === "OTHER" && pageGoalDetail.trim() ? { pageGoalDetail: pageGoalDetail.trim() } : {}),
      primaryAction: primary,
      ...(secondary && "type" in secondary && secondary.type ? { secondaryAction: secondary } : {}),
      businessOutcome: outcome,
      ...(outcome === "OTHER" && outcomeDetail.trim() ? { businessOutcomeDetail: outcomeDetail.trim() } : {}),
      objections: objectionList,
      arrivalContext: {
        trafficSources: sources,
        ...(arrivalNote.trim() ? { whatVisitorMayAlreadyKnow: arrivalNote.trim() } : {}),
      },
    };
  }

  async function save() {
    setPending(true);
    setError(null);
    const result = await saveConversionBrief(panel.blockKey, {
      mode,
      landingPageProjectId: mode === "select" ? pageId : undefined,
      expectedRevision: mode === "select" ? revision : undefined,
      title: title.trim() || offerName.trim(),
      slugSuggestion: slug,
      projectId: projectId || null,
      brief: buildBrief(),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.landingPageProjectId) setSavedId(result.landingPageProjectId);
    if (result.draftRevision) setRevision(result.draftRevision);
    if (result.landingPageProjectId) {
      setMode("select");
      setPageId(result.landingPageProjectId);
    }
    onSaved(result.snapshot);
  }

  if (signedOut) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed">Entre na sua conta para criar o projeto da landing page e salvar o brief.</p>
        <Link className={`${buttonClass("primary")} mt-4 inline-flex`} href={authNextHref("/entrar", "/aulas/oferta-publico-acao-principal")}>
          Entrar
        </Link>
      </div>
    );
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
      {notes.map((note) => (
        <p key={note} className="mt-4 rounded-md border border-border bg-white px-3 py-3 text-sm leading-relaxed">
          {note}
        </p>
      ))}

      {step === 0 ? (
        <div className="mt-5 space-y-4">
          {panel.pages.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Landing page</legend>
              {panel.pages.map((page) => (
                <label key={page.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="landing-page"
                    checked={mode === "select" && pageId === page.id}
                    onChange={() => {
                      setMode("select");
                      setPageId(page.id);
                      setRevision(page.draftRevision);
                      if (page.projectId) applyPrefill(page.projectId);
                    }}
                  />
                  <span>
                    {page.title}
                    <span className="block text-muted">alexandrefeio.com.br/p/{page.slug}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="landing-page" checked={mode === "create"} onChange={() => setMode("create")} />
            Criar uma nova landing page
          </label>
          {mode === "create" ? (
            <div className="space-y-3">
              <Field label="Nome do projeto" value={title} onChange={(value) => {
                setTitle(value);
                if (!slugTouched) setSlug(suggestLandingPageSlug(value));
              }} />
              <Field label="Endereço" value={slug} onChange={(value) => { setSlugTouched(true); setSlug(value); }} />
              <p className="text-sm text-muted">alexandrefeio.com.br/p/{slug || "minha-oferta"}</p>
              <p className="text-sm leading-relaxed">Este endereço só ficará público quando você publicar a página ao final da formação.</p>
              <label className="block text-sm">
                Projeto geral (opcional)
                <select className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2" value={projectId} onChange={(event) => { setProjectId(event.target.value); applyPrefill(event.target.value); }}>
                  <option value="">Sem projeto geral</option>
                  {panel.projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : futureSlug ? (
            <p className="text-sm leading-relaxed">Este endereço só ficará público quando você publicar a página ao final da formação.</p>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-5 space-y-3">
          <Field label="Oferta principal" value={offerName} onChange={(value) => {
            setOfferName(value);
            if (mode === "create" && !title) setTitle(value);
            if (mode === "create" && !slugTouched) setSlug(suggestLandingPageSlug(value));
          }} />
          <Field label="Resumo (opcional)" value={offerSummary} onChange={setOfferSummary} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-5 space-y-3">
          <Field label="Quem precisa disso?" value={audience} onChange={setAudience} />
          <Field label="Em que situação?" value={situation} onChange={setSituation} />
          <Field label="O que essa pessoa já sabe?" value={awareness} onChange={setAwareness} />
          <Field label="Problema, necessidade ou contexto" value={problem} onChange={setProblem} />
          <Field label="Benefício principal, se for verdadeiro" value={benefit} onChange={setBenefit} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-5 space-y-3">
          <Select label="Objetivo desta página" value={pageGoal} onChange={setPageGoal} options={PAGE_GOALS} />
          {pageGoal === "OTHER" ? <Field label="Qual objetivo?" value={pageGoalDetail} onChange={setPageGoalDetail} /> : null}
          <Select label="Ação principal" value={actionType} onChange={(value) => setActionType(value as ActionType)} options={ACTIONS} />
          <Field label="Rótulo da ação (opcional)" value={actionLabel} onChange={setActionLabel} />
          {actionType === "WHATSAPP" ? <Field label="WhatsApp (pode ficar para depois)" value={phone} onChange={setPhone} /> : null}
          {actionType === "EXTERNAL_URL" ? <Field label="Link (pode ficar para depois)" value={externalUrl} onChange={setExternalUrl} /> : null}
          {actionType === "INTERNAL_ROUTE" ? <Field label="Caminho interno (pode ficar para depois)" value={internalPath} onChange={setInternalPath} /> : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={wantSecondary} onChange={(event) => setWantSecondary(event.target.checked)} />
            Adicionar uma ação secundária
          </label>
          {wantSecondary ? (
            <>
              <Select label="Ação secundária" value={secondaryType} onChange={(value) => setSecondaryType(value as ActionType)} options={ACTIONS} />
              <Field label="Rótulo da ação secundária" value={secondaryLabel} onChange={setSecondaryLabel} />
            </>
          ) : null}
          <Select label="Se a pessoa agir, o que isso representa?" value={outcome} onChange={setOutcome} options={OUTCOMES} />
          {outcome === "OTHER" ? <Field label="Qual resultado?" value={outcomeDetail} onChange={setOutcomeDetail} /> : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="mt-5 space-y-3">
          <fieldset>
            <legend className="text-sm font-medium">De onde a pessoa pode chegar</legend>
            <div className="mt-2 space-y-1">
              {TRAFFIC_SOURCES.map((source) => (
                <label key={source} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sources.includes(source)}
                    onChange={(event) => {
                      setSources((current) => event.target.checked ? [...current, source] : current.filter((item) => item !== source));
                    }}
                  />
                  {TRAFFIC_SOURCE_LABELS[source]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="O que ela já pode saber ao entrar" value={arrivalNote} onChange={setArrivalNote} />
          <label className="block text-sm">
            O que pode fazer alguém hesitar (uma por linha, até 8)
            <textarea className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2" rows={4} value={objections} onChange={(event) => setObjections(event.target.value)} />
          </label>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="mt-5 space-y-2 text-sm leading-relaxed">
          <p><strong>Sua oferta.</strong> {offerName || "—"}</p>
          <p><strong>Seu público.</strong> {audience || "—"}</p>
          <p><strong>Objetivo da página.</strong> {labelOf(PAGE_GOALS, pageGoal)}</p>
          <p><strong>Ação principal.</strong> {labelOf(ACTIONS, actionType)}</p>
          <p><strong>Resultado esperado.</strong> {labelOf(OUTCOMES, outcome)}</p>
          <p><strong>Principais objeções.</strong> {objections.trim() || "Nenhuma informada."}</p>
          <button type="button" className={buttonClass("primary")} disabled={pending} onClick={() => void save()}>
            Salvar meu brief
          </button>
          {savedId ? <p>Brief salvo neste projeto. Você pode voltar e editar.</p> : null}
        </div>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex gap-3">
        {step > 0 ? (
          <button type="button" className={buttonClass("secondary")} onClick={() => setStep((current) => current - 1)}>Voltar</button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button type="button" className={buttonClass("primary")} onClick={() => setStep((current) => current + 1)}>Continuar</button>
        ) : null}
      </div>
    </div>
  );
}

function actionPayload(type: ActionType | "", label: string, phone: string, url: string, path: string) {
  if (!type) return { type: "" };
  const extra = label.trim() ? { label: label.trim() } : {};
  if (type === "WHATSAPP") return { type, ...(phone.trim() ? { phone: phone.trim() } : {}), ...extra };
  if (type === "EXTERNAL_URL") return { type, ...(url.trim() ? { url: url.trim() } : {}), ...extra };
  if (type === "INTERNAL_ROUTE") return { type, ...(path.trim() ? { path: path.trim() } : {}), ...extra };
  if (type === "FORM_ANCHOR") return { type, ...extra };
  return { type: "FORM" as const, ...extra };
}

function labelOf(options: readonly (readonly [string, string])[], value: string) {
  return options.find((option) => option[0] === value)?.[1] ?? "—";
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      {label}
      <input className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
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
        <option value="">Escolha</option>
        {options.map((option) => (
          <option key={option[0]} value={option[0]}>{option[1]}</option>
        ))}
      </select>
    </label>
  );
}
