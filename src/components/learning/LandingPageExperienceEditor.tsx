"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FindingCard } from "@/components/landing-page/FindingCard";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import { ResponsivePreviewFrame } from "@/components/landing-page/ResponsivePreviewFrame";
import { buttonClass } from "@/lib/button-styles";
import { experienceChecklistFor } from "@/lib/landing-page/experience/checklist";
import {
  EXPERIENCE_CATEGORY_LABEL,
  EXPERIENCE_DEFER_COPY,
  EXPERIENCE_NO_SECTIONS_HREF,
  EXPERIENCE_PREVIEW_LIMIT,
  EXPERIENCE_STATUS_LABEL,
  EXPERIENCE_STALE_COPY,
  experienceActionLink,
  experienceReviewProgress,
  experienceViewportLabel,
  groupExperienceFindings,
  sectionTypeLabel,
  type ExperiencePageView,
} from "@/lib/landing-page/experience/lesson-flow";
import { composeLandingPageExperienceReview, type ExperienceReviewInput } from "@/lib/landing-page/experience/review";
import { EXPERIENCE_FINDING_CATEGORIES, type ExperienceFindingCategory } from "@/lib/landing-page/experience/schema";
import { EXPERIENCE_VIEWPORT_CONTROL, EXPERIENCE_VIEWPORT_IDS, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";

type Note = {
  id: string;
  category: ExperienceFindingCategory;
  message: string;
  viewport?: ExperienceViewportId;
  sectionId?: string;
  status: "OPEN" | "RESOLVED" | "DEFERRED" | "NOT_APPLICABLE";
};

type Decision = { findingId: string; status: "DEFERRED" };

const STEPS = [
  { id: "overview", label: "Visão geral" },
  { id: "MOBILE_SMALL", label: "Celular pequeno" },
  { id: "MOBILE", label: "Celular" },
  { id: "TABLET", label: "Tablet" },
  { id: "DESKTOP", label: "Desktop" },
  { id: "findings", label: "Problemas encontrados" },
  { id: "final", label: "Revisão final" },
] as const;

function isViewport(step: (typeof STEPS)[number]["id"]): step is ExperienceViewportId {
  return (EXPERIENCE_VIEWPORT_IDS as readonly string[]).includes(step);
}

export function LandingPageExperienceEditor({
  page,
  onSave,
}: {
  page: ExperiencePageView;
  onSave: (review: ExperienceReviewInput, intent: "save" | "complete") => Promise<void>;
}) {
  const [step, setStep] = useState<(typeof STEPS)[number]["id"]>("overview");
  const [viewports, setViewports] = useState<ExperienceViewportId[]>([]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [category, setCategory] = useState<ExperienceFindingCategory>("READABILITY");
  const [noteViewport, setNoteViewport] = useState<"" | ExperienceViewportId>("");
  const [noteSection, setNoteSection] = useState("");
  const [noteText, setNoteText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hydrationKey = `${page.id}:${page.draftRevision}:${page.effectiveStatus}`;
  const [hydratedKey, setHydratedKey] = useState(hydrationKey);
  if (hydratedKey !== hydrationKey) {
    const review = page.document.experienceReview;
    const stale = page.effectiveStatus === "STALE";
    const userNotes = (review?.findings ?? [])
      .filter((finding) => finding.source === "USER")
      .map((finding) => ({
        id: finding.id,
        category: finding.category,
        message: finding.message,
        viewport: finding.viewport,
        sectionId: finding.sectionId,
        status: finding.status === "RESOLVED" || finding.status === "DEFERRED" || finding.status === "NOT_APPLICABLE" ? finding.status : "OPEN" as const,
      }));
    setHydratedKey(hydrationKey);
    setNotes(userNotes);
    setDecisions(
      stale
        ? []
        : (review?.findings ?? [])
            .filter((finding) => finding.source === "SYSTEM" && finding.status === "DEFERRED")
            .map((finding) => ({ findingId: finding.id, status: "DEFERRED" as const })),
    );
    setViewports(stale ? [] : [...(review?.reviewedViewports ?? [])]);
    setChecks(
      stale
        ? {}
        : Object.fromEntries((review?.checklist ?? []).filter((item) => item.confirmed).map((item) => [item.id, true])),
    );
  }

  const checklist = experienceChecklistFor(page.document);
  const input = useMemo<ExperienceReviewInput>(
    () => ({
      reviewedViewports: viewports,
      checklist: checklist.map((item) => ({ id: item.id, confirmed: checks[item.id] === true })),
      userFindings: notes.map((note) => ({
        id: note.id,
        category: note.category,
        severity: "ATTENTION" as const,
        message: note.message,
        viewport: note.viewport,
        sectionId: note.sectionId,
        status: note.status,
      })),
      decisions,
    }),
    [checklist, checks, decisions, notes, viewports],
  );
  const preview = useMemo(
    () =>
      composeLandingPageExperienceReview(
        page.document,
        page.draftRevision + 1,
        input,
        page.media.map((item) => ({ id: item.id, status: item.status, fileSize: item.fileSize, altText: item.altText })),
      ),
    [input, page.document, page.draftRevision, page.media],
  );
  const findings = preview.ok ? preview.review.findings : [];
  const groups = groupExperienceFindings(findings);
  const progress = experienceReviewProgress(preview.ok ? preview.review : null);
  const ready = preview.ok && preview.review.summary.status === "READY_FOR_NEXT_STEP";
  const sections = page.document.sections.filter((section) => section.enabled);

  async function persist(intent: "save" | "complete") {
    setPending(true);
    try {
      await onSave(input, intent);
    } finally {
      setPending(false);
    }
  }

  function addNote() {
    const message = noteText.trim();
    if (!message) {
      setFormError("Escreva uma observação curta.");
      return;
    }
    if (/[<>]/.test(message)) {
      setFormError("Use texto simples, sem HTML.");
      return;
    }
    setNotes((current) => [
      ...current,
      {
        id: `user:${crypto.randomUUID()}`,
        category,
        message,
        ...(noteViewport ? { viewport: noteViewport } : {}),
        ...(noteSection ? { sectionId: noteSection } : {}),
        status: "OPEN",
      },
    ]);
    setNoteText("");
    setFormError(null);
  }

  if (page.setup === "NO_SECTIONS") {
    return (
      <div className="space-y-3" data-experience-setup="NO_SECTIONS">
        <p className="text-sm leading-6">Esta landing page ainda não tem seções. Monte a estrutura antes de revisar a experiência.</p>
        <Link className={buttonClass("primary")} href={EXPERIENCE_NO_SECTIONS_HREF}>
          Ir para a aula das seções
        </Link>
      </div>
    );
  }

  const stepViewport = isViewport(step) ? step : null;
  const stepItems = stepViewport ? checklist.filter((item) => item.viewport === stepViewport) : [];

  return (
    <div className="space-y-5" data-experience-tool="LANDING_PAGE_EXPERIENCE_REVIEW_V1">
      <p className="text-sm leading-6 text-muted">{EXPERIENCE_PREVIEW_LIMIT}</p>
      {page.effectiveStatus === "STALE" ? (
        <div className="rounded-lg border border-border bg-surface p-3" data-stale-review="true">
          <p className="text-sm leading-6">{EXPERIENCE_STALE_COPY}</p>
          <button type="button" className={`${buttonClass("primary")} mt-3`} onClick={() => setStep("MOBILE_SMALL")}>
            Revisar novamente
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2" data-experience-steps="true">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className="min-h-11 rounded-md border border-border px-3 text-sm"
            aria-pressed={step === item.id}
            onClick={() => setStep(item.id)}
          >
            {index + 1}. {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm" data-review-progress="true">
        Viewports revisados: {progress.viewportsReviewed}/{progress.viewportTotal}. Bloqueios: {progress.openBlockers}. Atenções: {progress.attentionReviewed} revisadas.
      </p>
      {step === "overview" ? (
        <div className="space-y-3 text-sm leading-6">
          <p>Abra a página real e percorra as quatro larguras. A plataforma aponta alguns problemas. Você confirma o que uma pessoa perceberia.</p>
          <button type="button" className={buttonClass("primary")} onClick={() => setStep("MOBILE_SMALL")}>
            Começar pelo celular pequeno
          </button>
        </div>
      ) : null}
      {stepViewport ? (
        <div className="space-y-4">
          <ResponsivePreviewFrame key={stepViewport} initialMode="REVIEW" initialViewport={stepViewport} sections={sections.map((section) => ({ id: section.id, type: section.type }))}>
            <LandingPageRenderer document={page.document} mode="PREVIEW" media={page.media} />
          </ResponsivePreviewFrame>
          <fieldset className="space-y-2" data-viewport-checklist={stepViewport}>
            <legend className="text-sm font-medium">Confirme a revisão em {EXPERIENCE_VIEWPORT_CONTROL[stepViewport]}</legend>
            {stepItems.map((item) => (
              <label key={item.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checks[item.id] === true}
                  disabled={!item.applicable}
                  onChange={(event) => setChecks((current) => ({ ...current, [item.id]: event.target.checked }))}
                />
                <span>{item.label}{item.applicable ? "" : " — não se aplica nesta página"}</span>
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => setViewports((current) => (current.includes(stepViewport) ? current : [...current, stepViewport]))}
          >
            Revisei esta largura
          </button>
        </div>
      ) : null}
      {step === "findings" || step === "final" ? (
        <div className="space-y-4">
          <FindingGroup title="Precisa ser resolvido" items={groups.blockers} sections={sections} decisions={decisions} onDefer={setDecisions} />
          <FindingGroup title="Precisa de atenção" items={groups.attention} sections={sections} decisions={decisions} onDefer={setDecisions} />
          <FindingGroup title="Observação" items={groups.info} sections={sections} decisions={decisions} onDefer={setDecisions} />
          {groups.reviewed.length > 0 ? <FindingGroup title="Já revisados" items={groups.reviewed} sections={sections} decisions={decisions} onDefer={setDecisions} /> : null}
          <div className="space-y-3 rounded-lg border border-border p-3" data-user-finding-form="true">
            <h3 className="text-sm font-semibold">Adicionar observação</h3>
            <label className="block text-sm">
              Categoria
              <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-2" value={category} onChange={(event) => setCategory(event.target.value as ExperienceFindingCategory)}>
                {EXPERIENCE_FINDING_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{EXPERIENCE_CATEGORY_LABEL[item]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Largura, se quiser
              <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-2" value={noteViewport} onChange={(event) => setNoteViewport(event.target.value as "" | ExperienceViewportId)}>
                <option value="">A página inteira</option>
                {EXPERIENCE_VIEWPORT_IDS.map((item) => (
                  <option key={item} value={item}>{EXPERIENCE_VIEWPORT_CONTROL[item]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Seção, se quiser
              <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-2" value={noteSection} onChange={(event) => setNoteSection(event.target.value)}>
                <option value="">Sem seção</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>{sectionTypeLabel(section.type)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Observação curta
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-border bg-surface p-2"
                maxLength={400}
                value={noteText}
                placeholder="Esse botão ficou difícil de perceber no celular."
                onChange={(event) => setNoteText(event.target.value)}
              />
            </label>
            {formError ? <p className="text-sm">{formError}</p> : null}
            <button type="button" className={buttonClass("secondary")} onClick={addNote}>Adicionar observação</button>
          </div>
          <ul className="space-y-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-border p-3" data-user-finding={note.id}>
                <p className="text-xs text-muted">{EXPERIENCE_CATEGORY_LABEL[note.category]} · {EXPERIENCE_STATUS_LABEL[note.status]}</p>
                {note.status === "OPEN" ? (
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm"
                    value={note.message}
                    onChange={(event) => setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, message: event.target.value } : item)))}
                  />
                ) : (
                  <p className="mt-2 break-words text-sm">{note.message}</p>
                )}
                {note.status === "DEFERRED" ? <p className="mt-2 text-sm text-muted">{EXPERIENCE_DEFER_COPY}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-md border border-border px-3 text-sm" onClick={() => setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, status: "RESOLVED" } : item)))}>Resolvido</button>
                  <button type="button" className="min-h-11 rounded-md border border-border px-3 text-sm" onClick={() => setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, status: "DEFERRED" } : item)))}>Adiar</button>
                  <button type="button" className="min-h-11 rounded-md border border-border px-3 text-sm" onClick={() => setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, status: "NOT_APPLICABLE" } : item)))}>Não se aplica</button>
                </div>
              </li>
            ))}
          </ul>
          <button type="button" className={buttonClass("secondary")} disabled={pending} onClick={() => persist("save")}>
            Reavaliar minha página
          </button>
        </div>
      ) : null}
      {step === "final" ? (
        <div className="space-y-3">
          <button type="button" className={buttonClass("primary")} disabled={!ready || pending} data-complete-review={ready ? "ready" : "blocked"} onClick={() => persist("complete")}>
            Concluir revisão
          </button>
          {ready ? null : <p className="text-sm leading-6">Concluir pede as quatro larguras, nenhum bloqueio aberto e todas as atenções resolvidas, adiadas ou marcadas como não aplicáveis.</p>}
        </div>
      ) : null}
    </div>
  );
}

function FindingGroup({
  title,
  items,
  sections,
  decisions,
  onDefer,
}: {
  title: string;
  items: ReturnType<typeof groupExperienceFindings>["blockers"];
  sections: ExperiencePageView["document"]["sections"];
  decisions: Decision[];
  onDefer: (next: Decision[]) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3" data-finding-group={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.map((finding) => {
        const section = sections.find((item) => item.id === finding.sectionId);
        const action = experienceActionLink(finding.actionCode);
        const deferred = decisions.some((decision) => decision.findingId === finding.id);
        return (
          <div key={finding.id} className="space-y-2">
            <FindingCard finding={finding} />
            <p className="break-words text-sm text-muted">
              Onde: {section ? sectionTypeLabel(section.type) : "A página"} · {experienceViewportLabel(finding.viewport)}
            </p>
            <p className="text-sm">
              {finding.severity === "BLOCKER"
                ? "Este ponto impede considerar a revisão concluída."
                : finding.severity === "ATTENTION"
                  ? "Vale resolver agora ou adiar com consciência."
                  : "Orientação. Não impede concluir."}
            </p>
            {action?.href ? (
              <Link className="inline-flex min-h-11 items-center text-sm underline" href={action.href}>{action.label}</Link>
            ) : action ? (
              <p className="text-sm">{action.label}</p>
            ) : null}
            {finding.source === "SYSTEM" && finding.severity === "ATTENTION" && (finding.status === "OPEN" || finding.status === "DEFERRED") ? (
              <button
                type="button"
                className="min-h-11 rounded-md border border-border px-3 text-sm"
                onClick={() => onDefer(deferred ? decisions.filter((decision) => decision.findingId !== finding.id) : [...decisions, { findingId: finding.id, status: "DEFERRED" }])}
              >
                {deferred ? "Manter em aberto" : "Adiar"}
              </button>
            ) : null}
            {deferred ? <p className="text-sm text-muted">{EXPERIENCE_DEFER_COPY}</p> : null}
          </div>
        );
      })}
    </section>
  );
}
