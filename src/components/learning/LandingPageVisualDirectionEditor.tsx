"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { mapLandingPageTheme } from "@/lib/landing-page/theme";
import { evaluateVisualHierarchy } from "@/lib/landing-page/theme/hierarchy";
import {
  assessThemeContrast,
  THEME_BUTTON_STYLES,
  THEME_CONTENT_DENSITY,
  THEME_CONTENT_WIDTHS,
  THEME_FONT_FAMILIES,
  THEME_PRESET_IDS,
  THEME_RADII,
  THEME_SCALES,
  THEME_SECTION_SPACING,
  themePreset,
  type LandingPageThemeV1,
} from "@/lib/landing-page/theme/schema";
import {
  alignmentLabel,
  backgroundRoleLabel,
  buttonStyleLabel,
  contrastLevelLabel,
  contrastPairLabel,
  densityLabel,
  emphasisLabel,
  fontLabel,
  goalLabel,
  presetLabel,
  radiusLabel,
  resolveStartingPoint,
  scaleLabel,
  selectableVariants,
  spacingLabel,
  startingPointLabel,
  variantLabel,
  VISUAL_COLOR_ROLES,
  VISUAL_COPY_HINT,
  VISUAL_CRITICAL_MESSAGE,
  VISUAL_GOALS,
  VISUAL_STRUCTURE_CTA,
  VISUAL_STRUCTURE_HREF,
  visualWarningMessage,
  widthLabel,
  withThemeColor,
  withoutAccent,
  type ThemePresetId,
  type VisualGoal,
  type VisualPageView,
  type VisualSectionView,
} from "@/lib/landing-page/theme/visual-direction";

export const VISUAL_STEPS = [
  { id: "today", label: "Como sua página está hoje" },
  { id: "start", label: "Escolha um ponto de partida" },
  { id: "color", label: "Cores e contraste" },
  { id: "type", label: "Tipografia e ritmo" },
  { id: "sections", label: "Hierarquia das seções" },
  { id: "review", label: "Revisão visual" },
  { id: "preview", label: "Ver na minha página" },
] as const;

export type VisualStepId = (typeof VISUAL_STEPS)[number]["id"];

const COLOR_LABELS: Record<(typeof VISUAL_COLOR_ROLES)[number], string> = {
  background: "Fundo",
  surface: "Superfície",
  text: "Texto",
  mutedText: "Texto secundário",
  primary: "Cor principal",
  primaryText: "Texto sobre a cor principal",
  border: "Borda",
};

