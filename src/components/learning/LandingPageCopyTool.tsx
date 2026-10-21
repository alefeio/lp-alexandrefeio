"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import {
  applyLandingPageCopyText,
  approveLandingPageCopy,
  saveLandingPageCopyFactsAction,
  suggestLandingPageCopy,
} from "@/lib/learning/actions";
import type { CopyPanel } from "@/lib/learning/landing-page-copy";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { copyAssistUserMessage, type CopyWorkspace } from "@/lib/landing-page/copy/lesson-flow";
import type { CopySuggestionResponseV1 } from "@/lib/landing-page/copy/schemas";
import { LandingPageCopyWorkspace } from "@/components/learning/LandingPageCopyWorkspace";

export function LandingPageCopyTool({
  panel,
  description,
  onSaved,
}: {
  panel: CopyPanel | null;
  description?: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const [pageId, setPageId] = useState(panel?.suggestedPageId ?? panel?.pages[0]?.id ?? "");
  const [pages, setPages] = useState(panel?.pages ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CopySuggestionResponseV1 | null>(null);
  const page = pages.find((item) => item.id === pageId) ?? null;
  const blockKey = panel?.blockKey ?? "";

  if (!panel || panel.preview) {
    return <p className="text-sm leading-6 text-muted">{description} A ferramenta fica disponível na aula.</p>;
  }
  if (!panel.authenticated) {
    return <Link className={buttonClass("primary")} href={authNextHref("/entrar", "/aulas/mensagem-que-deixa-a-oferta-clara")}>Entrar para escrever</Link>;
  }

  async function run(action: () => Promise<{ ok: boolean; message?: string; code?: string; snapshot?: LessonSnapshot; suggestions?: CopySuggestionResponseV1 | null; workspace?: CopyWorkspace }>) {
    setNotice(null);
    const result = await action();
    if (!result.ok) {
      setNotice(result.message ?? copyAssistUserMessage(result.code ?? ""));
      return;
    }
    if (result.snapshot) onSaved?.(result.snapshot);
    if (result.suggestions) setSuggestions(result.suggestions);
    if (result.suggestions === null) setSuggestions(null);
    if (result.workspace) {
      setPages((current) => current.map((item) => (item.id === result.workspace?.id ? result.workspace! : item)));
    }
  }

  return (
    <div className="space-y-4">
      {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
      {pages.length > 1 ? (
        <label className="block text-sm">
          Página
          <select className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={pageId} onChange={(event) => { setPageId(event.target.value); setSuggestions(null); }}>
            {pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      ) : null}
      <LandingPageCopyWorkspace
        page={page}
        notice={notice}
        loading={loading}
        suggestions={suggestions}
        onSuggest={(sectionId, intent) => {
          setLoading(true);
          void run(() => suggestLandingPageCopy(blockKey, { landingPageProjectId: pageId, sectionId, intent })).finally(() => setLoading(false));
        }}
        onApply={(sectionId, content, origin) => {
          if (!page) return;
          void run(() => applyLandingPageCopyText(blockKey, {
            landingPageProjectId: pageId,
            sectionId,
            expectedRevision: page.draftRevision,
            content,
            origin,
          }));
        }}
        onApprove={(sectionId) => {
          if (!page) return;
          void run(() => approveLandingPageCopy(blockKey, {
            landingPageProjectId: pageId,
            sectionId,
            expectedRevision: page.draftRevision,
          }));
        }}
        onSaveFacts={(facts) => {
          if (!page) return;
          void run(() => saveLandingPageCopyFactsAction(blockKey, {
            landingPageProjectId: pageId,
            expectedRevision: page.draftRevision,
            facts,
          }));
        }}
      />
    </div>
  );
}
