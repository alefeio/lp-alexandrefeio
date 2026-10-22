"use client";

import { useState } from "react";
import { LandingPageMeasurementEditor, type MeasurementEditorSave } from "@/components/learning/LandingPageMeasurementEditor";
import { experienceReviewFixture } from "@/lib/landing-page/experience/fixture";
import { createMemoryLandingPageStore } from "@/lib/landing-page/memory-store";
import { toMeasurementPageView, type MeasurementPageView } from "@/lib/landing-page/measurement/lesson-flow";
import { saveLandingPageMeasurementLesson } from "@/lib/landing-page/measurement/lesson-plan";
import { createLandingPageProject } from "@/lib/landing-page/service";

function fixturePage(): MeasurementPageView {
  const fixture = experienceReviewFixture();
  return {
    id: "fixture",
    title: "Página sintética",
    status: "READY_TO_PREVIEW",
    draftRevision: 1,
    setup: "READY",
    effectiveStatus: "NOT_REVIEWED",
    document: fixture.document,
  };
}

export function MeasurementLessonHarness() {
  const [page, setPage] = useState<MeasurementPageView>(fixturePage);
  const [notice, setNotice] = useState("Sem projeto gravado e sem publicação.");
  return (
    <main className="mx-auto w-full min-w-0 max-w-[1360px] overflow-x-hidden px-4 py-6" data-measurement-lesson="true">
      <h1 className="text-lg font-semibold">Plano de mensuração sintético</h1>
      <p className="mt-2 text-sm text-muted">{notice}</p>
      <div className="mt-6 min-w-0 max-w-full">
        <LandingPageMeasurementEditor
          page={page}
          onSave={async (draft: MeasurementEditorSave) => {
            const store = createMemoryLandingPageStore({ courseIdBySlug: { "sites-que-convertem": "course-sites" } });
            const created = await createLandingPageProject(store, { userId: "fixture", title: "Página sintética", slug: "pagina-sintetica" });
            if (!created.ok) return;
            const seeded = await store.updateDraftAtomic({
              id: created.value.id,
              userId: "fixture",
              expectedRevision: created.value.draftRevision,
              document: page.document,
              status: "READY_TO_PREVIEW",
            });
            if (!seeded.ok) return;
            const saved = await saveLandingPageMeasurementLesson(store, {
              userId: "fixture",
              landingPageProjectId: created.value.id,
              expectedRevision: seeded.record.draftRevision,
              action: draft.action,
              form: draft.form,
              measurement: draft.measurement,
              confirmed: true,
            });
            if (!saved.ok) {
              setNotice("O plano sintético não foi aceito. Nada foi publicado.");
              return;
            }
            setPage(toMeasurementPageView(saved.value));
            setNotice("Plano conferido só nesta memória do navegador. Nenhuma métrica e nenhum lead foram gravados.");
          }}
        />
      </div>
    </main>
  );
}