export function LandingPageVisualDirectionEditor({
  page,
  theme,
  sections,
  goal,
  step,
  appliedPreset,
  notice,
  saving,
  savedHref,
  onStep,
  onTheme,
  onSections,
  onGoal,
  onApplyPreset,
  onSave,
}: {
  page: VisualPageView;
  theme: LandingPageThemeV1;
  sections: VisualSectionView[];
  goal: VisualGoal;
  step: VisualStepId;
  appliedPreset: ThemePresetId | null;
  notice: string | null;
  saving: boolean;
  savedHref: string | null;
  onStep: (step: VisualStepId) => void;
  onTheme: (theme: LandingPageThemeV1) => void;
  onSections: (sections: VisualSectionView[]) => void;
  onGoal: (goal: VisualGoal) => void;
  onApplyPreset: (id: ThemePresetId) => void;
  onSave: () => void;
}) {
  const index = VISUAL_STEPS.findIndex((item) => item.id === step);
  const report = assessThemeContrast(theme);
  const blocked = report.blocked.length > 0;
  const level = blocked ? "CRITICAL" : report.warnings.length > 0 ? "ATTENTION" : "GOOD";
  const warnings = evaluateVisualHierarchy(theme, sections);
  const origin = resolveStartingPoint(theme, appliedPreset);
  const featured = sections.filter((section) => section.settings.emphasis === "FEATURED");

  if (page.setup === "NEED_SECTIONS") {
    return (
      <p className="text-sm leading-6">
        Sua landing page ainda não tem seções.{" "}
        <Link className="underline" href={VISUAL_STRUCTURE_HREF}>{VISUAL_STRUCTURE_CTA}</Link>
      </p>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden" data-visual-tool data-visual-step={step}>
      <p className="text-sm text-muted">Etapa {index + 1} de {VISUAL_STEPS.length}</p>
      <h3 className="text-lg font-semibold tracking-tight">{VISUAL_STEPS[index]?.label}</h3>
      {page.copyHint ? <p className="break-words text-sm leading-6">{VISUAL_COPY_HINT}</p> : null}
      {step === "today" ? <Today theme={theme} /> : null}
      {step === "start" ? <Start onApplyPreset={onApplyPreset} /> : null}
      {step === "color" ? <Colors theme={theme} sections={sections} level={level} report={report} blocked={blocked} onTheme={onTheme} onSections={onSections} /> : null}
      {step === "type" ? <Rhythm theme={theme} onTheme={onTheme} /> : null}
      {step === "sections" ? <Sections sections={sections} accent={Boolean(theme.colors.accent)} onSections={onSections} /> : null}
      {step === "review" ? (
        <Review
          theme={theme}
          origin={origin}
          goal={goal}
          featured={featured}
          warnings={warnings}
          level={level}
          blocked={blocked}
          onGoal={onGoal}
        />
      ) : null}
      {step === "preview" ? <PreviewNote href={savedHref} /> : null}
      {notice ? <p className="break-words text-sm" role="alert">{notice}</p> : null}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        {index > 0 ? <button type="button" className={buttonClass("secondary")} onClick={() => onStep(VISUAL_STEPS[index - 1].id)}>Voltar</button> : null}
        {index < VISUAL_STEPS.length - 2 ? <button type="button" className={buttonClass("primary")} onClick={() => onStep(VISUAL_STEPS[index + 1].id)}>Continuar</button> : null}
        {step === "review" ? (
          <button type="button" className={buttonClass("primary")} disabled={blocked || saving} data-save-blocked={blocked ? "true" : "false"} onClick={onSave}>
            {saving ? "Salvando" : "Salvar direção visual"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Today({ theme }: { theme: LandingPageThemeV1 }) {
  return (
    <div className="space-y-3">
      <p className="break-words text-sm leading-6">Este é o visual atual da página. Nada foi alterado e nada foi salvo só por abrir esta etapa.</p>
      <ThemeSketch theme={theme} />
      <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <li>Tipografia: {fontLabel(theme.typography.fontFamily)}</li>
        <li>Largura: {widthLabel(theme.layout.contentWidth)}</li>
        <li>Espaçamento: {spacingLabel(theme.layout.sectionSpacing)}</li>
        <li>Botão: {buttonStyleLabel(theme.buttons.style)}</li>
      </ul>
    </div>
  );
}

function Start({ onApplyPreset }: { onApplyPreset: (id: ThemePresetId) => void }) {
  return (
    <div className="space-y-3">
      <p className="break-words text-sm leading-6">Um ponto de partida preenche cores e ritmo. Você pode personalizar depois. Isso ainda não é salvo.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEME_PRESET_IDS.map((id) => (
          <button key={id} type="button" className="min-w-0 rounded-lg border border-border px-3 py-3 text-left text-sm" onClick={() => onApplyPreset(id)}>
            <span className="font-medium">{presetLabel(id)}</span>
            <ThemeSketch theme={themePreset(id)} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Colors({
  theme,
  sections,
  level,
  report,
  blocked,
  onTheme,
  onSections,
}: {
  theme: LandingPageThemeV1;
  sections: VisualSectionView[];
  level: "GOOD" | "ATTENTION" | "CRITICAL";
  report: ReturnType<typeof assessThemeContrast>;
  blocked: boolean;
  onTheme: (theme: LandingPageThemeV1) => void;
  onSections: (sections: VisualSectionView[]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="break-words text-sm leading-6" data-contrast-level={level}>Contraste: {contrastLevelLabel(level)}</p>
      {blocked ? <p className="break-words text-sm" role="alert">{VISUAL_CRITICAL_MESSAGE}</p> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VISUAL_COLOR_ROLES.map((role) => (
          <ColorField key={role} label={COLOR_LABELS[role]} value={theme.colors[role]} onChange={(raw) => {
            const next = withThemeColor(theme, role, raw);
            if (next) onTheme(next);
          }} />
        ))}
      </div>
      <label className="flex min-w-0 items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(theme.colors.accent)} onChange={(event) => {
          if (!event.target.checked) {
            onTheme(withoutAccent(theme));
            onSections(sections.map((section) => section.settings.backgroundRole === "ACCENT" ? { ...section, settings: { ...section.settings, backgroundRole: "DEFAULT" } } : section));
            return;
          }
          const next = withThemeColor(theme, "accent", "#b45309");
          if (next) onTheme(next);
        }} />
        Usar cor de destaque
      </label>
      {theme.colors.accent ? (
        <ColorField label="Destaque" value={theme.colors.accent} onChange={(raw) => {
          const next = withThemeColor(theme, "accent", raw);
          if (next) onTheme(next);
        }} />
      ) : null}
      <ul className="space-y-1 text-sm">
        {report.checks.map((check) => <li key={check.pair} className="break-words">{contrastPairLabel(check.pair)}: {contrastLevelLabel(check.level)}</li>)}
      </ul>
      <details className="text-sm">
        <summary>Detalhe do contraste</summary>
        <ul className="mt-2 space-y-1">
          {report.checks.map((check) => <li key={check.pair}>{contrastPairLabel(check.pair)}: {check.ratio}</li>)}
        </ul>
      </details>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <ColorDraft key={value} label={label} value={value} onChange={onChange} />;
}

function ColorDraft({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <label className="block min-w-0 text-sm">
      {label}
      <span className="mt-1 flex min-w-0 items-center gap-2">
        <input aria-label={`${label} amostra`} className="h-10 w-10 shrink-0" type="color" value={value} onChange={(event) => { setError(null); onChange(event.target.value); }} />
        <input
          aria-label={`${label} hexadecimal`}
          className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2"
          value={draft}
          maxLength={7}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = event.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(next) || /^#[0-9a-fA-F]{3}$/.test(next)) {
              setError(null);
              onChange(next);
            }
          }}
          onBlur={() => {
            if (!/^#[0-9a-fA-F]{6}$/.test(draft.trim()) && !/^#[0-9a-fA-F]{3}$/.test(draft.trim())) {
              setDraft(value);
              setError("Use uma cor no formato #RRGGBB.");
            }
          }}
        />
      </span>
      {error ? <span className="mt-1 block text-xs">{error}</span> : null}
    </label>
  );
}

function Rhythm({ theme, onTheme }: { theme: LandingPageThemeV1; onTheme: (theme: LandingPageThemeV1) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Choice label="Tipografia" value={theme.typography.fontFamily} options={THEME_FONT_FAMILIES.map((value) => ({ value, label: fontLabel(value) }))} onChange={(value) => onTheme({ ...theme, typography: { ...theme.typography, fontFamily: value as LandingPageThemeV1["typography"]["fontFamily"] } })} />
      <Choice label="Escala dos títulos" value={theme.typography.headingScale} options={THEME_SCALES.map((value) => ({ value, label: scaleLabel(value) }))} onChange={(value) => onTheme({ ...theme, typography: { ...theme.typography, headingScale: value as LandingPageThemeV1["typography"]["headingScale"] } })} />
      <Choice label="Largura do conteúdo" value={theme.layout.contentWidth} options={THEME_CONTENT_WIDTHS.map((value) => ({ value, label: widthLabel(value) }))} onChange={(value) => onTheme({ ...theme, layout: { ...theme.layout, contentWidth: value as LandingPageThemeV1["layout"]["contentWidth"] } })} />
      <Choice label="Espaço entre seções" value={theme.layout.sectionSpacing} options={THEME_SECTION_SPACING.map((value) => ({ value, label: spacingLabel(value) }))} onChange={(value) => onTheme({ ...theme, layout: { ...theme.layout, sectionSpacing: value as LandingPageThemeV1["layout"]["sectionSpacing"] } })} />
      <Choice label="Densidade dentro dos grupos" value={theme.layout.contentDensity} options={THEME_CONTENT_DENSITY.map((value) => ({ value, label: densityLabel(value) }))} onChange={(value) => onTheme({ ...theme, layout: { ...theme.layout, contentDensity: value as LandingPageThemeV1["layout"]["contentDensity"] } })} />
      <Choice label="Formato dos botões" value={theme.shape.buttonRadius} options={THEME_RADII.map((value) => ({ value, label: radiusLabel(value) }))} onChange={(value) => onTheme({ ...theme, shape: { ...theme.shape, buttonRadius: value as LandingPageThemeV1["shape"]["buttonRadius"] } })} />
      <Choice label="Formato dos cartões" value={theme.shape.cardRadius} options={THEME_RADII.map((value) => ({ value, label: radiusLabel(value) }))} onChange={(value) => onTheme({ ...theme, shape: { ...theme.shape, cardRadius: value as LandingPageThemeV1["shape"]["cardRadius"] } })} />
      <Choice label="Botão principal" value={theme.buttons.style} options={THEME_BUTTON_STYLES.map((value) => ({ value, label: buttonStyleLabel(value) }))} onChange={(value) => onTheme({ ...theme, buttons: { style: value as LandingPageThemeV1["buttons"]["style"] } })} />
      <p className="break-words text-sm leading-6 sm:col-span-2">A densidade muda o respiro dentro de listas e cartões. O espaço entre seções separa um bloco do próximo. Mais largura não deixa o texto automaticamente mais fácil de ler.</p>
    </div>
  );
}

function Sections({ sections, accent, onSections }: { sections: VisualSectionView[]; accent: boolean; onSections: (sections: VisualSectionView[]) => void }) {
  const roles = accent ? (["DEFAULT", "SURFACE", "PRIMARY", "ACCENT"] as const) : (["DEFAULT", "SURFACE", "PRIMARY"] as const);
  return (
    <div className="grid grid-cols-1 gap-3">
      {sections.map((section) => {
        const variants = selectableVariants(section.type);
        return (
          <article key={section.id} className="min-w-0 space-y-3 rounded-lg border border-border p-3">
            <h4 className="break-words font-medium">{section.label}</h4>
            <p className="text-sm text-muted">{section.type}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Choice label="Fundo" value={section.settings.backgroundRole} options={roles.map((value) => ({ value, label: backgroundRoleLabel(value) }))} onChange={(value) => onSections(sections.map((item) => item.id === section.id ? { ...item, settings: { ...item.settings, backgroundRole: value as VisualSectionView["settings"]["backgroundRole"] } } : item))} />
              <Choice label="Alinhamento" value={section.settings.alignment} options={(["LEFT", "CENTER"] as const).map((value) => ({ value, label: alignmentLabel(value) }))} onChange={(value) => onSections(sections.map((item) => item.id === section.id ? { ...item, settings: { ...item.settings, alignment: value as VisualSectionView["settings"]["alignment"] } } : item))} />
              <Choice label="Ênfase" value={section.settings.emphasis} options={(["NORMAL", "FEATURED"] as const).map((value) => ({ value, label: emphasisLabel(value) }))} onChange={(value) => onSections(sections.map((item) => item.id === section.id ? { ...item, settings: { ...item.settings, emphasis: value as VisualSectionView["settings"]["emphasis"] } } : item))} />
              {variants.length > 1 ? (
                <Choice label="Variação" value={section.variant} options={variants.map((value) => ({ value, label: variantLabel(section.type, value) }))} onChange={(value) => onSections(sections.map((item) => item.id === section.id ? { ...item, variant: value } : item))} />
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Review({
  theme,
  origin,
  goal,
  featured,
  warnings,
  level,
  blocked,
  onGoal,
}: {
  theme: LandingPageThemeV1;
  origin: { startingPoint: "DEFAULT" | "PRESET" | "CUSTOM"; preset?: ThemePresetId };
  goal: VisualGoal;
  featured: VisualSectionView[];
  warnings: ReturnType<typeof evaluateVisualHierarchy>;
  level: "GOOD" | "ATTENTION" | "CRITICAL";
  blocked: boolean;
  onGoal: (goal: VisualGoal) => void;
}) {
  return (
    <div className="space-y-3 text-sm leading-6">
      <p className="break-words">O que precisa receber maior prioridade visual nesta página?</p>
      <Choice label="Prioridade visual" value={goal} options={VISUAL_GOALS.map((value) => ({ value, label: goalLabel(value) }))} onChange={(value) => onGoal(value as VisualGoal)} />
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <li>Origem: {startingPointLabel(origin.startingPoint)}{origin.preset ? ` · ${presetLabel(origin.preset)}` : ""}</li>
        <li>Cor principal: {theme.colors.primary}</li>
        <li>Tipografia: {fontLabel(theme.typography.fontFamily)}</li>
        <li>Largura: {widthLabel(theme.layout.contentWidth)}</li>
        <li>Espaçamento: {spacingLabel(theme.layout.sectionSpacing)}</li>
        <li>Botões: {buttonStyleLabel(theme.buttons.style)}</li>
      </ul>
      <p className="break-words">Seções em destaque: {featured.length === 0 ? "nenhuma" : featured.map((section) => section.label).join(", ")}</p>
      <p data-contrast-level={level}>Contraste: {contrastLevelLabel(level)}</p>
      {blocked ? <p role="alert">{VISUAL_CRITICAL_MESSAGE}</p> : null}
      {warnings.length === 0 ? <p>Nenhum aviso de hierarquia.</p> : (
        <ul className="space-y-2">
          {warnings.map((code) => <li key={code} className="break-words">{visualWarningMessage(code)}</li>)}
        </ul>
      )}
      <p className="break-words">Você pode manter o visual atual. Salvar confirma a decisão. O texto das seções não muda.</p>
    </div>
  );
}

function PreviewNote({ href }: { href: string | null }) {
  if (!href) return <p className="break-words text-sm leading-6">Salve a direção visual para ver estas escolhas na sua página.</p>;
  return (
    <p className="break-words text-sm leading-6">
      A página real mostra o visual salvo.{" "}
      <Link className={buttonClass("primary")} href={href}>Ver minha página</Link>
    </p>
  );
}

function ThemeSketch({ theme }: { theme: LandingPageThemeV1 }) {
  const css = mapLandingPageTheme(theme);
  return (
    <div className="mt-2 min-w-0 max-w-full overflow-hidden rounded-lg border p-3" style={css} data-theme-sketch>
      <p className="break-words font-semibold leading-tight" style={{ fontSize: "var(--lp-heading-size)" }}>Oferta em destaque</p>
      <p className="mt-2 break-words text-sm leading-6" style={{ color: "var(--lp-muted)" }}>Texto de apoio para perceber o ritmo.</p>
      <span className="mt-3 inline-flex max-w-full px-3 py-2 text-sm" style={{ background: "var(--lp-button-bg)", color: "var(--lp-button-fg)", border: "var(--lp-button-border)", borderRadius: "var(--lp-button-radius)" }}>Ação principal</span>
    </div>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0 text-sm">
      {label}
      <select className="mt-1 w-full min-w-0 rounded-lg border border-border px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
