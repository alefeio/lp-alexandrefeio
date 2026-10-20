"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { saveConversionPageReadiness } from "@/lib/learning/actions";
import type { PageReadinessPanel } from "@/lib/learning/page-readiness";
import {
  ANSWER_LABELS,
  ANSWER_VALUES,
  DIMENSION_LABELS,
  DIMENSION_STATUS_LABELS,
  OVERALL_READINESS_LABELS,
  PAGE_EXISTS,
  PAGE_EXISTS_LABELS,
  READINESS_DIMENSIONS,
  READINESS_QUESTIONS,
  conversionJourneyLocalPrefill,
  parsePageReadinessForm,
  readLocalPageReadiness,
  writeLocalPageReadiness,
  type ConversionPageReadiness,
} from "@/lib/learning/conversion-page-readiness";
import type { LessonSnapshot } from "@/lib/learning/reader-types";

export function ConversionPageReadinessTool({
  panel,
  description,
  onSaved,
  onAnonymousSaved,
}: {
  panel: PageReadinessPanel | null;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
  onAnonymousSaved?: (readiness: ConversionPageReadiness, blockKey: string) => void;
}) {
  if (!panel || panel.mode === "preview") {
    return (
      <div id="prontidao-pagina" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
        <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Na aula publicada, este bloco grava o diagnóstico de prontidão. Esta pré-visualização não cria progresso, resultado nem analytics.
        </p>
        <fieldset disabled className="mt-5 space-y-4 opacity-70">
          <DemoField label="Já possui a estrutura a avaliar?" value="Sim" />
          <DemoField label="Clareza" value="Sim" />
          <DemoField label="Ação principal" value="Parcialmente" />
          <DemoField label="Status" value="Precisa de preparação" />
        </fieldset>
      </div>
    );
  }
  return <LiveReadiness panel={panel} description={description} onSaved={onSaved} onAnonymousSaved={onAnonymousSaved} />;
}

