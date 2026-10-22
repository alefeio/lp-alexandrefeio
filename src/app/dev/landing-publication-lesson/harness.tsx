"use client";

import { LandingPagePublicationEditor } from "@/components/learning/LandingPagePublicationEditor";
import { PUBLICATION_RUNTIME_OFF_COPY, type PublicationPageView } from "@/lib/landing-page/publication/lesson-flow";

export function PublicationLessonHarness({ page }: { page: PublicationPageView }) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1360px] overflow-x-hidden px-4 py-6" data-publication-lesson="true">
      <h1 className="text-lg font-semibold">Revisão de publicação sintética</h1>
      <p className="mt-2 text-sm text-muted">Nenhum projeto foi gravado.</p>
      <div className="mt-6 min-w-0 max-w-full">
        <LandingPagePublicationEditor
          page={page}
          previewOpen
          onPublish={async () => ({ ok: true, lessonComplete: false, message: PUBLICATION_RUNTIME_OFF_COPY })}
        />
      </div>
    </main>
  );
}
