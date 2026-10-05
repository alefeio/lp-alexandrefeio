"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { submitLead } from "@/app/actions/submit-lead";
import { leadObjectives } from "@/data/lead-objectives";
import { siteConfig } from "@/data/site-config";
import { trackEvent } from "@/lib/analytics";
import { buttonClass } from "@/lib/button-styles";
import { buildWhatsAppUrl } from "@/lib/contact";
import { validateLead, type LeadErrors, type LeadField } from "@/lib/lead";
import { cn } from "@/lib/cn";
import type { Service } from "@/types/content";

interface FormValues {
  name: string;
  company: string;
  whatsapp: string;
  email: string;
  objective: string;
}

type FormStatus = "idle" | "success" | "error";

const EMPTY_VALUES: FormValues = {
  name: "",
  company: "",
  whatsapp: "",
  email: "",
  objective: "",
};

function fieldClass(invalid: boolean): string {
  return cn(
    "min-h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground transition-[border-color,box-shadow] duration-200 focus-visible:border-cta disabled:cursor-not-allowed disabled:opacity-60",
    invalid ? "border-danger" : "border-border",
  );
}

export function LeadForm({ selectedService }: { selectedService?: Service }) {
  const statusTitleId = useId();
  const started = useRef(false);
  const sending = useRef(false);
  const startedAt = useRef(0);
  const successRef = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<FormValues>({
    ...EMPTY_VALUES,
    objective: selectedService?.objectiveId ?? "",
  });
  const [errors, setErrors] = useState<LeadErrors>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const whatsappHref = buildWhatsAppUrl();

  const selectedId = selectedService?.id;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("contato")?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [selectedId]);

  useEffect(() => {
    if (status === "success") {
      successRef.current?.focus();
    }
  }, [status]);

  function handleStart() {
    if (started.current) return;
    started.current = true;
    trackEvent("form_start", { location: "contact_form" });
  }

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus("idle");
  }

  function focusFirstError(nextErrors: LeadErrors) {
    const firstInvalid = (Object.keys(nextErrors) as LeadField[]).find((field) => nextErrors[field]);
    if (firstInvalid) document.getElementById(firstInvalid)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;

    const nextErrors = validateLead(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    const extra = String(new FormData(event.currentTarget).get("contact_extra") ?? "");

    sending.current = true;
    setLoading(true);
    setStatus("idle");
    trackEvent("form_submit", { location: "contact_form", action: values.objective });

    try {
      const result = await submitLead({
        ...values,
        extra,
        startedAt: startedAt.current,
      });

      if (result.ok) {
        setConfirmationSent(result.confirmation === "sent");
        setStatus("success");
        trackEvent("form_success", { location: "contact_form", action: values.objective });
        return;
      }

      if (result.reason === "invalid") {
        setErrors(result.errors);
        focusFirstError(result.errors);
        return;
      }

      setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      sending.current = false;
      setLoading(false);
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[0_24px_60px_-36px_rgba(11,18,32,0.75)] sm:p-8"
        role="status"
      >
        <h3
          ref={successRef}
          id={statusTitleId}
          tabIndex={-1}
          className="flex items-start gap-3 text-2xl font-semibold tracking-tight"
        >
          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-cta" />
          {confirmationSent
            ? "Recebi seu contato. Enviei uma confirmação para o seu e-mail."
            : "Recebi seu contato. Em breve conversamos."}
        </h3>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-border bg-surface p-6 text-foreground shadow-[0_24px_60px_-36px_rgba(11,18,32,0.75)] sm:p-8"
      noValidate
      aria-labelledby="contato-titulo"
      aria-busy={loading}
      onFocus={handleStart}
      onSubmit={handleSubmit}
    >
      {selectedService ? (
        <p className="mb-5 text-sm text-muted">
          Oferta selecionada: <span className="font-medium text-foreground">{selectedService.name}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Nome
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={values.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "name-erro" : undefined}
            aria-required="true"
            className={cn(fieldClass(Boolean(errors.name)), "mt-2")}
            onChange={(event) => updateField("name", event.target.value)}
          />
          {errors.name ? (
            <p id="name-erro" className="mt-2 text-sm text-danger">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="company" className="block text-sm font-medium">
            Empresa
          </label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            maxLength={120}
            value={values.company}
            aria-invalid={errors.company ? true : undefined}
            aria-describedby={errors.company ? "company-erro" : undefined}
            aria-required="true"
            className={cn(fieldClass(Boolean(errors.company)), "mt-2")}
            onChange={(event) => updateField("company", event.target.value)}
          />
          {errors.company ? (
            <p id="company-erro" className="mt-2 text-sm text-danger">
              {errors.company}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="whatsapp" className="block text-sm font-medium">
            WhatsApp
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
            value={values.whatsapp}
            aria-invalid={errors.whatsapp ? true : undefined}
            aria-describedby={errors.whatsapp ? "whatsapp-erro" : undefined}
            aria-required="true"
            className={cn(fieldClass(Boolean(errors.whatsapp)), "mt-2")}
            onChange={(event) => updateField("whatsapp", event.target.value)}
          />
          {errors.whatsapp ? (
            <p id="whatsapp-erro" className="mt-2 text-sm text-danger">
              {errors.whatsapp}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={values.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-erro" : undefined}
            aria-required="true"
            className={cn(fieldClass(Boolean(errors.email)), "mt-2")}
            onChange={(event) => updateField("email", event.target.value)}
          />
          {errors.email ? (
            <p id="email-erro" className="mt-2 text-sm text-danger">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="objective" className="block text-sm font-medium">
            Principal objetivo
          </label>
          <select
            id="objective"
            name="objective"
            value={values.objective}
            aria-invalid={errors.objective ? true : undefined}
            aria-describedby={errors.objective ? "objective-erro" : undefined}
            aria-required="true"
            className={cn(fieldClass(Boolean(errors.objective)), "mt-2 cursor-pointer")}
            onChange={(event) => updateField("objective", event.target.value)}
          >
            <option value="">Selecione</option>
            {leadObjectives.map((objective) => (
              <option key={objective.value} value={objective.value}>
                {objective.label}
              </option>
            ))}
          </select>
          {errors.objective ? (
            <p id="objective-erro" className="mt-2 text-sm text-danger">
              {errors.objective}
            </p>
          ) : null}
        </div>
      </div>

      <div hidden aria-hidden="true">
        <label htmlFor="contact-extra">Não preencha este campo</label>
        <input id="contact-extra" name="contact_extra" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {status === "error" ? (
        <p className="mt-5 text-sm text-danger" role="alert">
          Não foi possível enviar agora. Tente novamente ou{" "}
          {whatsappHref ? (
            <a href={whatsappHref} className="font-medium underline underline-offset-4" target="_blank" rel="noopener noreferrer">
              fale comigo pelo WhatsApp
            </a>
          ) : (
            "fale comigo pelo WhatsApp"
          )}
          .
        </p>
      ) : null}

      <button type="submit" className={buttonClass("primary", "mt-6 w-full")} disabled={loading}>
        {loading ? "Enviando..." : siteConfig.ctas.final}
      </button>

      <p className="mt-3 text-center text-sm leading-relaxed text-muted">
        Seus dados serão usados para responder ao contato e enviar a confirmação desta solicitação.{" "}
        <Link href="/privacidade" className="underline underline-offset-4">
          Privacidade
        </Link>
      </p>
    </form>
  );
}
