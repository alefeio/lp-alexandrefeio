"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { saveConversionJourneyMap } from "@/lib/learning/actions";
import type { ConversionJourneyPanel } from "@/lib/learning/conversion-journey";
import {
  BUSINESS_OUTCOMES,
  BUSINESS_OUTCOME_LABELS,
  DESTINATION_TYPES,
  DESTINATION_TYPE_LABELS,
  FRICTION_OPTIONS,
  FRICTION_LABELS,
  PRIMARY_ACTIONS,
  PRIMARY_ACTION_LABELS,
  TRAFFIC_SOURCES,
  TRAFFIC_SOURCE_LABELS,
  actionLabel,
  frictionLabel,
  journeyMapNotices,
  outcomeLabel,
  parseConversionJourneyMapForm,
  readLocalJourneyMap,
  sourceLabel,
  writeLocalJourneyMap,
  type ConversionJourneyMap,
} from "@/lib/learning/conversion-journey-map";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export function ConversionJourneyMapTool({
  panel,
  description,
  onSaved,
  onAnonymousSaved,
}: {
  panel: ConversionJourneyPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
  onAnonymousSaved?: (map: ConversionJourneyMap, blockKey: string) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="mapa-conversao" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o mapa de conversão. Esta pré-visualização não cria progresso, resultado nem analytics.
        </p>
        <fieldset disabled className="mt-5 space-y-4 opacity-70">
          <DemoField label="O que você quer promover?" value="Móveis planejados" />
          <DemoField label="De onde as pessoas chegam?" value="Google (orgânico)" />
          <DemoField label="Onde a pessoa chega?" value="Página de cozinhas planejadas" />
          <DemoField label="Ação principal" value="Solicitar orçamento" />
          <DemoField label="Resultado para o negócio" value="Orçamento / oportunidade" />
        </fieldset>
      </div>
    );
  }
  return <LiveJourney panel={panel} description={description} onSaved={onSaved} onAnonymousSaved={onAnonymousSaved} />;
}

