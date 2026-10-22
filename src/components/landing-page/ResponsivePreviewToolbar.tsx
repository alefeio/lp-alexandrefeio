"use client";

import { EXPERIENCE_VIEWPORT_CONTROL, EXPERIENCE_VIEWPORT_IDS, EXPERIENCE_VIEWPORT_LABEL, type ExperienceViewportId } from "@/lib/landing-page/experience/viewports";

export function ResponsivePreviewToolbar({
  viewport,
  onViewport,
}: {
  viewport: ExperienceViewportId;
  onViewport: (viewport: ExperienceViewportId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-preview-toolbar="viewport">
      {EXPERIENCE_VIEWPORT_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={viewport === id}
          data-viewport-choice={id}
          className="min-h-11 rounded-md border border-border px-3 text-sm"
          onClick={() => onViewport(id)}
        >
          {EXPERIENCE_VIEWPORT_CONTROL[id]}
          <span className="ml-2 text-muted">{EXPERIENCE_VIEWPORT_LABEL[id]}</span>
        </button>
      ))}
    </div>
  );
}
