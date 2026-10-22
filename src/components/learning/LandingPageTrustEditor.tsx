"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { landingPageMessage } from "@/lib/landing-page/errors";
import {
  confirmedProcessProof,
  TRUST_CONSENT_MESSAGE,
  TRUST_MEDIA_UNAVAILABLE,
  TRUST_PROOF_LABELS,
  TRUST_STRUCTURE_CTA,
  TRUST_STRUCTURE_HREF,
  type TrustPageView,
} from "@/lib/landing-page/trust/plan";
import { TRUST_PROOF_TYPES, type TrustProofType } from "@/lib/landing-page/trust/schema";

const PROOF_TYPES = TRUST_PROOF_TYPES;

export function LandingPageTrustEditor({
  page,
  uploadsAvailable,
  savedHref,
  notice,
  onSavePlan,
  onSaveProof,
  onMarkReady,
  onRemoveProof,
  onRemoveMedia,
  onUpload,
}: {
  page: TrustPageView | null;
  uploadsAvailable: boolean;
  savedHref?: string | null;
  notice?: string | null;
  onSavePlan?: (plan: {
    decision: "NO_PROOF_YET" | "SHOW_SELECTED";
    selectedProofIds: string[];
    reviewedProofTypes: TrustProofType[];
    linkTrust: boolean;
    addPortfolio: boolean;
    addTestimonials: boolean;
    mediaAlt: Record<string, string>;
  }) => void;
  onSaveProof?: (proof: Record<string, unknown>) => void;
  onMarkReady?: (proofId: string) => void;
  onRemoveProof?: (proofId: string) => void;
  onRemoveMedia?: (mediaId: string) => void;
  onUpload?: (file: File, altText: string) => Promise<{ ok: boolean; message?: string; mediaId?: string }>;
}) {
  const [type, setType] = useState<TrustProofType>("CREDENTIAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quote, setQuote] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [company, setCompany] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [caseContext, setCaseContext] = useState("");
  const [whatWasDone, setWhatWasDone] = useState("");
  const [result, setResult] = useState("");
  const [issuer, setIssuer] = useState("");
  const [altText, setAltText] = useState("");
  const [decorative, setDecorative] = useState(false);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "sending" | "ready" | "failed">("idle");
  const [decision, setDecision] = useState<"NO_PROOF_YET" | "SHOW_SELECTED">("NO_PROOF_YET");
  const [selected, setSelected] = useState<string[]>([]);
  const [linkTrust, setLinkTrust] = useState(true);
  const [addPortfolio, setAddPortfolio] = useState(false);
  const [addTestimonials, setAddTestimonials] = useState(false);

  if (!page || page.setup === "NEED_SECTIONS") {
    return (
      <p className="text-sm leading-6">
        Sua landing page ainda não tem seções.{" "}
        <Link className="underline" href={TRUST_STRUCTURE_HREF}>{TRUST_STRUCTURE_CTA}</Link>
      </p>
    );
  }

  const ready = page.proofs.filter((proof) => proof.status === "READY_FOR_DISPLAY");

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function submitProof() {
    const proof: Record<string, unknown> = { type, title: title || authorName || "Informação informada" };
    if (description.trim()) proof.description = description.trim();
    if (type === "TESTIMONIAL") {
      proof.quote = quote.trim();
      proof.authorName = authorName.trim();
      proof.title = authorName.trim() || title.trim() || "Depoimento";
      if (authorRole.trim()) proof.authorRole = authorRole.trim();
      if (company.trim()) proof.company = company.trim();
      proof.consentConfirmed = consentConfirmed;
    }
    if (type === "CASE") {
      proof.caseContext = caseContext.trim();
      proof.whatWasDone = whatWasDone.trim();
      if (result.trim()) {
        proof.result = result.trim();
        proof.resultSource = "USER_PROVIDED";
      }
    }
    if (type === "CREDENTIAL" && issuer.trim()) proof.issuer = issuer.trim();
    if (uploadedMediaId && type === "TESTIMONIAL") proof.avatarMediaId = uploadedMediaId;
    if (uploadedMediaId && type !== "TESTIMONIAL") proof.mediaIds = [uploadedMediaId];
    onSaveProof?.(proof);
  }

  async function sendImage(file: File | null) {
    if (!file || !onUpload) return;
    if (!decorative && !altText.trim()) return;
    setUploadState("sending");
    const uploaded = await onUpload(file, altText.trim());
    setUploadState(uploaded.ok ? "ready" : "failed");
    if (uploaded.ok && uploaded.mediaId) setUploadedMediaId(uploaded.mediaId);
  }

  const uploadLabel = uploadState === "sending" ? "Enviando" : uploadState === "ready" ? "Pronta" : uploadState === "failed" ? "Falha" : "Enviar imagem";

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      {page.copyHint ? (
        <p className="text-sm leading-6">A mensagem ainda pode ser completada. Isso não impede o cadastro das provas.</p>
      ) : null}
      <section className="space-y-2">
        <h3 className="text-base font-medium">O que já está cadastrado</h3>
        {page.owned.length > 0 ? (
          <div className="text-sm leading-6">
            <p>Você já possui:</p>
            <ul>{page.owned.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        ) : (
          <p className="text-sm leading-6">Nenhuma prova pronta ainda. Nenhum ainda é uma resposta válida.</p>
        )}
        {page.canPrepare.length > 0 ? (
          <p className="text-sm leading-6">Ainda pode preparar: {page.canPrepare.join(", ")}.</p>
        ) : null}
        {page.proofs.length === 0 ? <p className="text-sm">Nenhum elemento de confiança foi informado.</p> : null}
        <ul className="space-y-3">
          {page.proofs.map((proof) => (
            <li key={proof.id} className="rounded-lg border border-border p-3 text-sm" data-trust-status={proof.status === "READY_FOR_DISPLAY" ? "ready" : "draft"}>
              <p className="font-medium">{TRUST_PROOF_LABELS[proof.type]} · {proof.title}</p>
              <p>{proof.status === "READY_FOR_DISPLAY" ? "Pronto para usar" : "Rascunho"}</p>
              {proof.type === "TESTIMONIAL" && !proof.consentConfirmed ? <p>{TRUST_CONSENT_MESSAGE}</p> : null}
              {proof.referenced ? <p>{landingPageMessage("LANDING_PAGE_TRUST_PROOF_IN_USE")}</p> : (
                <button className={buttonClass("secondary")} type="button" onClick={() => onRemoveProof?.(proof.id)}>Remover</button>
              )}
              {proof.status === "DRAFT" ? (
                <button className={buttonClass("secondary")} type="button" onClick={() => onMarkReady?.(proof.id)}>Marcar como pronto para usar</button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium">Adicionar elemento de confiança</h3>
        <label className="block text-sm">
          Tipo
          <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" value={type} onChange={(event) => setType(event.target.value as TrustProofType)}>
            {PROOF_TYPES.map((item) => <option key={item} value={item}>{TRUST_PROOF_LABELS[item]}</option>)}
          </select>
        </label>
        {type === "TESTIMONIAL" ? (
          <div className="space-y-3">
            <label className="block text-sm">Depoimento<textarea className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={quote} onChange={(event) => setQuote(event.target.value)} /></label>
            <label className="block text-sm">Nome do autor<input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={authorName} onChange={(event) => setAuthorName(event.target.value)} /></label>
            <label className="block text-sm">Cargo ou função, se quiser informar<input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={authorRole} onChange={(event) => setAuthorRole(event.target.value)} /></label>
            <label className="block text-sm">Empresa, se quiser informar<input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={company} onChange={(event) => setCompany(event.target.value)} /></label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} />Tenho autorização para usar este depoimento.</label>
            {consentConfirmed ? null : <p className="text-sm">{TRUST_CONSENT_MESSAGE}</p>}
          </div>
        ) : null}
        {type === "CASE" ? (
          <div className="space-y-3">
            <label className="block text-sm">Título<input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="block text-sm">Contexto<textarea className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={caseContext} onChange={(event) => setCaseContext(event.target.value)} /></label>
            <label className="block text-sm">O que foi feito<textarea className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={whatWasDone} onChange={(event) => setWhatWasDone(event.target.value)} /></label>
            <label className="block text-sm">Resultado, se você realmente o conhece<textarea className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={result} onChange={(event) => setResult(event.target.value)} /></label>
          </div>
        ) : null}
        {type !== "TESTIMONIAL" && type !== "CASE" && type !== "EXPERIENCE" ? (
          <label className="block text-sm">Título<input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        ) : null}
        {type === "CREDENTIAL" ? (
          <label className="block text-sm">Emissor, se quiser informar<input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label>
        ) : null}
        {type === "EXPERIENCE" || type === "BUSINESS_INFORMATION" || type === "OTHER" || type === "PORTFOLIO" || type === "CREDENTIAL" || type === "PROCESS_EVIDENCE" ? (
          <label className="block text-sm">
            {type === "EXPERIENCE" ? "Fato que você confirma" : "Descrição, se quiser informar"}
            <textarea className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
        ) : null}
        {type === "PROCESS_EVIDENCE" && page.processStepCount > 0 ? (
          <button className={buttonClass("secondary")} type="button" onClick={() => {
            const proof = confirmedProcessProof(page.processStepCount);
            if (proof) onSaveProof?.(proof);
          }}>Usar o processo já cadastrado</button>
        ) : null}
        <button className={buttonClass("primary")} type="button" onClick={submitProof}>Salvar elemento</button>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium">Imagem</h3>
        {uploadsAvailable ? (
          <div className="space-y-3">
            <label className="block text-sm">
              Descrição curta
              <input className="mt-1 w-full rounded-lg border border-border px-3 py-3" value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Projeto de cozinha planejada concluído" />
            </label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={decorative} onChange={(event) => setDecorative(event.target.checked)} />Esta imagem é só decorativa.</label>
            <label className="block text-sm">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void sendImage(event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-sm">{uploadLabel}</p>
          </div>
        ) : (
          <p className="text-sm leading-6">{TRUST_MEDIA_UNAVAILABLE}</p>
        )}
        <ul className="space-y-2">
          {page.media.filter((item) => item.status !== "DELETED").map((item) => (
            <li key={item.id} className="text-sm">
              <p>{item.altText || "Imagem"} · {item.status === "READY" ? "Pronta" : item.status === "FAILED" ? "Falha" : "Enviando"}</p>
              {item.referenced ? <p>{landingPageMessage("LANDING_PAGE_MEDIA_IN_USE")}</p> : (
                <button className={buttonClass("secondary")} type="button" onClick={() => onRemoveMedia?.(item.id)}>Excluir imagem</button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {page.trustIntroNeedsWriting ? (
        <p className="text-sm leading-6">O texto de abertura da seção de confiança ainda pode ser escrito por você. A assistência da aula anterior só organiza fatos reais e não cria depoimento.</p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-medium">Decisão</h3>
        <label className="flex gap-2 text-sm"><input type="radio" name="trust-decision" checked={decision === "NO_PROOF_YET"} onChange={() => setDecision("NO_PROOF_YET")} />Eu ainda não possuo provas prontas.</label>
        <label className="flex gap-2 text-sm"><input type="radio" name="trust-decision" checked={decision === "SHOW_SELECTED"} onChange={() => setDecision("SHOW_SELECTED")} />Quero mostrar provas que já estão prontas.</label>
        {decision === "SHOW_SELECTED" ? (
          <div className="space-y-2">
            {page.hasTrust ? <p className="text-sm">Quais desses elementos devem aparecer nesta seção?</p> : null}
            {ready.map((proof) => (
              <label key={proof.id} className="flex gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(proof.id)} onChange={() => toggle(proof.id)} />
                {TRUST_PROOF_LABELS[proof.type]} · {proof.title}
              </label>
            ))}
            {page.hasTrust ? (
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={linkTrust} onChange={(event) => setLinkTrust(event.target.checked)} />Usar a seção de confiança que já existe.</label>
            ) : null}
            {page.canAddPortfolio || page.hasPortfolio ? (
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={addPortfolio} onChange={(event) => setAddPortfolio(event.target.checked)} />{page.hasPortfolio ? "Vincular o portfólio que já existe" : "Adicionar seção de portfólio"}</label>
            ) : null}
            {page.readyTestimonials ? (
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={addTestimonials} onChange={(event) => setAddTestimonials(event.target.checked)} />{page.hasTestimonials ? "Vincular os depoimentos que já existem" : "Adicionar seção de depoimentos"}</label>
            ) : null}
          </div>
        ) : null}
        <button
          className={buttonClass("primary")}
          type="button"
          onClick={() => onSavePlan?.({
            decision,
            selectedProofIds: decision === "SHOW_SELECTED" ? selected : [],
            reviewedProofTypes: [...new Set(page.proofs.map((proof) => proof.type))],
            linkTrust: decision === "SHOW_SELECTED" && page.hasTrust && linkTrust,
            addPortfolio: decision === "SHOW_SELECTED" && addPortfolio,
            addTestimonials: decision === "SHOW_SELECTED" && addTestimonials,
            mediaAlt: uploadedMediaId && altText.trim() ? { [uploadedMediaId]: altText.trim() } : {},
          })}
        >
          Salvar plano de confiança
        </button>
        {savedHref ? <Link className={buttonClass("secondary")} href={savedHref}>Ver na minha página</Link> : null}
        {notice ? <p className="text-sm">{notice}</p> : null}
      </section>
    </div>
  );
}
