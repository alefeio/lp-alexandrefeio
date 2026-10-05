"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { leadObjectives } from "@/data/lead-objectives";
import { siteConfig } from "@/data/site-config";
import { trackEvent } from "@/lib/analytics";
import { buttonClass } from "@/lib/button-styles";
import { cn } from "@/lib/cn";
import type { Service } from "@/types/content";

interface FormValues {
  name: string;
  company: string;
  whatsapp: string;
  objective: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;
type FormStatus = "idle" | "success" | "error";

const EMPTY_VALUES: FormValues = {
  name: "",
  company: "",
  whatsapp: "",
  objective: "",
};

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = "Informe seu nome.";
  }

  if (values.company.trim().length < 2) {
    errors.company = "Informe a empresa.";
  }

  const digits = values.whatsapp.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    errors.whatsapp = "Informe um WhatsApp válido, com DDD.";
  }

  if (!leadObjectives.some((objective) => objective.value === values.objective)) {
    errors.objective = "Selecione o principal objetivo.";
  }

  return errors;
}

function fieldClass(invalid: boolean): string {
  return cn(
    "min-h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground",
    invalid ? "border-danger" : "border-border",
  );
}

/**
 * Formulário do MVP.
 * O envio é simulado: nenhum dado sai do navegador.
 * Para conectar uma API, substitua o bloco de submit e altere
 * siteConfig.features.leadForm para "live".
 */
export function LeadForm({ selectedService }: { selectedService?: Service }) {
  const statusTitleId = useId();
  const started = useRef(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  const [values, setValues] = useState<FormValues>({
    ...EMPTY_VALUES,
    objective: selectedService?.objectiveId ?? "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");

  const selectedId = selectedService?.id;

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
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setLoading(true);
    trackEvent("form_submit", { location: "contact_form", action: values.objective });

    if (siteConfig.features.leadForm === "mock") {
      // MOCK: simula latência. Não enviar estes dados para lugar nenhum.
      await new Promise((resolve) => setTimeout(resolve, 700));
      setLoading(false);
      setStatus("success");
      trackEvent("form_success", { location: "contact_form", action: values.objective });
      return;
    }

    setLoading(false);
    setStatus("error");
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-foreground sm:p-8" role="status">
        <h3 ref={successRef} id={statusTitleId} tabIndex={-1} className="text-2xl font-medium tracking-tight">
          Simulação concluída
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Nenhuma informação foi enviada. Este é o estado de sucesso do MVP, para validar a experiência antes de
          conectar um envio real.
        </p>
        <button
          type="button"
          className={buttonClass("secondary", "mt-6")}
          onClick={() => {
            setStatus("idle");
            setValues({ ...EMPTY_VALUES, objective: selectedService?.objectiveId ?? "" });
            setErrors({});
            started.current = false;
          }}
        >
          Simular outro envio
        </button>
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-border bg-surface p-6 text-foreground sm:p-8"
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
            className={cn(fieldClass(Boolean(errors.objective)), "mt-2")}
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

      {status === "error" ? (
        <p className="mt-5 text-sm text-danger" role="alert">
          O formulário ainda não está conectado a um envio real.
        </p>
      ) : null}

      <button type="submit" className={buttonClass("primary", "mt-6 w-full")} disabled={loading}>
        {loading ? "Enviando simulação..." : siteConfig.ctas.final}
      </button>

      {siteConfig.features.leadForm === "mock" ? (
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          Simulação local: os dados ficam apenas nesta tela e não são enviados.
        </p>
      ) : null}
    </form>
  );
}
