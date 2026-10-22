"use client";

import { useMemo, useState } from "react";
import { LandingPageRenderer } from "@/components/landing-page/LandingPageRenderer";
import { buttonClass } from "@/lib/button-styles";
import { landingPageActionSchema, type LandingPageAction } from "@/lib/landing-page/actions";
import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import {
  LANDING_PAGE_FORM_FIELD_TYPES,
  LANDING_PAGE_FORM_LIMITS,
  landingPageFormContentSchema,
  normalizeLandingPageFormField,
  type LandingPageFormFieldType,
} from "@/lib/landing-page/forms/schema";
import { availableLandingPageMeasurementEvents, recommendLandingPageMeasurement } from "@/lib/landing-page/measurement/availability";
import {
  MEASUREMENT_DATA_LATER_COPY,
  MEASUREMENT_EVENT_GUIDE,
  MEASUREMENT_PREVIEW_SUBMIT_COPY,
  MEASUREMENT_PRIVACY_COPY,
  enabledFormSection,
  maskWhatsAppPhone,
  measurementActionSummary,
  measurementExperienceNotice,
  measurementGoalText,
  measurementJourneySteps,
  measurementRecommendationCopy,
  type MeasurementPageView,
} from "@/lib/landing-page/measurement/lesson-flow";
import { LANDING_PAGE_MEASUREMENT_LABELS, type LandingPageMeasurementEvent } from "@/lib/landing-page/measurement/schema";

const STEPS = [
  { id: "objetivo", label: "Objetivo" },
  { id: "acao", label: "Ação" },
  { id: "eventos", label: "Eventos" },
  { id: "conversao", label: "Conversão" },
  { id: "formulario", label: "Formulário" },
  { id: "jornada", label: "Jornada" },
  { id: "confirmar", label: "Confirmar" },
] as const;

const FIELD_LABEL: Record<LandingPageFormFieldType, string> = {
  NAME: "Nome",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  COMPANY: "Empresa",
  MESSAGE: "Mensagem",
};

type ActionDraft =
  | { type: "WHATSAPP"; phone: string; message: string }
  | { type: "EXTERNAL_URL"; url: string }
  | { type: "INTERNAL_ROUTE"; path: string }
  | { type: "FORM_ANCHOR"; sectionId: string };

type FieldDraft = { id: string; type: LandingPageFormFieldType; label: string; required: boolean };

type FormDraft = {
  sectionId: string;
  heading: string;
  intro: string;
  submitLabel: string;
  successMessage: string;
  fields: FieldDraft[];
};

export type MeasurementEditorSave = {
  action: unknown;
  form: { sectionId: string; content: unknown } | null;
  measurement: {
    version: 1;
    enabledEvents: LandingPageMeasurementEvent[];
    primaryConversionEvent: LandingPageMeasurementEvent;
  };
};

function actionDraftFrom(action: LandingPageAction | null): ActionDraft {
  if (!action || action.type === "WHATSAPP") return { type: "WHATSAPP", phone: action?.type === "WHATSAPP" ? action.phone : "", message: action?.type === "WHATSAPP" ? action.message ?? "" : "" };
  if (action.type === "EXTERNAL_URL") return { type: "EXTERNAL_URL", url: action.url };
  if (action.type === "INTERNAL_ROUTE") return { type: "INTERNAL_ROUTE", path: action.path };
  return { type: "FORM_ANCHOR", sectionId: action.sectionId ?? "" };
}

function actionPayload(draft: ActionDraft): unknown {
  if (draft.type === "WHATSAPP") {
    return { type: "WHATSAPP", phone: draft.phone, ...(draft.message.trim() ? { message: draft.message.trim() } : {}) };
  }
  if (draft.type === "EXTERNAL_URL") return { type: "EXTERNAL_URL", url: draft.url.trim() };
  if (draft.type === "INTERNAL_ROUTE") return { type: "INTERNAL_ROUTE", path: draft.path.trim() };
  return { type: "FORM_ANCHOR", ...(draft.sectionId ? { sectionId: draft.sectionId } : {}) };
}