function LiveJourney({
  panel,
  description,
  onSaved,
  onAnonymousSaved,
}: {
  panel: Extract<ConversionJourneyPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
  onAnonymousSaved?: (map: ConversionJourneyMap, blockKey: string) => void;
}) {
  const localMap = useMemo(() => (!panel.authenticated ? readLocalJourneyMap() : null), [panel.authenticated]);
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [anonymousMap, setAnonymousMap] = useState<ConversionJourneyMap | null>(localMap);

  const project = current.projects.find((item) => item.id === selected) ?? null;
  const savedAuth =
    current.authenticated && !editing
      ? project?.map ?? (current.projects.length === 0 || !selected ? current.personalMap : null)
      : null;
  const saved = current.authenticated ? savedAuth : anonymousMap && !editing ? anonymousMap : null;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const input = {
      offer: String(formData.get("offer") ?? ""),
      trafficSource: String(formData.get("trafficSource") ?? ""),
      trafficSourceOther: String(formData.get("trafficSourceOther") ?? ""),
      destinationType: String(formData.get("destinationType") ?? ""),
      destinationDescription: String(formData.get("destinationDescription") ?? ""),
      destinationUrl: String(formData.get("destinationUrl") ?? ""),
      primaryAction: String(formData.get("primaryAction") ?? ""),
      businessOutcome: String(formData.get("businessOutcome") ?? ""),
      currentFriction: String(formData.get("currentFriction") ?? ""),
      reflection: String(formData.get("reflection") ?? ""),
      projectId: selected || undefined,
    };

    if (!current.authenticated) {
      const parsed = parseConversionJourneyMapForm(input);
      setPending(false);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      writeLocalJourneyMap(parsed.map);
      setAnonymousMap(parsed.map);
      setEditing(false);
      onAnonymousSaved?.(parsed.map, current.blockKey);
      return;
    }

    const result = await saveConversionJourneyMap(current.lessonSlug, current.blockKey, input);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const nextPanel = result.panel;
    if (!isLiveJourney(nextPanel)) {
      setError("Não foi possível salvar o mapa.");
      return;
    }
    setCurrent(nextPanel);
    setEditing(false);
    onSaved(result.snapshot);
  }

  return (
    <div id="mapa-conversao" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {current.authenticated && current.projects.length > 1 ? (
        <label className="mt-5 block text-sm font-medium" htmlFor="projeto-mapa">
          Qual projeto você quer usar? (opcional)
          <select
            id="projeto-mapa"
            className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setEditing(false);
            }}
          >
            <option value="">Sem projeto / mapa pessoal</option>
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
            {selected ? "Salvar só no mapa pessoal" : "Associar a este projeto"}
          </button>
        </p>
      ) : null}
      {current.authenticated && current.projects.length === 0 ? (
        <p className="mt-5 text-sm leading-relaxed text-muted">
          Você pode concluir o mapa sem projeto.{" "}
          <Link className="underline underline-offset-4" href={current.createProjectHref}>
            Criar um projeto para continuar aplicando
          </Link>
          .
        </p>
      ) : null}

      {saved ? <SavedJourney map={saved} /> : null}
      {saved ? (
        <button className={`${buttonClass("secondary")} mt-4`} type="button" disabled={pending} onClick={() => setEditing(true)}>
          Editar mapa
        </button>
      ) : null}
      {!saved || editing ? (
        <JourneyForm
          key={`${selected || "personal"}-${editing ? "edit" : "new"}`}
          initial={saved ?? project?.map ?? current.personalMap ?? anonymousMap}
          prefillOffer={project?.prefillOffer ?? ""}
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

function JourneyForm({
  initial,
  prefillOffer,
  pending,
  onSubmit,
}: {
  initial: ConversionJourneyMap | null;
  prefillOffer: string;
  pending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [source, setSource] = useState(initial?.trafficSource ?? "");
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <Field label="O que você quer promover?" name="offer" defaultValue={initial?.offer ?? prefillOffer} required maxLength={160} />
      <label className="block text-sm font-medium">
        De onde as pessoas costumam chegar?
        <select
          name="trafficSource"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="">Escolha</option>
          {TRAFFIC_SOURCES.map((value) => (
            <option key={value} value={value}>
              {TRAFFIC_SOURCE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      {source === "OTHER" ? (
        <Field label="Descreva a origem" name="trafficSourceOther" defaultValue={initial?.trafficSourceOther ?? ""} required maxLength={120} />
      ) : (
        <input type="hidden" name="trafficSourceOther" value="" />
      )}
      <label className="block text-sm font-medium">
        Tipo de destino atual
        <select
          name="destinationType"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          defaultValue={initial?.destinationType ?? ""}
        >
          <option value="">Escolha</option>
          {DESTINATION_TYPES.map((value) => (
            <option key={value} value={value}>
              {DESTINATION_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Onde a pessoa chega?"
        name="destinationDescription"
        defaultValue={initial?.destinationDescription ?? ""}
        required
        maxLength={200}
        placeholder="Ex.: Página de serviços"
      />
      <Field
        label="URL (opcional)"
        name="destinationUrl"
        defaultValue={initial?.destinationUrl ?? ""}
        maxLength={500}
        placeholder="https://..."
      />
      <label className="block text-sm font-medium">
        Ação principal
        <select
          name="primaryAction"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          defaultValue={initial?.primaryAction ?? ""}
        >
          <option value="">Escolha</option>
          {PRIMARY_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {PRIMARY_ACTION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Se essa ação funcionar, o que ela ajuda seu negócio a conseguir?
        <select
          name="businessOutcome"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          defaultValue={initial?.businessOutcome ?? ""}
        >
          <option value="">Escolha</option>
          {BUSINESS_OUTCOMES.map((value) => (
            <option key={value} value={value}>
              {BUSINESS_OUTCOME_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        O que hoje pode estar dificultando esse caminho? (opcional)
        <select
          name="currentFriction"
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          defaultValue={initial?.currentFriction ?? ""}
        >
          <option value="">Não informar agora</option>
          {FRICTION_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {FRICTION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Observação (opcional)
        <textarea
          name="reflection"
          rows={3}
          maxLength={500}
          defaultValue={initial?.reflection ?? ""}
          className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-3 text-base"
        />
      </label>
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar meu mapa de conversão"}
      </button>
    </form>
  );
}

function SavedJourney({ map }: { map: ConversionJourneyMap }) {
  const notices = journeyMapNotices(map);
  const friction = frictionLabel(map);
  return (
    <div className="mt-5 rounded-lg border border-border bg-white px-4 py-4">
      <p className="text-sm font-medium uppercase tracking-[0.14em] text-cta">Meu mapa de conversão</p>
      <p className="mt-3 text-base font-medium">{map.offer}</p>
      <ol className="mt-4 space-y-2 text-base leading-relaxed">
        <li>
          <span className="text-muted">Origem</span>
          <br />
          <strong>{sourceLabel(map)}</strong>
        </li>
        <li className="text-cta" aria-hidden>
          ↓
        </li>
        <li>
          <span className="text-muted">Página</span>
          <br />
          <strong>{map.destinationDescription}</strong>
          <span className="block text-sm text-muted">{DESTINATION_TYPE_LABELS[map.destinationType]}</span>
        </li>
        <li className="text-cta" aria-hidden>
          ↓
        </li>
        <li>
          <span className="text-muted">Ação</span>
          <br />
          <strong>{actionLabel(map)}</strong>
        </li>
        <li className="text-cta" aria-hidden>
          ↓
        </li>
        <li>
          <span className="text-muted">Resultado</span>
          <br />
          <strong>{outcomeLabel(map)}</strong>
        </li>
      </ol>
      {friction ? (
        <p className="mt-4 text-sm leading-relaxed">
          <span className="font-medium">Principal ponto de atenção:</span> {friction}
        </p>
      ) : null}
      {notices.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted">
          {notices.map((notice) => (
            <li key={notice.code}>{notice.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  maxLength,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        name={name}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        placeholder={placeholder}
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

function initialProject(panel: Extract<ConversionJourneyPanel, { mode: "live" }>) {
  if (panel.linkedProjectId) return panel.linkedProjectId;
  return "";
}

function isLiveJourney(panel: unknown): panel is Extract<ConversionJourneyPanel, { mode: "live" }> {
  return Boolean(
    panel &&
      typeof panel === "object" &&
      "mode" in panel &&
      panel.mode === "live" &&
      "kind" in panel &&
      panel.kind === "journey",
  );
}
