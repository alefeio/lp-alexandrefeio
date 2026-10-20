"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { saveDigitalPresenceDecision } from "@/lib/learning/actions";
import type { DigitalPresencePanel } from "@/lib/learning/digital-presence";
import {
  CONFIDENCE_LABELS,
  CURRENT_STRUCTURES,
  CURRENT_STRUCTURE_LABELS,
  NEED_LEVELS,
  NEED_LEVEL_LABELS,
  OFFER_COUNTS,
  OFFER_COUNT_LABELS,
  RECOMMENDED_STRUCTURE_LABELS,
  SECONDARY_STRUCTURE_LABELS,
  actionLabel,
  anonymousJourneyPrefill,
  digitalPresenceLocalKey,
  parseDigitalPresenceForm,
  readLocalDigitalPresence,
  sourceLabels,
  writeLocalDigitalPresence,
  type DigitalPresenceDecision,
  type DigitalPresenceInputs,
} from "@/lib/learning/digital-presence-decision";
import { PRIMARY_ACTIONS, PRIMARY_ACTION_LABELS, TRAFFIC_SOURCES, TRAFFIC_SOURCE_LABELS } from "@/lib/learning/conversion-journey-map";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export function DigitalPresenceDecisionTool({
  panel,
  description,
  onSaved,
  onAnonymousSaved,
}: {
  panel: DigitalPresencePanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
  onAnonymousSaved?: (decision: DigitalPresenceDecision, blockKey: string) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="estrutura-digital" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava a estrutura digital ideal. Esta pré-visualização não cria progresso, resultado nem analytics.
        </p>
        <fieldset disabled className="mt-5 space-y-4 opacity-70">
          <DemoField label="Oferta" value="Móveis planejados" />
          <DemoField label="Quantidade de ofertas" value="Várias ofertas" />
          <DemoField label="Necessidade de explicação" value="Alta" />
          <DemoField label="Necessidade de confiança" value="Alta" />
          <DemoField label="Estrutura recomendada" value="Combinação de estruturas" />
        </fieldset>
      </div>
    );
  }
  return <LivePresence panel={panel} description={description} onSaved={onSaved} onAnonymousSaved={onAnonymousSaved} />;
}

