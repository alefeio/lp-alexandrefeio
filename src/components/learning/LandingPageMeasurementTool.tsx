"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingPageMeasurementEditor, type MeasurementEditorSave } from "@/components/learning/LandingPageMeasurementEditor";
import { authNextHref } from "@/lib/auth/messages";
import { buttonClass } from "@/lib/button-styles";
import { saveLandingPageMeasurementPlanAction } from "@/lib/learning/actions";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import {
  MEASUREMENT_NO_PROJECT_HREF,
  MEASUREMENT_NO_SECTIONS_HREF,
  type MeasurementPageView,
  type MeasurementPanel,
} from "@/lib/landing-page/measurement/lesson-flow";

export function LandingPageMeasurementTool({
  panel,
  description,
  onSaved,
}: {
  panel: MeasurementPanel | null;
  description: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const [pages, setPages] = useState<MeasurementPageView[]>(panel?.pages ?? []);
  const [pageId, setPageId] = useState(panel?.suggestedPageId ?? panel?.pages[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const page = pages.find((item) => item.id === pageId) ?? null;
  if (panel?.preview) {
    return <p className="text-sm text-muted">A ferramenta abre na aula do aluno, com a landing page dele.</p>;
  }
  if (!panel?.authenticated) {
    return (
      <div className="space-y-3">
        <p className="text-sm">{description}</p>
        <Link className={buttonClass("primary")} href={authNextHref("/entrar", "/aulas/configure-o-que-precisa-ser-medido")}>
          Entrar para configurar a mensuração
        </Link>
      </div>
    );
  }
  if (pages.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Ainda não há uma landing page sua para medir.</p>
        <Link className={buttonClass("primary")} href={MEASUREMENT_NO_PROJECT_HREF}>
          Definir oferta, público e ação
        </Link>
      </div>
    );
  }
  if (page?.setup === "NO_SECTIONS") {
    return (
      <div className="space-y-3">
        <p className="text-sm">A página ainda não tem seções para medir.</p>
        <Link className={buttonClass("primary")} href={MEASUREMENT_NO_SECTIONS_HREF}>
          Organizar as seções
        </Link>
      </div>
    );
  }
  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <p className="text-sm">{description}</p>
      {pages.length > 1 ? (
        <label className="block text-sm" htmlFor="pagina-mensuracao">
          Página
          <select id="pagina-mensuracao" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3" value={pageId} onChange={(event) => setPageId(event.target.value)}>
            {pages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {page ? (
        <LandingPageMeasurementEditor
          page={page}
          onSave={async (draft: MeasurementEditorSave) => {
            if (!panel) return;
            const saved = await saveLandingPageMeasurementPlanAction(panel.blockKey, {
              landingPageProjectId: page.id,
              expectedRevision: page.draftRevision,
              action: draft.action,
              form: draft.form,
              measurement: draft.measurement,
              confirmed: true,
            });
            if (!saved.ok || !saved.measurementPage) {
              setNotice(saved.ok ? "Não foi possível salvar o plano." : saved.message);
              return;
            }
            setPages((current) => current.map((item) => (item.id === saved.measurementPage?.id ? saved.measurementPage : item)));
            setNotice(saved.completed ? "Plano confirmado." : "O plano foi salvo, mas ainda falta uma configuração válida para concluir a aula.");
            if (saved.completed && saved.snapshot) onSaved?.(saved.snapshot);
          }}
        />
      ) : null}
    </div>
  );
}
