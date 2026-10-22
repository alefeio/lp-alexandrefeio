"use client";

import { useState, type ReactNode } from "react";
import { ResponsivePreviewToolbar } from "@/components/landing-page/ResponsivePreviewToolbar";
import { EXPERIENCE_VIEWPORT_LABEL, EXPERIENCE_VIEWPORT_WIDTH, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";

export function ResponsivePreviewFrame({
  sections,
  initialViewport = "DESKTOP",
  initialMode = "NORMAL",
  children,
}: {
  sections: Array<{ id: string; type: string }>;
  initialViewport?: ExperienceViewportId;
  initialMode?: "NORMAL" | "REVIEW";
  children?: ReactNode;
}) {
  const [viewport, setViewport] = useState<ExperienceViewportId>(initialViewport);
  const [mode, setMode] = useState<"NORMAL" | "REVIEW">(initialMode);
  const width = EXPERIENCE_VIEWPORT_WIDTH[viewport];
  return (
    <div data-preview-mode={mode}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" className="min-h-11 rounded-md border border-border px-3 text-sm" aria-pressed={mode === "NORMAL"} onClick={() => setMode("NORMAL")}>
          Página
        </button>
        <button type="button" className="min-h-11 rounded-md border border-border px-3 text-sm" aria-pressed={mode === "REVIEW"} onClick={() => setMode("REVIEW")}>
          Revisão
        </button>
      </div>
      <ResponsivePreviewToolbar viewport={viewport} onViewport={setViewport} />
      <p className="mt-3 text-sm text-muted" data-preview-label="width">
        {EXPERIENCE_VIEWPORT_LABEL[viewport]}
      </p>
      {mode === "REVIEW" ? (
        <ol className="mt-3 flex flex-wrap gap-2 text-xs text-muted" data-preview-section-labels="true">
          {sections.map((section) => (
            <li key={section.id} className="rounded-md border border-border px-2 py-1">
              {section.type}
            </li>
          ))}
        </ol>
      ) : null}
      <div
        className="mx-auto mt-4 overflow-hidden rounded-xl border border-border"
        data-preview-viewport={viewport}
        data-preview-width={width}
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}
