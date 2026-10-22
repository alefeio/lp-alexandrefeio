"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingPagePublicationEditor, type PublicationEditorOutcome } from "@/components/learning/LandingPagePublicationEditor";
import { authNextHref } from "@/lib/auth/messages";
import { buttonClass } from "@/lib/button-styles";
import {
  hideLandingPageAction,
  restoreLandingPageVersionAction,
  saveLandingPagePublicationAction,
} from "@/lib/learning/actions";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import {
  PUBLICATION_NO_PROJECT_HREF,
  PUBLICATION_NO_SECTIONS_HREF,
  SITE_PUBLICATION_SLUG,
  type PublicationPageView,
  type PublicationPanel,
} from "@/lib/landing-page/publication/lesson-flow";

export function LandingPagePublicationTool({
  panel,
  description,
  onSaved,
}: {
  panel: PublicationPanel | null;
  description: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const [pages, setPages] = useState<PublicationPageView[]>(panel?.pages ?? []);
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
        <Link className={buttonClass("primary")} href={authNextHref("/entrar", `/aulas/${SITE_PUBLICATION_SLUG}`)}>
          Entrar para revisar e publicar
        </Link>
      </div>
    );
  }
  if (pages.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm">Ainda não há uma landing page sua para publicar.</p>
        <Link className={buttonClass("primary")} href={PUBLICATION_NO_PROJECT_HREF}>
          Definir oferta, público e ação
        </Link>
      </div>
    );
  }
  if (page?.setup === "NO_SECTIONS") {
    return (
      <div className="space-y-3">
        <p className="text-sm">A página ainda não tem seções para publicar.</p>
        <Link className={buttonClass("primary")} href={PUBLICATION_NO_SECTIONS_HREF}>
          Organizar as seções
        </Link>
      </div>
    );
  }

  function replace(next: PublicationPageView) {
    setPages((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  async function publish(input: { expectedDraftRevision: number; acknowledgedWarningCodes: string[] }): Promise<PublicationEditorOutcome> {
    if (!page) return { ok: false, message: "Escolha a página." };
    const saved = await saveLandingPagePublicationAction(panel?.blockKey ?? "ferramenta-publicacao", {
      landingPageProjectId: page.id,
      ...input,
    });
    if (!saved.ok) return { ok: false, message: saved.message, code: saved.code };
    if (saved.publicationPage) replace(saved.publicationPage);
    if (saved.snapshot) onSaved?.(saved.snapshot);
    setNotice(saved.notice ?? null);
    return {
      ok: true,
      lessonComplete: saved.completed,
      message: saved.notice,
      page: saved.publicationPage,
    };
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <p className="text-sm">{description}</p>
      {pages.length > 1 ? (
        <label className="block text-sm" htmlFor="pagina-publicacao">
          Página
          <select
            id="pagina-publicacao"
            className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3"
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
          >
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
        <LandingPagePublicationEditor
          key={page.id}
          page={page}
          onPublish={publish}
          onRestore={async (version) => {
            const item = page.history.find((entry) => entry.version === version);
            if (!item) return { ok: false, message: "Versão indisponível." };
            const saved = await restoreLandingPageVersionAction(panel?.blockKey ?? "ferramenta-publicacao", {
              landingPageProjectId: page.id,
              publicationId: item.id,
            });
            if (!saved.ok) return { ok: false, message: saved.message };
            if (saved.publicationPage) replace(saved.publicationPage);
            return { ok: true, page: saved.publicationPage, message: saved.notice };
          }}
          onHide={async () => {
            const saved = await hideLandingPageAction(panel?.blockKey ?? "ferramenta-publicacao", { landingPageProjectId: page.id });
            if (!saved.ok) return { ok: false, message: saved.message };
            if (saved.publicationPage) replace(saved.publicationPage);
            return { ok: true, page: saved.publicationPage, message: saved.notice };
          }}
        />
      ) : null}
    </div>
  );
}
