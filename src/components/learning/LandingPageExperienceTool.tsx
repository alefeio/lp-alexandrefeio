"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingPageExperienceEditor } from "@/components/learning/LandingPageExperienceEditor";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import { saveLandingPageExperienceReviewAction } from "@/lib/learning/actions";
import type { ExperiencePanel } from "@/lib/landing-page/experience/lesson-flow";
import {
  EXPERIENCE_NO_PROJECT_HREF,
  SITE_EXPERIENCE_SLUG,
  type ExperiencePageView,
} from "@/lib/landing-page/experience/lesson-flow";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import type { ExperienceReviewInput } from "@/lib/landing-page/experience/review";

export function LandingPageExperienceTool({
  panel,
  description,
  onSaved,
}: {
  panel: ExperiencePanel | null;
  description?: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const [pageId, setPageId] = useState(panel?.suggestedPageId ?? panel?.pages[0]?.id ?? "");
  const [pages, setPages] = useState<ExperiencePageView[]>(panel?.pages ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  const page = pages.find((item) => item.id === pageId) ?? null;

  if (!panel || panel.preview) {
    return <p className="text-sm leading-6 text-muted">{description} A ferramenta fica disponível na aula.</p>;
  }
  if (!panel.authenticated) {
    return (
      <Link className={buttonClass("primary")} href={authNextHref("/entrar", `/aulas/${SITE_EXPERIENCE_SLUG}`)}>
        Entrar para revisar a experiência
      </Link>
    );
  }
  if (!page) {
    return (
      <div className="space-y-3" data-experience-setup="NO_PROJECT">
        <p className="text-sm leading-6">Você ainda não tem uma landing page neste curso.</p>
        <Link className={buttonClass("primary")} href={EXPERIENCE_NO_PROJECT_HREF}>
          Começar pela oferta
        </Link>
      </div>
    );
  }

  function replace(next: ExperiencePageView) {
    setPages((current) => current.map((item) => (item.id === next.id ? next : item)));
    setPageId(next.id);
  }

  return (
    <div className="space-y-4">
      {pages.length > 1 ? (
        <label className="block text-sm">
          Página
          <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-surface px-2" value={pageId} onChange={(event) => setPageId(event.target.value)}>
            {pages.map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
      ) : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      <LandingPageExperienceEditor
        page={page}
        onSave={async (review: ExperienceReviewInput, intent) => {
          const saved = await saveLandingPageExperienceReviewAction(panel.blockKey, {
            landingPageProjectId: page.id,
            expectedRevision: page.draftRevision,
            review,
            intent,
          });
          if (!saved.ok || !saved.experiencePage) {
            setNotice(saved.ok ? "Não foi possível salvar a revisão." : saved.message);
            return;
          }
          replace(saved.experiencePage);
          setNotice(intent === "complete" && !saved.completed ? "A revisão foi salva, mas ainda há pontos para concluir." : null);
          if (saved.completed && saved.snapshot) onSaved?.(saved.snapshot);
        }}
      />
    </div>
  );
}
