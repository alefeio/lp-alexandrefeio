"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import { LandingPageTrustEditor } from "@/components/learning/LandingPageTrustEditor";
import {
  beginLandingPageTrustMediaAction,
  completeLandingPageTrustMediaAction,
  markLandingPageTrustProofReadyAction,
  removeLandingPageTrustMediaAction,
  removeLandingPageTrustProofAction,
  saveLandingPageTrustPlanAction,
  saveLandingPageTrustProofAction,
} from "@/lib/learning/actions";
import type { TrustPanel } from "@/lib/learning/landing-page-trust";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { SITE_TRUST_SLUG, TRUST_MEDIA_UNAVAILABLE, type TrustPageView } from "@/lib/landing-page/trust/plan";

export function LandingPageTrustTool({
  panel,
  description,
  onSaved,
}: {
  panel: TrustPanel | null;
  description?: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const [pageId, setPageId] = useState(panel?.suggestedPageId ?? panel?.pages[0]?.id ?? "");
  const [pages, setPages] = useState<TrustPageView[]>(panel?.pages ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedHref, setSavedHref] = useState<string | null>(null);
  const page = pages.find((item) => item.id === pageId) ?? null;

  if (!panel || panel.preview) {
    return <p className="text-sm leading-6 text-muted">{description} A ferramenta fica disponível na aula.</p>;
  }
  if (!panel.authenticated) {
    return <Link className={buttonClass("primary")} href={authNextHref("/entrar", `/aulas/${SITE_TRUST_SLUG}`)}>Entrar para montar o plano de confiança</Link>;
  }

  function replace(next: TrustPageView) {
    setPages((current) => current.map((item) => (item.id === next.id ? next : item)));
    setPageId(next.id);
  }

  async function upload(file: File, altText: string) {
    void altText;
    if (!page || !panel) return { ok: false, message: TRUST_MEDIA_UNAVAILABLE };
    const started = await beginLandingPageTrustMediaAction(panel.blockKey, {
      landingPageProjectId: page.id,
      type: "PORTFOLIO_IMAGE",
      mimeType: file.type,
      fileSize: file.size,
    });
    if (!started.ok || !started.mediaId || !started.pathname) {
      return { ok: false, message: started.ok ? TRUST_MEDIA_UNAVAILABLE : started.message };
    }
    try {
      const { uploadPresigned } = await import("@vercel/blob/client");
      await uploadPresigned(started.pathname, file, {
        access: "public",
        handleUploadUrl: "/api/landing-pages/media/upload",
        clientPayload: JSON.stringify({ mediaId: started.mediaId }),
        contentType: file.type,
        multipart: false,
      });
      const completed = await completeLandingPageTrustMediaAction(panel.blockKey, started.mediaId);
      if (!completed.ok || !completed.trustPage) return { ok: false, message: completed.ok ? "Falha" : completed.message };
      replace(completed.trustPage);
      return { ok: true, mediaId: started.mediaId };
    } catch {
      return { ok: false, message: "Falha" };
    }
  }

  return (
    <div className="space-y-4">
      {pages.length > 1 ? (
        <label className="block text-sm">
          Página
          <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" value={pageId} onChange={(event) => { setPageId(event.target.value); setSavedHref(null); }}>
            {pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      ) : null}
      <LandingPageTrustEditor
        page={page}
        uploadsAvailable={panel.uploadsAvailable}
        savedHref={savedHref}
        notice={notice}
        onUpload={upload}
        onSaveProof={async (proof) => {
          if (!page) return;
          const saved = await saveLandingPageTrustProofAction(panel.blockKey, {
            landingPageProjectId: page.id,
            expectedRevision: page.draftRevision,
            proof,
          });
          if (!saved.ok || !saved.trustPage) {
            setNotice(saved.ok ? "Não foi possível salvar." : saved.message);
            return;
          }
          replace(saved.trustPage);
          setNotice(null);
        }}
        onMarkReady={async (proofId) => {
          if (!page) return;
          const saved = await markLandingPageTrustProofReadyAction(panel.blockKey, {
            landingPageProjectId: page.id,
            expectedRevision: page.draftRevision,
            proofId,
          });
          if (!saved.ok || !saved.trustPage) {
            setNotice(saved.ok ? TRUST_MEDIA_UNAVAILABLE : saved.message);
            return;
          }
          replace(saved.trustPage);
        }}
        onRemoveProof={async (proofId) => {
          if (!page) return;
          const saved = await removeLandingPageTrustProofAction(panel.blockKey, {
            landingPageProjectId: page.id,
            expectedRevision: page.draftRevision,
            proofId,
          });
          if (!saved.ok || !saved.trustPage) {
            setNotice(saved.ok ? "Não foi possível remover." : saved.message);
            return;
          }
          replace(saved.trustPage);
        }}
        onRemoveMedia={async (mediaId) => {
          if (!page) return;
          const saved = await removeLandingPageTrustMediaAction(panel.blockKey, { mediaId });
          if (!saved.ok || !saved.trustPage) {
            setNotice(saved.ok ? "Não foi possível excluir." : saved.message);
            return;
          }
          replace(saved.trustPage);
        }}
        onSavePlan={async (plan) => {
          if (!page) return;
          const saved = await saveLandingPageTrustPlanAction(panel.blockKey, {
            landingPageProjectId: page.id,
            expectedRevision: page.draftRevision,
            plan,
          });
          if (!saved.ok || !saved.trustPage || !saved.previewHref || !saved.snapshot) {
            setNotice(saved.ok ? "Não foi possível salvar o plano." : saved.message);
            return;
          }
          replace(saved.trustPage);
          setSavedHref(saved.previewHref);
          setNotice(null);
          onSaved?.(saved.snapshot);
        }}
      />
    </div>
  );
}