function LiveReadiness({
  panel,
  description,
  onSaved,
  onAnonymousSaved,
}: {
  panel: Extract<PageReadinessPanel, { mode: "live" }>;
  description: string;
  onSaved: (snapshot: LessonSnapshot) => void;
  onAnonymousSaved?: (readiness: ConversionPageReadiness, blockKey: string) => void;
}) {
  const local = useMemo(() => (!panel.authenticated ? readLocalPageReadiness() : null), [panel.authenticated]);
  const anonContext = useMemo(() => (!panel.authenticated ? conversionJourneyLocalPrefill() : {}), [panel.authenticated]);
  const [current, setCurrent] = useState(panel);
  const [selected, setSelected] = useState(initialProject(panel));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [anonymousReadiness, setAnonymousReadiness] = useState<ConversionPageReadiness | null>(local);

  const project = current.projects.find((item) => item.id === selected) ?? null;
  const savedAuth =
    current.authenticated && !editing
      ? project?.readiness ?? (current.projects.length === 0 || !selected ? current.personalReadiness : null)
      : null;
  const saved = current.authenticated ? savedAuth : anonymousReadiness && !editing ? anonymousReadiness : null;
  const context = current.authenticated ? project?.context ?? current.personalContext : anonContext;

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const answers: Record<string, string> = {};
    for (const question of READINESS_QUESTIONS) {
      const value = String(formData.get(question.id) ?? "");
      if (value) answers[question.id] = value;
    }
    const input = {
      pageExists: String(formData.get("pageExists") ?? ""),
      answers,
      context: {
        offer: context.offer ?? undefined,
        currentDestination: context.currentDestination ?? undefined,
        recommendedStructure: context.recommendedStructure ?? undefined,
        primaryAction: context.primaryAction ?? undefined,
      },
      projectId: selected || undefined,
    };

    if (!current.authenticated) {
      const parsed = parsePageReadinessForm(input);
      setPending(false);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      writeLocalPageReadiness(parsed.readiness);
      setAnonymousReadiness(parsed.readiness);
      setEditing(false);
      onAnonymousSaved?.(parsed.readiness, current.blockKey);
      return;
    }

    const result = await saveConversionPageReadiness(current.lessonSlug, current.blockKey, input);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const nextPanel = result.panel;
    if (!isLiveReadiness(nextPanel)) {
      setError("Não foi possível salvar o diagnóstico.");
      return;
    }
    setCurrent(nextPanel);
    setEditing(false);
    onSaved(result.snapshot);
  }

  return (
    <div id="prontidao-pagina" className="mt-4 scroll-mt-28 rounded-lg border border-border bg-surface px-5 py-5">
      <p className="whitespace-pre-wrap text-base leading-relaxed">{description}</p>
      {context.offer || context.recommendedStructure ? (
        <div className="mt-4 rounded-lg border border-border bg-white px-4 py-3 text-sm leading-relaxed">
          <p className="font-medium">Contexto das aulas anteriores</p>
          {context.offer ? <p className="mt-1">Oferta: {context.offer}</p> : null}
          {context.currentDestination ? <p className="mt-1">Destino atual: {context.currentDestination}</p> : null}
          {context.recommendedStructure ? <p className="mt-1">Estrutura definida na Aula 2: {context.recommendedStructure}</p> : null}
          {context.primaryAction ? <p className="mt-1">Ação principal: {context.primaryAction}</p> : null}
          <p className="mt-2 text-muted">Isso é contexto — as respostas do diagnóstico continuam com você.</p>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Esta ferramenta funciona sozinha. Se quiser mais contexto, revise as Aulas 1 e 2.
        </p>
      )}

      {current.authenticated && current.projects.length > 1 ? (
        <label className="mt-5 block text-sm font-medium" htmlFor="projeto-prontidao">
          Qual projeto você quer usar? (opcional)
          <select
            id="projeto-prontidao"
            className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setEditing(false);
            }}
          >
            <option value="">Sem projeto / diagnóstico pessoal</option>
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
            {selected ? "Salvar só no diagnóstico pessoal" : "Associar a este projeto"}
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

      {saved ? <SavedReadiness readiness={saved} /> : null}
      {saved ? (
        <button className={`${buttonClass("secondary")} mt-4`} type="button" disabled={pending} onClick={() => setEditing(true)}>
          Editar diagnóstico
        </button>
      ) : null}
      {!saved || editing ? (
        <ReadinessForm key={`${selected || "personal"}-${editing ? "edit" : "new"}`} initial={saved} pending={pending} onSubmit={onSubmit} />
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ReadinessForm({
  initial,
  pending,
  onSubmit,
}: {
  initial: ConversionPageReadiness | null;
  pending: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [pageExists, setPageExists] = useState(initial?.pageExists ?? "");

  return (
    <form
      className="mt-5 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <label className="block text-sm font-medium">
        Você já possui a estrutura que quer avaliar?
        <select
          name="pageExists"
          required
          className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
          value={pageExists}
          onChange={(event) => setPageExists(event.target.value)}
        >
          <option value="">Escolha</option>
          {PAGE_EXISTS.map((value) => (
            <option key={value} value={value}>
              {PAGE_EXISTS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      {pageExists === "NO" ? (
        <p className="text-sm leading-relaxed text-muted">
          Se ainda não há página, não invente respostas. Vamos registrar que você ainda está na fase de construção.
        </p>
      ) : null}

      {pageExists === "YES" || pageExists === "PARTIALLY" ? (
        <div className="space-y-6">
          {READINESS_DIMENSIONS.map((dimension) => (
            <fieldset key={dimension} className="space-y-3">
              <legend className="text-base font-semibold">{DIMENSION_LABELS[dimension]}</legend>
              {READINESS_QUESTIONS.filter((question) => question.dimension === dimension).map((question) => (
                <label key={question.id} className="block text-sm font-medium">
                  {question.prompt}
                  {question.help ? <span className="mt-1 block font-normal text-muted">{question.help}</span> : null}
                  <select
                    name={question.id}
                    className="mt-2 min-h-12 w-full rounded-lg border border-border bg-white px-3 text-base"
                    defaultValue={(initial?.answers as Record<string, string> | undefined)?.[question.id] ?? ""}
                  >
                    <option value="">Escolha</option>
                    {ANSWER_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {ANSWER_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      ) : null}

      <button className={buttonClass("primary")} type="submit" disabled={pending || !pageExists}>
        {pending ? "Salvando…" : "Gerar diagnóstico de prontidão"}
      </button>
    </form>
  );
}

function SavedReadiness({ readiness }: { readiness: ConversionPageReadiness }) {
  if (readiness.overallReadiness === "FOUNDATION_NOT_BUILT") {
    return (
      <div className="mt-5 rounded-lg border border-border bg-white px-4 py-4">
        <p className="text-sm font-medium uppercase tracking-[0.14em] text-cta">Diagnóstico de prontidão da página</p>
        <p className="mt-3 text-lg font-semibold">Você ainda está na fase de construção.</p>
        {readiness.context.recommendedStructure ? (
          <p className="mt-3 text-base leading-relaxed">
            Estrutura planejada: <strong>{readiness.context.recommendedStructure}</strong>
          </p>
        ) : null}
        {readiness.context.offer ? <p className="mt-2 text-base">Oferta: {readiness.context.offer}</p> : null}
        <p className="mt-4 text-base leading-relaxed">
          Você ainda não tem uma página para avaliar — e tudo bem. Seu próximo passo é estruturar os fundamentos antes de fazer este diagnóstico novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-border bg-white px-4 py-4">
      <p className="text-sm font-medium uppercase tracking-[0.14em] text-cta">Diagnóstico de prontidão da página</p>
      {readiness.overallScore != null ? (
        <p className="mt-3 text-sm text-muted">
          Pontuação (contexto): <span className="font-medium text-foreground">{readiness.overallScore}/100</span>
        </p>
      ) : null}
      <p className="mt-1 text-sm text-muted">
        Cobertura: {readiness.assessmentCoverage.evaluated} de {readiness.assessmentCoverage.total} dimensões
      </p>
      <p className="mt-4 text-lg font-semibold">{OVERALL_READINESS_LABELS[readiness.overallReadiness]}</p>
      {readiness.primaryBottleneck in DIMENSION_LABELS ? (
        <p className="mt-2 text-base">
          Principal ponto de atenção: <strong>{DIMENSION_LABELS[readiness.primaryBottleneck as keyof typeof DIMENSION_LABELS]}</strong>
        </p>
      ) : null}

      <ul className="mt-5 space-y-2">
        {readiness.dimensionScores.map((item) => (
          <li key={item.dimension} className="flex items-center justify-between gap-3 text-base">
            <span>{DIMENSION_LABELS[item.dimension]}</span>
            <span className="font-medium">
              {DIMENSION_STATUS_LABELS[item.status]}
              {item.score != null ? <span className="ml-2 text-sm font-normal text-muted">{item.score}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {readiness.priorities.length > 0 ? (
        <>
          <p className="mt-5 text-sm font-medium">Prioridades</p>
          <ol className="mt-2 list-decimal space-y-3 pl-5 text-base leading-relaxed">
            {readiness.priorities.map((priority) => (
              <li key={priority.dimension}>
                <strong>{DIMENSION_LABELS[priority.dimension]}</strong> — {priority.reason}
                <span className="mt-1 block text-sm text-muted">Próximo passo: {priority.nextStep}</span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {readiness.caveats.length > 0 ? (
        <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted">
          {readiness.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      ) : null}
    </div>
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

function initialProject(panel: Extract<PageReadinessPanel, { mode: "live" }>) {
  if (panel.linkedProjectId) return panel.linkedProjectId;
  return "";
}

function isLiveReadiness(panel: unknown): panel is Extract<PageReadinessPanel, { mode: "live" }> {
  return Boolean(
    panel &&
      typeof panel === "object" &&
      "mode" in panel &&
      panel.mode === "live" &&
      "kind" in panel &&
      panel.kind === "pageReadiness",
  );
}