function formDraftFrom(document: LandingPageDocumentV1): FormDraft | null {
  const section = enabledFormSection(document);
  if (!section || section.type !== "FORM") return null;
  const fields = section.content.fields.flatMap((field) => {
    const normalized = normalizeLandingPageFormField(field);
    return normalized ? [{ id: normalized.id, type: normalized.type, label: normalized.label, required: normalized.required }] : [];
  });
  return {
    sectionId: section.id,
    heading: section.content.heading ?? "",
    intro: section.content.intro ?? "",
    submitLabel: section.content.submitLabel ?? "",
    successMessage: section.content.successMessage ?? "",
    fields,
  };
}

function formPayload(draft: FormDraft, document: LandingPageDocumentV1): unknown {
  const section = document.sections.find((item) => item.id === draft.sectionId && item.type === "FORM");
  const content: Record<string, unknown> = { fields: draft.fields };
  if (draft.heading.trim()) content.heading = draft.heading.trim();
  if (draft.intro.trim()) content.intro = draft.intro.trim();
  if (draft.submitLabel.trim()) content.submitLabel = draft.submitLabel.trim();
  if (draft.successMessage.trim()) content.successMessage = draft.successMessage.trim();
  if (section && section.type === "FORM" && section.content.consentEnabled) content.consentEnabled = true;
  if (section && section.type === "FORM" && section.content.consentText) content.consentText = section.content.consentText;
  return content;
}

function initialEvents(document: LandingPageDocumentV1): { enabled: LandingPageMeasurementEvent[]; primary: LandingPageMeasurementEvent | null } {
  const available = availableLandingPageMeasurementEvents(document);
  const saved = document.measurement.enabledEvents.filter((event) => available.includes(event));
  const recommendation = recommendLandingPageMeasurement(document);
  return {
    enabled: saved.length > 0 ? saved : recommendation.enabledEvents,
    primary: document.measurement.primaryConversionEvent ?? recommendation.primaryConversionEvent,
  };
}

