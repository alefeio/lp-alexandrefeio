"use client";

import { useRef, useState, type FormEvent } from "react";
import { normalizeLandingPageFormField, type LandingPageFormFieldInput } from "@/lib/landing-page/forms/schema";
import { publicLandingLifecycle, reportPublicLandingEvent } from "@/lib/landing-page/publication/lifecycle";

export function LandingPageFormBlock({
  sectionId,
  heading,
  intro,
  fields,
  consentEnabled,
  consentText,
  submitLabel,
  successMessage,
  publicSlug,
  mode = "PREVIEW",
}: {
  sectionId: string;
  heading?: string;
  intro?: string;
  fields: LandingPageFormFieldInput[];
  consentEnabled?: boolean;
  consentText?: string;
  submitLabel?: string;
  successMessage?: string;
  publicSlug?: string;
  mode?: "PREVIEW" | "PUBLIC";
}) {
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submissionId = useRef("");
  const normalized = fields.map(normalizeLandingPageFormField).filter((field) => field !== null);

  if (mode !== "PUBLIC") {
    return <PreviewForm sectionId={sectionId} heading={heading} intro={intro} fields={fields} consentEnabled={consentEnabled} consentText={consentText} submitLabel={submitLabel} />;
  }

  function noteStart() {
    if (!publicSlug || !publicLandingLifecycle.once(`${publicSlug}:${sectionId}:FORM_START`)) return;
    reportPublicLandingEvent(publicSlug, { eventType: "FORM_START", sectionId });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!publicSlug || pending) return;
    if (!submissionId.current) submissionId.current = crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    const data = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of normalized) values[field.id] = String(data.get(field.id) ?? "");
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/public/landing-pages/${encodeURIComponent(publicSlug)}/forms/${encodeURIComponent(sectionId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values,
          submissionId: submissionId.current,
          website: String(data.get("website") ?? ""),
          company_website: String(data.get("company_website") ?? ""),
        }),
      });
      const body = (await response.json()) as { ok?: boolean; successMessage?: string; message?: string };
      if (response.ok && body.ok) {
        setDone(body.successMessage || successMessage || "Mensagem enviada.");
        return;
      }
      setError(body.message || "Confira os campos e tente novamente.");
    } catch {
      setError("Não foi possível enviar agora. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  if (done) return <p className="break-words text-base" role="status">{done}</p>;

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{heading}</h2> : null}
      {intro ? <p className="break-words text-base leading-relaxed">{intro}</p> : null}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${sectionId}-website`}>Site</label>
        <input id={`${sectionId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        <label htmlFor={`${sectionId}-company`}>Empresa</label>
        <input id={`${sectionId}-company`} name="company_website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {normalized.map((field) => {
        const id = `${sectionId}-${field.id}`;
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium" htmlFor={id}>{field.label}</label>
            {field.type === "MESSAGE" ? (
              <textarea id={id} name={field.id} rows={4} required={field.required} placeholder={field.placeholder} onFocus={noteStart} className="mt-1 min-h-11 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
            ) : (
              <input id={id} name={field.id} type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text"} required={field.required} placeholder={field.placeholder} onFocus={noteStart} className="mt-1 min-h-11 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
            )}
          </div>
        );
      })}
      {consentEnabled ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" className="mt-1" />
          <span className="break-words">{consentText || "Consentimento"}</span>
        </label>
      ) : null}
      {error ? <p className="break-words text-sm" role="alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-11 max-w-full items-center break-words px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: "var(--lp-button-bg)", color: "var(--lp-button-fg)", border: "var(--lp-button-border)", borderRadius: "var(--lp-button-radius)" }}>
        {submitLabel || "Enviar"}
      </button>
    </form>
  );
}

function PreviewForm({
  sectionId,
  heading,
  intro,
  fields,
  consentEnabled,
  consentText,
  submitLabel,
}: {
  sectionId: string;
  heading?: string;
  intro?: string;
  fields: LandingPageFormFieldInput[];
  consentEnabled?: boolean;
  consentText?: string;
  submitLabel?: string;
}) {
  function blockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }
  const previewNoteId = `${sectionId}-preview-note`;
  const normalized = fields.map(normalizeLandingPageFormField).filter((field) => field !== null);
  return (
    <form className="space-y-4" onSubmit={blockSubmit} noValidate>
      {heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{heading}</h2> : null}
      {intro ? <p className="break-words text-base leading-relaxed">{intro}</p> : null}
      {normalized.map((field) => {
        const id = `${sectionId}-${field.id}`;
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium" htmlFor={id}>{field.label}</label>
            {field.type === "MESSAGE" ? (
              <textarea id={id} name={field.id} rows={4} readOnly required={field.required} placeholder={field.placeholder} aria-describedby={previewNoteId} className="mt-1 min-h-11 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
            ) : (
              <input id={id} name={field.id} type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text"} readOnly required={field.required} placeholder={field.placeholder} aria-describedby={previewNoteId} className="mt-1 min-h-11 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
            )}
          </div>
        );
      })}
      {consentEnabled ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" disabled className="mt-1" />
          <span className="break-words">{consentText || "Consentimento"}</span>
        </label>
      ) : null}
      <p id={previewNoteId} className="break-words text-sm" data-preview-form="disabled">Envio desativado no modo de visualização.</p>
      <button type="submit" disabled className="inline-flex min-h-11 max-w-full items-center break-words px-4 py-2 text-sm font-medium opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: "var(--lp-button-bg)", color: "var(--lp-button-fg)", border: "var(--lp-button-border)", borderRadius: "var(--lp-button-radius)" }}>
        {submitLabel || "Enviar"}
      </button>
    </form>
  );
}
