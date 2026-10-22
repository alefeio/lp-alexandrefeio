"use client";

import type { FormEvent } from "react";
import { normalizeLandingPageFormField, type LandingPageFormFieldInput } from "@/lib/landing-page/forms/schema";

export function LandingPageFormBlock({
  sectionId,
  heading,
  intro,
  fields,
  consentEnabled,
  consentText,
  submitLabel,
  mode = "PREVIEW",
}: {
  sectionId: string;
  heading?: string;
  intro?: string;
  fields: LandingPageFormFieldInput[];
  consentEnabled?: boolean;
  consentText?: string;
  submitLabel?: string;
  mode?: "PREVIEW" | "PUBLIC";
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
        const describedBy = mode === "PREVIEW" ? previewNoteId : undefined;
        return (
          <div key={field.id}>
            <label className="block text-sm font-medium" htmlFor={id}>
              {field.label}
            </label>
            {field.type === "MESSAGE" ? (
              <textarea id={id} name={field.id} rows={4} readOnly required={field.required} placeholder={field.placeholder} aria-describedby={describedBy} className="mt-1 min-h-11 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
            ) : (
              <input
                id={id}
                name={field.id}
                type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : "text"}
                readOnly
                required={field.required}
                placeholder={field.placeholder}
                aria-describedby={describedBy}
                className="mt-1 min-h-11 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2"
              />
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
      {mode === "PREVIEW" ? (
        <p id={previewNoteId} className="break-words text-sm" data-preview-form="disabled">
          Envio desativado no modo de visualização.
        </p>
      ) : null}
      <button type="submit" disabled className="inline-flex min-h-11 max-w-full items-center break-words px-4 py-2 text-sm font-medium opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ backgroundColor: "var(--lp-button-bg)", color: "var(--lp-button-fg)", border: "var(--lp-button-border)", borderRadius: "var(--lp-button-radius)" }}>
        {submitLabel || "Enviar"}
      </button>
    </form>
  );
}