export function LandingPageMeasurementEditor({
  page,
  onSave,
}: {
  page: MeasurementPageView;
  onSave: (input: MeasurementEditorSave) => Promise<void>;
}) {
  const hydrationKey = `${page.id}:${page.draftRevision}:${page.effectiveStatus}`;
  const [hydratedKey, setHydratedKey] = useState(hydrationKey);
  const [step, setStep] = useState(0);
  const [action, setAction] = useState<ActionDraft>(() => actionDraftFrom(page.document.conversion.primaryAction));
  const [form, setForm] = useState<FormDraft | null>(() => formDraftFrom(page.document));
  const [enabled, setEnabled] = useState<LandingPageMeasurementEvent[]>(() => initialEvents(page.document).enabled);
  const [primary, setPrimary] = useState<LandingPageMeasurementEvent | null>(() => initialEvents(page.document).primary);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (hydratedKey !== hydrationKey) {
    const events = initialEvents(page.document);
    setHydratedKey(hydrationKey);
    setStep(0);
    setAction(actionDraftFrom(page.document.conversion.primaryAction));
    setForm(formDraftFrom(page.document));
    setEnabled(events.enabled);
    setPrimary(events.primary);
    setConfirmed(false);
    setError(null);
    setPending(false);
  }

  const previewDocument = useMemo(() => {
    const next = structuredClone(page.document);
    const parsedAction = landingPageActionSchema.safeParse(actionPayload(action));
    if (parsedAction.success) next.conversion.primaryAction = parsedAction.data;
    if (form) {
      const content = formPayload(form, page.document);
      const parsedForm = landingPageFormContentSchema.safeParse(content);
      const section = next.sections.find((item) => item.id === form.sectionId && item.type === "FORM");
      if (parsedForm.success && section && section.type === "FORM") section.content = parsedForm.data;
    }
    return next;
  }, [action, form, page.document]);

  const available = availableLandingPageMeasurementEvents(previewDocument);
  const enabledVisible = enabled.filter((event) => available.includes(event));
  const primaryVisible = primary && enabledVisible.includes(primary) ? primary : null;
  const recommendation = measurementRecommendationCopy(previewDocument);
  const summary = measurementActionSummary(previewDocument.conversion.primaryAction);
  const notice = measurementExperienceNotice(page.effectiveStatus);
  const destinationReady = landingPageActionSchema.safeParse(actionPayload(action)).success;
  const journey = measurementJourneySteps(enabledVisible, primaryVisible);
  const formSections = page.document.sections.filter((section) => section.type === "FORM" && section.enabled);

  function toggleEvent(event: LandingPageMeasurementEvent) {
    setEnabled((current) => {
      const has = current.includes(event);
      const next = has ? current.filter((item) => item !== event) : [...current, event];
      if (has && primary === event) setPrimary(null);
      return next;
    });
  }

  async function confirmPlan() {
    if (!primaryVisible) {
      setError("Escolha a conversão principal entre os eventos habilitados.");
      return;
    }
    if (!confirmed) {
      setError("Confirme o plano antes de salvar.");
      return;
    }
    const parsedAction = landingPageActionSchema.safeParse(actionPayload(action));
    if (!parsedAction.success) {
      setError("A ação ainda não está configurada de um jeito que a página possa usar.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({
        action: parsedAction.data,
        form: form ? { sectionId: form.sectionId, content: formPayload(form, page.document) } : null,
        measurement: { version: 1, enabledEvents: enabledVisible, primaryConversionEvent: primaryVisible },
      });
    } catch {
      setError("Não foi possível salvar o plano.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden break-words" data-measurement-tool="true">
      {notice ? <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm">{notice}</p> : null}
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((item, index) => (
          <li key={item.id}>
            <button type="button" className={buttonClass("secondary", "min-h-11")} aria-current={step === index ? "step" : undefined} onClick={() => setStep(index)}>
              {index + 1}. {item.label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Qual é o objetivo da página?</h3>
          <p className="text-sm">{measurementGoalText(page.document)}</p>
          <p className="text-sm">O que você espera que o visitante faça? A ação disponível agora é {summary.title}.</p>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-3" data-destination={destinationReady ? "configured" : "missing"}>
          <h3 className="text-base font-semibold">Revise a ação principal</h3>
          <p className="text-sm">
            {summary.title}. {summary.detail}. A visualização não abre o WhatsApp nem o destino externo.
          </p>
          <label className="block text-sm" htmlFor="acao-tipo">
            Tipo da ação
            <select
              id="acao-tipo"
              className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3"
              value={action.type}
              onChange={(event) => {
                const type = event.target.value;
                if (type === "WHATSAPP") setAction({ type: "WHATSAPP", phone: "", message: "" });
                if (type === "EXTERNAL_URL") setAction({ type: "EXTERNAL_URL", url: "" });
                if (type === "INTERNAL_ROUTE") setAction({ type: "INTERNAL_ROUTE", path: "" });
                if (type === "FORM_ANCHOR") setAction({ type: "FORM_ANCHOR", sectionId: formSections[0]?.id ?? "" });
              }}
            >
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EXTERNAL_URL">Destino externo</option>
              <option value="INTERNAL_ROUTE">Página interna</option>
              <option value="FORM_ANCHOR" disabled={formSections.length === 0}>
                Formulário desta página
              </option>
            </select>
          </label>
          {action.type === "WHATSAPP" ? (
            <div className="space-y-3">
              <p className="text-sm">Resumo: {action.phone ? maskWhatsAppPhone(action.phone) : "número ainda não informado"}.</p>
              <label className="block text-sm" htmlFor="acao-telefone">
                Número do WhatsApp
                <input id="acao-telefone" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3" value={action.phone} onChange={(event) => setAction({ type: "WHATSAPP", phone: event.target.value, message: action.message })} />
              </label>
              <label className="block text-sm" htmlFor="acao-mensagem">
                Mensagem inicial, se quiser
                <input id="acao-mensagem" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3" value={action.message} onChange={(event) => setAction({ ...action, message: event.target.value })} />
              </label>
            </div>
          ) : null}
          {action.type === "EXTERNAL_URL" ? (
            <label className="block text-sm" htmlFor="acao-url">
              Destino https
              <input id="acao-url" className="mt-1 min-h-11 w-full min-w-0 break-all rounded-md border border-border px-3" value={action.url} onChange={(event) => setAction({ type: "EXTERNAL_URL", url: event.target.value })} />
            </label>
          ) : null}
          {action.type === "INTERNAL_ROUTE" ? (
            <label className="block text-sm" htmlFor="acao-rota">
              Caminho interno
              <input id="acao-rota" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3" value={action.path} onChange={(event) => setAction({ type: "INTERNAL_ROUTE", path: event.target.value })} />
            </label>
          ) : null}
          {action.type === "FORM_ANCHOR" ? (
            <label className="block text-sm" htmlFor="acao-formulario">
              Formulário da página
              <select id="acao-formulario" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3" value={action.sectionId} onChange={(event) => setAction({ type: "FORM_ANCHOR", sectionId: event.target.value })}>
                <option value="">Escolha o formulário</option>
                {formSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.type === "FORM" ? section.content.heading || "Formulário" : "Formulário"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Eventos disponíveis</h3>
          <ul className="space-y-3">
            {available.map((event) => (
              <li key={event} className="rounded-md border border-border p-3">
                <label className="flex min-h-11 items-start gap-3 text-sm">
                  <input className="mt-1" type="checkbox" checked={enabledVisible.includes(event)} onChange={() => toggleEvent(event)} />
                  <span>
                    <span className="font-medium">{MEASUREMENT_EVENT_GUIDE[event].label}</span>
                    <span className="mt-1 block">{MEASUREMENT_EVENT_GUIDE[event].explanation}</span>
                    <span className="mt-1 block text-muted">{MEASUREMENT_EVENT_GUIDE[event].when}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Conversão principal</h3>
          {recommendation ? <p className="text-sm">{recommendation}</p> : null}
          <div className="space-y-2">
            {enabledVisible.map((event) => (
              <label key={event} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm">
                <input type="radio" name="conversao-principal" checked={primaryVisible === event} onChange={() => setPrimary(event)} />
                {LANDING_PAGE_MEASUREMENT_LABELS[event]}
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Formulário</h3>
          {!form ? <p className="text-sm">Esta página não tem formulário. Nada para revisar aqui.</p> : null}
          {form ? (
            <div className="space-y-3">
              <p className="text-sm">Você realmente precisa desta informação neste primeiro contato? E-mail e telefone não precisam ser obrigatórios juntos.</p>
              <label className="block text-sm" htmlFor="form-titulo">
                Título
                <input id="form-titulo" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3" value={form.heading} onChange={(event) => setForm({ ...form, heading: event.target.value })} />
              </label>
              <label className="block text-sm" htmlFor="form-descricao">
                Descrição
                <textarea id="form-descricao" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3 py-2" value={form.intro} onChange={(event) => setForm({ ...form, intro: event.target.value })} />
              </label>
              <label className="block text-sm" htmlFor="form-botao">
                Texto do botão
                <input id="form-botao" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3" value={form.submitLabel} onChange={(event) => setForm({ ...form, submitLabel: event.target.value })} />
              </label>
              <label className="block text-sm" htmlFor="form-sucesso">
                Mensagem de sucesso
                <input id="form-sucesso" className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3" value={form.successMessage} onChange={(event) => setForm({ ...form, successMessage: event.target.value })} />
              </label>
              <ul className="space-y-3">
                {form.fields.map((field, index) => (
                  <li key={field.id} className="space-y-2 rounded-md border border-border p-3">
                    <label className="block text-sm" htmlFor={`campo-tipo-${field.id}`}>
                      Campo
                      <select
                        id={`campo-tipo-${field.id}`}
                        className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border bg-surface px-3"
                        value={field.type}
                        onChange={(event) => {
                          const type = event.target.value as LandingPageFormFieldType;
                          setForm({
                            ...form,
                            fields: form.fields.map((item, itemIndex) => (itemIndex === index ? { ...item, type, label: FIELD_LABEL[type] } : item)),
                          });
                        }}
                      >
                        {LANDING_PAGE_FORM_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {FIELD_LABEL[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm" htmlFor={`campo-rotulo-${field.id}`}>
                      Rótulo
                      <input
                        id={`campo-rotulo-${field.id}`}
                        className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-border px-3"
                        value={field.label}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            fields: form.fields.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)),
                          })
                        }
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            fields: form.fields.map((item, itemIndex) => (itemIndex === index ? { ...item, required: event.target.checked } : item)),
                          })
                        }
                      />
                      Obrigatório para receber um lead útil
                    </label>
                    {form.fields.length > 1 ? (
                      <button type="button" className={buttonClass("secondary", "min-h-11")} onClick={() => setForm({ ...form, fields: form.fields.filter((_, itemIndex) => itemIndex !== index) })}>
                        Remover campo
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={buttonClass("secondary", "min-h-11")}
                disabled={form.fields.length >= LANDING_PAGE_FORM_LIMITS.maxFields}
                onClick={() =>
                  setForm({
                    ...form,
                    fields: [...form.fields, { id: `campo${form.fields.length + 1}`, type: "NAME", label: "Nome", required: false }],
                  })
                }
              >
                Adicionar campo
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Jornada que será medida</h3>
          <ol className="space-y-2" data-measurement-journey="true">
            {journey.map((item) => (
              <li key={item.event} className="text-sm">
                {item.label}
                {item.primary ? " ★ Conversão principal" : ""}
              </li>
            ))}
          </ol>
          <div data-measurement-simulation="true">
            <h4 className="text-sm font-semibold">Eventos que serão medidos</h4>
            <ul className="mt-2 space-y-1 text-sm">
              {journey.map((item) => (
                <li key={item.event}>{item.label}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm">{MEASUREMENT_DATA_LATER_COPY}</p>
          </div>
        </section>
      ) : null}

      {step === 6 ? (
        <section className="space-y-3">
          <h3 className="text-base font-semibold">Confirme o plano</h3>
          <p className="text-sm">{MEASUREMENT_PRIVACY_COPY}</p>
          <p className="text-sm">
            Conversão principal: {primaryVisible ? LANDING_PAGE_MEASUREMENT_LABELS[primaryVisible] : "ainda não escolhida"}.
          </p>
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            Confirmo que este evento representa o resultado que quero acompanhar nesta página.
          </label>
          {error ? <p className="text-sm">{error}</p> : null}
          <button type="button" className={buttonClass("secondary", "min-h-11")} disabled={pending || !confirmed || !primaryVisible} onClick={() => void confirmPlan()}>
            Salvar plano
          </button>
          <p className="text-sm">Antes de publicar, a revisão de experiência precisa estar atual se a ação ou o formulário mudarem.</p>
        </section>
      ) : null}

      <div className="min-w-0 max-w-full overflow-x-hidden" data-measurement-preview="true">
        <p className="mb-3 text-sm">{MEASUREMENT_PREVIEW_SUBMIT_COPY} A visualização não grava leads nem métricas.</p>
        <LandingPageRenderer document={previewDocument} mode="PREVIEW" />
      </div>
    </div>
  );
}
