"use client";

import type { FormEvent } from "react";

const FIELD_LABELS = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  message: "Mensagem",
} as const;

export function LandingPageFormBlock({
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
  fields: Array<"name" | "email" | "phone" | "message">;
  consentEnabled?: boolean;
  consentText?: string;
  submitLabel?: string;
}) {
  function blockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="space-y-4" onSubmit={blockSubmit} noValidate>
      {heading ? <h2 className="text-balance break-words text-2xl font-semibold tracking-tight">{heading}</h2> : null}
      {intro ? <p className="break-words text-base leading-relaxed">{intro}</p> : null}
      {fields.map((field) => {
        const id = `${sectionId}-${field}`;
        const label = FIELD_LABELS[field];
        return (
          <div key={field}>
            <label className="block text-sm font-medium" htmlFor={id}>
              {label}
            </label>
            {field === "message" ? (
              <textarea id={id} name={field} rows={4} readOnly className="mt-1 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
            ) : (
              <input id={id} name={field} type={field === "email" ? "email" : "text"} readOnly className="mt-1 w-full max-w-full rounded-md border border-current/20 bg-transparent px-3 py-2" />
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
      <button type="submit" disabled className="rounded-md px-4 py-2 text-sm font-medium opacity-70">
        {submitLabel || "Enviar"}
      </button>
    </form>
  );
}

