"use client";

import { useState } from "react";
import { createProjectAction, updateProjectAction } from "@/lib/project/actions";
import { DESTINATION_TYPES, PROJECT_OBJECTIVES } from "@/lib/project/schema";
import { buttonClass } from "@/lib/button-styles";

const fieldClass =
  "min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base text-foreground focus-visible:border-cta";

const OBJECTIVE_LABEL: Record<(typeof PROJECT_OBJECTIVES)[number], string> = {
  LEADS: "Receber contatos",
  SALES: "Vender diretamente",
  WHATSAPP: "Receber mensagens no WhatsApp",
  STORE_VISITS: "Levar pessoas a uma loja",
  AWARENESS: "Aumentar reconhecimento",
  UNDEFINED: "Ainda não sei",
};

const DESTINATION_LABEL: Record<(typeof DESTINATION_TYPES)[number], string> = {
  LANDING_PAGE: "Landing page",
  WEBSITE: "Site",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  MARKETPLACE: "Marketplace",
  OTHER: "Outro",
  UNDEFINED: "Ainda não defini",
};

export type ProjectFormValues = {
  name: string;
  segment: string;
  primaryOffer: string;
  objective: string;
  usesGoogleAds: string;
  usesMetaAds: string;
  destinationType: string;
  monthlyMediaBudget: string;
  averageTicket: string;
  websiteUrl: string;
  serviceArea: string;
};

export const emptyProjectForm: ProjectFormValues = {
  name: "",
  segment: "",
  primaryOffer: "",
  objective: "",
  usesGoogleAds: "",
  usesMetaAds: "",
  destinationType: "",
  monthlyMediaBudget: "",
  averageTicket: "",
  websiteUrl: "",
  serviceArea: "",
};

export function ProjectForm({
  mode,
  projectId,
  defaults,
  showContext,
}: {
  mode: "create" | "edit";
  projectId?: string;
  defaults: ProjectFormValues;
  showContext: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = mode === "create" ? await createProjectAction(formData) : await updateProjectAction(projectId ?? "", formData);
    if (result && !result.ok) setError(result.message);
    setPending(false);
  }

  return (
    <form action={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="name" className="text-sm font-medium">
          Nome do projeto
        </label>
        <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={defaults.name} className={`${fieldClass} mt-2`} aria-invalid={error ? true : undefined} aria-describedby={error ? "project-error" : undefined} />
      </div>
      {showContext ? (
        <fieldset className="space-y-5">
          <legend className="text-sm font-medium">Contexto, se você já souber</legend>
          <p className="text-sm leading-relaxed text-muted">Pode deixar em branco e completar depois.</p>
          <div>
            <label htmlFor="segment" className="text-sm font-medium">Segmento</label>
            <input id="segment" name="segment" maxLength={160} defaultValue={defaults.segment} className={`${fieldClass} mt-2`} />
          </div>
          <div>
            <label htmlFor="primaryOffer" className="text-sm font-medium">Oferta principal</label>
            <input id="primaryOffer" name="primaryOffer" maxLength={160} defaultValue={defaults.primaryOffer} className={`${fieldClass} mt-2`} />
          </div>
          <div>
            <label htmlFor="objective" className="text-sm font-medium">Objetivo</label>
            <select id="objective" name="objective" defaultValue={defaults.objective} className={`${fieldClass} mt-2`}>
              <option value="">Ainda não preenchido</option>
              {PROJECT_OBJECTIVES.map((value) => (
                <option key={value} value={value}>{OBJECTIVE_LABEL[value]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="monthlyMediaBudget" className="text-sm font-medium">Orçamento mensal de mídia, em reais</label>
            <input id="monthlyMediaBudget" name="monthlyMediaBudget" inputMode="decimal" defaultValue={defaults.monthlyMediaBudget} className={`${fieldClass} mt-2`} />
          </div>
          {mode === "edit" ? (
            <>
              <div>
                <label htmlFor="destinationType" className="text-sm font-medium">Destino do anúncio</label>
                <select id="destinationType" name="destinationType" defaultValue={defaults.destinationType} className={`${fieldClass} mt-2`}>
                  <option value="">Ainda não preenchido</option>
                  {DESTINATION_TYPES.map((value) => (
                    <option key={value} value={value}>{DESTINATION_LABEL[value]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="usesGoogleAds" className="text-sm font-medium">Usa Google Ads hoje?</label>
                <select id="usesGoogleAds" name="usesGoogleAds" defaultValue={defaults.usesGoogleAds} className={`${fieldClass} mt-2`}>
                  <option value="">Não informado</option>
                  <option value="yes">Sim</option>
                  <option value="no">Não</option>
                </select>
              </div>
              <div>
                <label htmlFor="usesMetaAds" className="text-sm font-medium">Usa Meta Ads hoje?</label>
                <select id="usesMetaAds" name="usesMetaAds" defaultValue={defaults.usesMetaAds} className={`${fieldClass} mt-2`}>
                  <option value="">Não informado</option>
                  <option value="yes">Sim</option>
                  <option value="no">Não</option>
                </select>
              </div>
              <div>
                <label htmlFor="averageTicket" className="text-sm font-medium">Valor aproximado de uma venda, em reais</label>
                <input id="averageTicket" name="averageTicket" inputMode="decimal" defaultValue={defaults.averageTicket} className={`${fieldClass} mt-2`} />
              </div>
              <div>
                <label htmlFor="websiteUrl" className="text-sm font-medium">Site</label>
                <input id="websiteUrl" name="websiteUrl" type="url" defaultValue={defaults.websiteUrl} className={`${fieldClass} mt-2`} />
              </div>
              <div>
                <label htmlFor="serviceArea" className="text-sm font-medium">Área de atendimento</label>
                <input id="serviceArea" name="serviceArea" maxLength={160} defaultValue={defaults.serviceArea} className={`${fieldClass} mt-2`} />
              </div>
            </>
          ) : null}
        </fieldset>
      ) : null}
      {error ? (
        <p id="project-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button className={buttonClass("primary")} type="submit" disabled={pending}>
        {mode === "create" ? "Criar projeto" : "Salvar projeto"}
      </button>
    </form>
  );
}
