"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import {
  applyLandingPageWireframe,
  proposeLandingPageWireframe,
  saveLandingPageWireframeStructure,
} from "@/lib/learning/actions";
import type { WireframePage, WireframePanel } from "@/lib/learning/landing-page-wireframe";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import type { LandingComponentType } from "@/lib/landing-page/constants";
import { WIREFRAME_PURPOSE } from "@/lib/landing-page/wireframe/copy";
import {
  availableSectionTypes,
  PARTIAL_STRUCTURE_WARNING,
  SECTION_NAMES,
  WIREFRAME_REQUIRED_TYPES,
} from "@/lib/landing-page/wireframe/policy";
import {
  addReviewedSection,
  moveReviewedSection,
  removeReviewedSection,
  type ReviewedWireframePlanV1,
} from "@/lib/landing-page/wireframe/review";
import type { WireframeProposal } from "@/lib/landing-page/wireframe/structure";

const AULA_4 = "/aulas/oferta-publico-acao-principal";
const AULA_5 = "/aulas/jornada-do-visitante";

export function LandingPageWireframeTool({
  panel,
  description,
  onSaved,
}: {
  panel: WireframePanel | null;
  description?: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const preview = !panel || panel.preview || panel.mode === "preview";
  const [pageId, setPageId] = useState(panel?.suggestedPageId ?? "");
  const [revision, setRevision] = useState<number | null>(null);
  const [proposal, setProposal] = useState<WireframeProposal | null>(null);
  const [baseline, setBaseline] = useState<ReviewedWireframePlanV1 | null>(null);
  const [reviewed, setReviewed] = useState<ReviewedWireframePlanV1 | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewHref, setPreviewHref] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [addType, setAddType] = useState<LandingComponentType | "">("");
  const page = panel?.pages.find((item) => item.id === pageId) ?? null;
  const currentRevision = revision ?? page?.draftRevision ?? 1;

  const editSections = page?.hasWireframe ? [...page.sections].sort((a, b) => a.order - b.order) : [];
  const [editOrder, setEditOrder] = useState<string[]>(editSections.map((section) => section.id));
  const orderedEdit = useMemo(() => {
    if (!page) return [];
    const byId = new Map(page.sections.map((section) => [section.id, section]));
    return editOrder.map((id) => byId.get(id)).filter((section): section is WireframePage["sections"][number] => Boolean(section));
  }, [editOrder, page]);

  function selectPage(id: string) {
    setPageId(id);
    setRevision(null);
    setProposal(null);
    setReviewed(null);
    setBaseline(null);
    setPreviewHref(null);
    setMessage(null);
    const next = panel?.pages.find((item) => item.id === id);
    setEditOrder(next?.sections.map((section) => section.id) ?? []);
  }

  async function generate() {
    if (preview || !panel || !pageId) return;
    setPending(true);
    setMessage(null);
    const result = await proposeLandingPageWireframe(panel.blockKey, pageId);
    setPending(false);
    if (!result.ok || !result.proposal) {
      setMessage(result.ok ? "Não foi possível montar a estrutura." : result.message);
      return;
    }
    setProposal(result.proposal);
    setReviewed(result.proposal.reviewed);
    setBaseline(result.proposal.reviewed);
  }

  async function apply() {
    if (preview || !panel || !pageId || !reviewed) return;
    setPending(true);
    setMessage(null);
    const result = await applyLandingPageWireframe(panel.blockKey, {
      landingPageProjectId: pageId,
      expectedRevision: currentRevision,
      reviewed,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setRevision(result.draftRevision ?? currentRevision);
    setPreviewHref(result.previewHref ?? `/app/landing-pages/${pageId}/preview`);
    if (result.snapshot) onSaved?.(result.snapshot);
  }

  async function saveEdit(additions: Array<{ type: LandingComponentType }> = []) {
    if (preview || !panel || !pageId) return;
    setPending(true);
    setMessage(null);
    const result = await saveLandingPageWireframeStructure(panel.blockKey, {
      landingPageProjectId: pageId,
      expectedRevision: currentRevision,
      orderedSectionIds: editOrder,
      additions,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setRevision(result.draftRevision ?? currentRevision);
    setPreviewHref(result.previewHref ?? `/app/landing-pages/${pageId}/preview`);
    if (result.snapshot) onSaved?.(result.snapshot);
  }

  const reviewedTypes = reviewed?.sections.map((section) => section.type) ?? [];
  const addOptions = availableSectionTypes(reviewedTypes);

  return (
    <div data-wireframe-tool className="mt-4 flex w-full min-w-0 flex-col gap-4">
      {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      {preview ? (
        <p className="text-sm">Esta prévia mostra o caminho da ferramenta. Ela não grava a página.</p>
      ) : null}
      {!preview && panel && !panel.authenticated ? (
        <Link className={buttonClass("primary")} href={authNextHref("/entrar", "/aulas/organize-as-secoes-da-pagina")}>
          Entrar para montar a estrutura
        </Link>
      ) : null}

      {!preview && panel?.authenticated ? (
        <label className="flex flex-col gap-1 text-sm">
          Página
          <select className="w-full min-w-0 rounded border px-3 py-2" value={pageId} onChange={(event) => selectPage(event.target.value)}>
            <option value="">Escolha a landing page</option>
            {panel.pages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {page ? (
        <section className="rounded border p-4" data-wireframe-step="estrategia">
          <h3 className="text-base font-semibold">Sua estratégia</h3>
          <p className="mt-2 text-sm">{page.offerName ? `Oferta: ${page.offerName}` : "A oferta ainda não foi registrada."}</p>
          <p className="text-sm">{page.audience ? `Público: ${page.audience}` : "O público ainda não foi registrado."}</p>
        </section>
      ) : null}

      {page && !page.hasBrief ? (
        <Link className={buttonClass("secondary")} href={AULA_4}>
          Preparar estratégia na Aula 4
        </Link>
      ) : null}
      {page && page.hasBrief && !page.hasJourney ? (
        <Link className={buttonClass("secondary")} href={AULA_5}>
          Planejar jornada na Aula 5
        </Link>
      ) : null}
      {page?.foreignStructure ? (
        <p role="alert" className="text-sm">
          Esta página já tem seções de outra origem. A estrutura guiada não substitui esse conteúdo.
        </p>
      ) : null}

      {!preview && page && page.sectionCount === 0 ? (
        <button type="button" className={`${buttonClass("primary")} w-full sm:w-auto`} disabled={pending || !page.hasBrief} onClick={() => void generate()}>
          Montar estrutura recomendada
        </button>
      ) : null}

      {proposal?.partialWarning ? <p className="text-sm">{proposal.partialWarning}</p> : null}
      {proposal && !proposal.canApply ? <p className="text-sm">Complete as informações estratégicas antes de aplicar uma estrutura.</p> : null}
      {reviewed ? (
        <section data-wireframe-step="plano" className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Estrutura recomendada para este cenário</h3>
          {proposal?.strategyLabel ? <p className="text-sm">{proposal.strategyLabel}</p> : null}
          {proposal?.confidenceLabel ? <p className="text-sm">{proposal.confidenceLabel}</p> : null}
          <p className="text-sm">Isto não é garantia de conversão.</p>
          {reviewed.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section, index) => (
              <article key={section.key} className="rounded border p-4" data-section-key={section.key}>
                <p className="text-sm font-semibold">
                  {String(index + 1).padStart(2, "0")} — {SECTION_NAMES[section.type]}
                </p>
                <p className="mt-2 text-sm">Objetivo: {section.purpose}</p>
                {section.reason ? <p className="mt-1 text-sm">Por que entrou: {section.reason}</p> : null}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button type="button" className={buttonClass("secondary")} onClick={() => baseline && setReviewed(moveReviewedSection(reviewed, section.key, "up", baseline))}>
                    Mover para cima
                  </button>
                  <button type="button" className={buttonClass("secondary")} onClick={() => baseline && setReviewed(moveReviewedSection(reviewed, section.key, "down", baseline))}>
                    Mover para baixo
                  </button>
                  {(WIREFRAME_REQUIRED_TYPES as readonly string[]).includes(section.type) ? null : (
                    <button
                      type="button"
                      className={buttonClass("secondary")}
                      onClick={() => {
                        if (!baseline) return;
                        const next = removeReviewedSection(reviewed, section.key, baseline);
                        if (next.ok) setReviewed(next.plan);
                      }}
                    >
                      Remover seção
                    </button>
                  )}
                </div>
              </article>
            ))}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              Adicionar seção
              <select className="w-full rounded border px-3 py-2" value={addType} onChange={(event) => setAddType(event.target.value as LandingComponentType | "")}>
                <option value="">Escolha um tipo disponível</option>
                {addOptions.map((type) => (
                  <option key={type} value={type}>
                    {SECTION_NAMES[type]} — {WIREFRAME_PURPOSE[type]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={buttonClass("secondary")}
              onClick={() => {
                if (!baseline || !addType) return;
                const next = addReviewedSection(reviewed, addType, baseline);
                if (next.ok) {
                  setReviewed(next.plan);
                  setAddType("");
                }
              }}
            >
              Adicionar seção
            </button>
            <button type="button" className={buttonClass("secondary")} onClick={() => baseline && setReviewed(baseline)}>
              Restaurar recomendação original
            </button>
          </div>
          {proposal?.canApply ? (
            <button type="button" className={`${buttonClass("primary")} w-full sm:w-auto`} disabled={pending} onClick={() => void apply()}>
              Aplicar esta estrutura à minha página
            </button>
          ) : null}
        </section>
      ) : null}

      {!preview && page?.hasWireframe ? (
        <section data-wireframe-step="editar" className="flex flex-col gap-3">
          <h3 className="text-base font-semibold">Ajustar a estrutura</h3>
          {orderedEdit.map((section) => (
            <article key={section.id} className="rounded border p-4">
              <p className="text-sm font-semibold">{SECTION_NAMES[section.type]}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className={buttonClass("secondary")}
                  onClick={() =>
                    setEditOrder((current) => {
                      const index = current.indexOf(section.id);
                      if (index <= 0) return current;
                      const next = current.slice();
                      const previous = next[index - 1];
                      if (!previous) return current;
                      next[index - 1] = section.id;
                      next[index] = previous;
                      return next;
                    })
                  }
                >
                  Mover para cima
                </button>
                <button
                  type="button"
                  className={buttonClass("secondary")}
                  onClick={() =>
                    setEditOrder((current) => {
                      const index = current.indexOf(section.id);
                      if (index < 0 || index >= current.length - 1) return current;
                      const next = current.slice();
                      const following = next[index + 1];
                      if (!following) return current;
                      next[index + 1] = section.id;
                      next[index] = following;
                      return next;
                    })
                  }
                >
                  Mover para baixo
                </button>
                {section.contentStatus === "PLACEHOLDER" && !(WIREFRAME_REQUIRED_TYPES as readonly string[]).includes(section.type) ? (
                  <button type="button" className={buttonClass("secondary")} onClick={() => setEditOrder((current) => current.filter((id) => id !== section.id))}>
                    Remover seção
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          <button type="button" className={`${buttonClass("primary")} w-full sm:w-auto`} disabled={pending} onClick={() => void saveEdit()}>
            Salvar ajuste da estrutura
          </button>
        </section>
      ) : null}

      {previewHref ? (
        <Link className={`${buttonClass("primary")} w-full sm:w-auto`} href={previewHref}>
          Ver minha página
        </Link>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm">
          {message}
        </p>
      ) : null}
      {preview ? <p className="sr-only">{PARTIAL_STRUCTURE_WARNING}</p> : null}
    </div>
  );
}
