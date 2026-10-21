"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { authNextHref } from "@/lib/auth/messages";
import { saveLandingPageVisualDirectionAction } from "@/lib/learning/actions";
import type { VisualPanel } from "@/lib/learning/landing-page-visual";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { evaluateVisualHierarchy } from "@/lib/landing-page/theme/hierarchy";
import { themePreset, type LandingPageThemeV1 } from "@/lib/landing-page/theme/schema";
import {
  resolveStartingPoint,
  visualUserMessage,
  VISUAL_STRUCTURE_CTA,
  VISUAL_STRUCTURE_HREF,
  type ThemePresetId,
  type VisualGoal,
  type VisualSectionView,
} from "@/lib/landing-page/theme/visual-direction";
import { LandingPageVisualDirectionEditor, type VisualStepId } from "@/components/learning/LandingPageVisualDirectionEditor";

export function LandingPageVisualDirectionTool({
  panel,
  description,
  onSaved,
}: {
  panel: VisualPanel | null;
  description?: string;
  onSaved?: (snapshot: LessonSnapshot) => void;
}) {
  const [pageId, setPageId] = useState(panel?.suggestedPageId ?? panel?.pages[0]?.id ?? "");
  const [pages, setPages] = useState(panel?.pages ?? []);
  const page = pages.find((item) => item.id === pageId) ?? null;
  const [theme, setTheme] = useState<LandingPageThemeV1 | null>(page?.theme ?? null);
  const [sections, setSections] = useState<VisualSectionView[]>(page?.sections ?? []);
  const [goal, setGoal] = useState<VisualGoal>(page?.direction?.primaryVisualGoal ?? "CLARITY");
  const [appliedPreset, setAppliedPreset] = useState<ThemePresetId | null>(page?.direction?.preset ?? null);
  const [step, setStep] = useState<VisualStepId>("today");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHref, setSavedHref] = useState<string | null>(null);

  function selectPage(nextId: string) {
    const next = pages.find((item) => item.id === nextId);
    setPageId(nextId);
    if (!next) return;
    setTheme(next.theme);
    setSections(next.sections);
    setGoal(next.direction?.primaryVisualGoal ?? "CLARITY");
    setAppliedPreset(next.direction?.preset ?? null);
    setStep("today");
    setSavedHref(null);
    setNotice(null);
  }

  if (!panel || panel.preview) {
    return <p className="text-sm leading-6 text-muted">{description} A ferramenta fica disponível na aula.</p>;
  }
  if (!panel.authenticated) {
    return <Link className={buttonClass("primary")} href={authNextHref("/entrar", "/aulas/hierarquia-visual-e-atencao")}>Entrar para definir a hierarquia</Link>;
  }
  if (!page || !theme) {
    return (
      <p className="text-sm leading-6">
        Sua landing page ainda não tem seções.{" "}
        <Link className="underline" href={VISUAL_STRUCTURE_HREF}>{VISUAL_STRUCTURE_CTA}</Link>
      </p>
    );
  }

  const blockKey = panel.blockKey;

  function updateSections(next: VisualSectionView[]) {
    setSections(next);
    setSavedHref(null);
  }

  async function persist() {
    if (!page || !theme) return;
    const origin = resolveStartingPoint(theme, appliedPreset);
    const warnings = evaluateVisualHierarchy(theme, sections);
    setSaving(true);
    setNotice(null);
    const result = await saveLandingPageVisualDirectionAction(blockKey, {
      landingPageProjectId: page.id,
      expectedRevision: page.draftRevision,
      theme,
      sections: sections.map((section) => ({ sectionId: section.id, visualSettings: section.settings, variant: section.variant })),
      direction: {
        startingPoint: origin.startingPoint,
        ...(origin.preset ? { preset: origin.preset } : {}),
        primaryVisualGoal: goal,
        warningsReviewed: warnings,
      },
    });
    setSaving(false);
    if (!result.ok) {
      setNotice(result.message ?? visualUserMessage(result.code ?? ""));
      return;
    }
    if (result.snapshot) onSaved?.(result.snapshot);
    if (result.visualPage) {
      setPages((current) => current.map((item) => (item.id === result.visualPage?.id ? result.visualPage : item)));
      setTheme(result.visualPage.theme);
      setSections(result.visualPage.sections);
    }
    setSavedHref(result.previewHref ?? page.previewHref);
    setStep("preview");
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {description ? <p className="text-sm leading-6 text-muted">{description}</p> : null}
      {pages.length > 1 ? (
        <label className="block min-w-0 text-sm">
          Página
          <select className="mt-1 w-full min-w-0 rounded-lg border border-border px-3 py-2" value={pageId} onChange={(event) => selectPage(event.target.value)}>
            {pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      ) : null}
      <LandingPageVisualDirectionEditor
        page={page}
        theme={theme}
        sections={sections}
        goal={goal}
        step={step}
        appliedPreset={appliedPreset}
        notice={notice}
        saving={saving}
        savedHref={savedHref}
        onStep={setStep}
        onTheme={(next) => { setTheme(next); setSavedHref(null); }}
        onSections={updateSections}
        onGoal={setGoal}
        onApplyPreset={(id) => { setAppliedPreset(id); setTheme(themePreset(id)); setSavedHref(null); }}
        onSave={() => { void persist(); }}
      />
    </div>
  );
}
