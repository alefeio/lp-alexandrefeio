"use client";

import { useState } from "react";
import { LandingPageExperienceEditor } from "@/components/learning/LandingPageExperienceEditor";
import { experienceReviewFixture } from "@/lib/landing-page/experience/fixture";
import { composeLandingPageExperienceReview, experienceReviewEffectiveStatus, type ExperienceReviewInput } from "@/lib/landing-page/experience/review";
import type { ExperiencePageView } from "@/lib/landing-page/experience/lesson-flow";

function fixturePage(): ExperiencePageView {
  const fixture = experienceReviewFixture();
  return {
    id: "fixture",
    title: "Página sintética",
    status: "READY_TO_PREVIEW",
    draftRevision: 1,
    setup: "READY",
    effectiveStatus: "NOT_REVIEWED",
    document: fixture.document,
    media: fixture.media.map((item) => ({ ...item, fileSize: 120_000 })),
  };
}

export function ExperienceLessonHarness() {
  const [page, setPage] = useState<ExperiencePageView>(fixturePage);
  return (
    <main className="mx-auto w-full max-w-[1360px] px-4 py-6" data-experience-lesson="true">
      <h1 className="text-lg font-semibold">Revisão de experiência sintética</h1>
      <p className="mt-2 text-sm text-muted">Sem projeto gravado e sem publicação.</p>
      <div className="mt-6">
        <LandingPageExperienceEditor
          page={page}
          onSave={async (review: ExperienceReviewInput) => {
            const composed = composeLandingPageExperienceReview(
              page.document,
              page.draftRevision + 1,
              review,
              page.media.map((item) => ({ id: item.id, status: item.status, fileSize: item.fileSize, altText: item.altText })),
            );
            if (!composed.ok) return;
            const document = structuredClone(page.document);
            document.experienceReview = composed.review;
            document.strategy = { ...document.strategy, experienceReview: composed.summary };
            const draftRevision = page.draftRevision + 1;
            setPage({
              ...page,
              draftRevision,
              document,
              effectiveStatus: experienceReviewEffectiveStatus(document, draftRevision),
            });
          }}
        />
      </div>
    </main>
  );
}