function LivePresence({
  panel,
  description,
  onSaved,
  onAnonymousSaved,
}: {
  panel: Extract<DigitalPresencePanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
  onAnonymousSaved?: (decision: DigitalPresenceDecision, blockKey: string) => void;
}) {
  const localDecision = useMemo(() => (!panel.authenticated ? readLocalDigitalPresence() : null), [panel.authenticated]);
  const anonymousPrefill = useMemo(() => (!panel.authenticated ? anonymousJourneyPrefill() : {}), [panel.authenticated]);
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [anonymousDecision, setAnonymousDecision] = useState<DigitalPresenceDecision | null>(localDecision);

  const project = current.projects.find((item) => item.id === selected) ?? null;
  const savedAuth =
    current.authenticated && !editing
      ? project?.decision ?? (current.projects.length === 0 || !selected ? current.personalDecision : null)
      : null;
  const saved = current.authenticated ? savedAuth : anonymousDecision && !editing ? anonymousDecision : null;

  const formPrefill: Partial<DigitalPresenceInputs> & { offer?: string } = current.authenticated
    ? project?.prefill ?? current.personalPrefill
    : anonymousPrefill;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const sources = formData.getAll("trafficSources").map(String);
    const input = {
      offer: String(formData.get("offer") ?? ""),
      numberOfOffers: String(formData.get("numberOfOffers") ?? ""),
      explanationNeed: String(formData.get("explanationNeed") ?? ""),
      trustNeed: String(formData.get("trustNeed") ?? ""),
      trafficSources: sources,
      primaryAction: String(formData.get("primaryAction") ?? ""),
      currentStructure: String(formData.get("currentStructure") ?? ""),
      contentNeed: String(formData.get("contentNeed") ?? ""),
      projectId: selected || undefined,
    };

    if (!current.authenticated) {
      const parsed = parseDigitalPresenceForm(input);
      setPending(false);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      writeLocalDigitalPresence(parsed.decision);
      setAnonymousDecision(parsed.decision);
      setEditing(false);
      onAnonymousSaved?.(parsed.decision, current.blockKey);
      return;
    }

    const result = await saveDigitalPresenceDecision(current.lessonSlug, current.blockKey, input);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const nextPanel = result.panel;
    if (!isLivePresence(nextPanel)) {
      setError("Não foi possível salvar a decisão.");
      return;
    }
    setCurrent(nextPanel);
    setEditing(false);
    onSaved(result.snapshot);
  }

  return (
    <div id="estrutura-digital" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {!current.authenticated && Object.keys(anonymousPrefill).length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Se quiser mapear sua jornada antes, revise a Aula 1. Esta ferramenta também funciona sozinha.
        </p>
      ) : null}
      {current.authenticated && current.projects.length > 1 ? (
        <label className="mt-5 block text-sm font-medium" htmlFor="projeto-estrutura">
          Qual projeto você quer usar? (opcional)
          <select
            id="projeto-estrutura"
            className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setEditing(false);
            }}
          >
            <option value="">Sem projeto / decisão pessoal</option>
            {current.projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {current.authenticated && current.projects.length === 1 ? (
        <p className="mt-5 text-base">
          Projeto sugerido: <strong>{current.projects[0]?.name}</strong>
          <button className="ml-3 text-sm underline underline-offset-4" type="button" onClick={() => setSelected(selected ? "" : current.projects[0]!.id)}>
            {selected ? "Salvar só na decisão pessoal" : "Associar a este projeto"}
          </button>
        </p>
      ) : null}
      {current.authenticated && current.projects.length === 0 ? (
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Você pode concluir sem projeto.{" "}
          <Link className="underline underline-offset-4" href={current.createProjectHref}>
            Criar um projeto para continuar aplicando
          </Link>
          .
        </p>
      ) : null}

      {saved ? <SavedDecision decision={saved} /> : null}
      {saved ? (
        <button className={`${buttonClass("secondary")} mt-4`} type="button" disabled={pending} onClick={() => setEditing(true)}>
          Editar decisão
        </button>
      ) : null}
      {!saved || editing ? (
        <PresenceForm
          key={`${selected || "personal"}-${editing ? "edit" : "new"}-${digitalPresenceLocalKey()}`}
          initial={saved}
          prefill={formPrefill}
          pending={pending}
          onSubmit={onSubmit}
        />
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PresenceForm({
  initial,
  prefill,
  pending,
  onSubmit,
}: {
  initial: DigitalPresenceDecision | null;
  prefill: Partial<DigitalPresenceInputs> & { offer?: string };
  pending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const inputs = initial?.inputs;
  const [sources, setSources] = useState<string[]>(inputs?.trafficSources ?? prefill.trafficSources ?? []);

  function toggleSource(value: string) {
    setSources((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <Field label="Qual oferta ou serviço você está considerando?" name="offer" defaultValue={inputs?.offer ?? prefill.offer ?? ""} required maxLength={160} />
      <Select
        label="Quantas ofertas precisam ser apresentadas?"
        name="numberOfOffers"
        defaultValue={inputs?.numberOfOffers ?? ""}
        options={OFFER_COUNTS.map((value) => ({ value, label: OFFER_COUNT_LABELS[value] }))}
      />
      <Select
        label="Quanto a pessoa precisa entender antes de agir?"
        name="explanationNeed"
        defaultValue={inputs?.explanationNeed ?? ""}
        options={NEED_LEVELS.map((value) => ({
          value,
          label:
            value === "LOW"
              ? "Baixa — já chega pronta para conversar ou agir"
              : value === "MEDIUM"
                ? "Média — precisa de algum contexto"
                : value === "HIGH"
                  ? "Alta — precisa entender processo, diferenças ou riscos"
                  : NEED_LEVEL_LABELS[value],
        }))}
      />
      <Select
        label="Quanto você precisa demonstrar confiança antes de pedir a ação?"
        name="trustNeed"
        defaultValue={inputs?.trustNeed ?? ""}
        options={NEED_LEVELS.map((value) => ({
          value,
          label:
            value === "LOW"
              ? "Baixa — a ação pode vir rápido"
              : value === "MEDIUM"
                ? "Média — ajuda mostrar quem é e como funciona"
                : value === "HIGH"
                  ? "Alta — decisão de maior valor ou menos conhecida"
                  : NEED_LEVEL_LABELS[value],
        }))}
      />
      <fieldset>
        <legend className="text-sm font-medium">De onde o visitante chega? (pode marcar mais de uma)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TRAFFIC_SOURCES.map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-3 text-sm">
              <input
                type="checkbox"
                name="trafficSources"
                value={value}
                checked={sources.includes(value)}
                onChange={() => toggleSource(value)}
              />
              {TRAFFIC_SOURCE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <Select
        label="Qual ação principal queremos?"
        name="primaryAction"
        defaultValue={inputs?.primaryAction ?? prefill.primaryAction ?? ""}
        options={PRIMARY_ACTIONS.map((value) => ({ value, label: PRIMARY_ACTION_LABELS[value] }))}
      />
      <Select
        label="Qual é a estrutura atual?"
        name="currentStructure"
        defaultValue={inputs?.currentStructure ?? ""}
        options={CURRENT_STRUCTURES.map((value) => ({ value, label: CURRENT_STRUCTURE_LABELS[value] }))}
      />
      <Select
        label="O negócio precisa publicar/apresentar conteúdos e informações variadas ao longo do tempo?"
        name="contentNeed"
        defaultValue={inputs?.contentNeed ?? ""}
        options={NEED_LEVELS.map((value) => ({
          value,
          label:
            value === "LOW"
              ? "Baixa — pouca variação de conteúdo"
              : value === "MEDIUM"
                ? "Média — algumas informações ao longo do tempo"
                : value === "HIGH"
                  ? "Alta — conteúdos e informações variadas com frequência"
                  : NEED_LEVEL_LABELS[value],
        }))}
      />
      <button className={buttonClass("primary")} type="submit" disabled={pending || sources.length === 0}>
        {pending ? "Salvando…" : "Gerar minha estrutura digital ideal"}
      </button>
    </form>
  );
}

function SavedDecision({ decision }: { decision: DigitalPresenceDecision }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-white px-4 py-4">
      <p className="text-sm font-medium uppercase tracking-[0.14em] text-cta">Minha estrutura digital ideal</p>
      <p className="mt-3 text-base font-medium">{decision.offer}</p>
      <p className="mt-4 text-sm text-muted">Estrutura principal</p>
      <p className="text-lg font-semibold">{RECOMMENDED_STRUCTURE_LABELS[decision.recommendedStructure]}</p>
      {decision.secondaryStructures.length > 0 ? (
        <>
          <p className="mt-4 text-sm text-muted">Pode complementar com</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-base">
            {decision.secondaryStructures.map((item) => (
              <li key={item}>{SECONDARY_STRUCTURE_LABELS[item]}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-4 text-sm font-medium">Por quê</p>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-base leading-relaxed">
        {decision.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ol>
      {decision.caveats.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          {decision.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-sm leading-relaxed">
        <span className="font-medium">Consistência das informações:</span> {CONFIDENCE_LABELS[decision.confidenceLevel]}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Origens: {sourceLabels(decision.inputs.trafficSources)} · Ação: {actionLabel(decision.inputs.primaryAction)} · Atual:{" "}
        {CURRENT_STRUCTURE_LABELS[decision.inputs.currentStructure]}
      </p>
      <p className="mt-4 text-base leading-relaxed">
        <span className="font-medium">Próximo passo:</span> {decision.nextStep}
      </p>
    </div>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select name={name} required className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base" defaultValue={defaultValue}>
        <option value="">Escolha</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
      />
    </label>
  );
}

function DemoField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input disabled value={value} className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base" />
    </label>
  );
}

function initialProject(panel: Extract<DigitalPresencePanel, { mode: "live" }>) {
  if (panel.linkedProjectId) return panel.linkedProjectId;
  return "";
}

function isLivePresence(panel: unknown): panel is Extract<DigitalPresencePanel, { mode: "live" }> {
  return Boolean(
    panel &&
      typeof panel === "object" &&
      "mode" in panel &&
      panel.mode === "live" &&
      "kind" in panel &&
      panel.kind === "presence",
  );
}
