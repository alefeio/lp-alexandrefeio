"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonClass } from "@/lib/button-styles";
import { COPY_TRUST_PROOF_TYPES } from "@/lib/landing-page/copy/facts-schema";
import {
  COPY_APPROVAL_NOTE,
  missingFactPrompt,
  type CopySectionView,
  type CopyWorkspace,
} from "@/lib/landing-page/copy/lesson-flow";
import type { CopySuggestionResponseV1 } from "@/lib/landing-page/copy/schemas";

const AULA_4 = "/aulas/oferta-publico-acao-principal";
const AULA_5 = "/aulas/jornada-do-visitante";
const AULA_6 = "/aulas/organize-as-secoes-da-pagina";

const INTENTS = [
  { id: "CLEAR", label: "Clara" },
  { id: "DIRECT", label: "Direta" },
  { id: "WARM", label: "Acolhedora" },
  { id: "PROFESSIONAL", label: "Profissional" },
] as const;

type IntentId = (typeof INTENTS)[number]["id"];

export function LandingPageCopyWorkspace({
  page,
  notice,
  loading,
  suggestions,
  onSuggest,
  onApply,
  onApprove,
  onSaveFacts,
}: {
  page: CopyWorkspace | null;
  notice?: string | null;
  loading?: boolean;
  suggestions?: CopySuggestionResponseV1 | null;
  onSuggest?: (sectionId: string, intent: IntentId) => void;
  onApply?: (sectionId: string, content: unknown, origin: "MANUAL" | "AI_ASSISTED") => void;
  onApprove?: (sectionId: string) => void;
  onSaveFacts?: (facts: unknown) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(page?.sections[0]?.id ?? null);
  const [intent, setIntent] = useState<IntentId>("CLEAR");
  const section = page?.sections.find((item) => item.id === selectedId) ?? page?.sections[0] ?? null;

  if (!page || page.setup === "NEED_PROJECT") {
    return <p className="text-sm leading-6 text-muted">Abra a aula da oferta para criar a página antes de escrever a mensagem.</p>;
  }
  if (page.setup === "NEED_BRIEF") {
    return <SetupLink href={AULA_4} label="Definir oferta, público e ação" />;
  }
  if (page.setup === "NEED_JOURNEY") {
    return <SetupLink href={AULA_5} label="Planejar a jornada do visitante" />;
  }
  if (page.setup === "NEED_SECTIONS") {
    return <SetupLink href={AULA_6} label="Montar a estrutura da página" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <p className="text-sm text-muted">{page.progressLabel}</p>
        {page.coreLabel ? <p className="text-sm font-medium">{page.coreLabel}</p> : null}
        {page.pendingNote ? <p className="text-sm text-muted">{page.pendingNote}</p> : null}
        <ol className="space-y-2">
          {page.sections.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-border px-3 py-2 text-left"
                onClick={() => setSelectedId(item.id)}
                aria-current={section?.id === item.id ? "true" : undefined}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-muted">{item.statusLabel}</span>
                <span className="block text-xs text-muted">{item.purpose}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <div className="space-y-5">
        {section ? (
          <SectionWriter
            key={section.id}
            section={section}
            intent={intent}
            onIntent={setIntent}
            notice={notice}
            loading={loading}
            suggestions={suggestions?.sectionId === section.id ? suggestions : null}
            onSuggest={onSuggest}
            onApply={onApply}
            onApprove={onApprove}
            onSaveFacts={onSaveFacts}
          />
        ) : null}
        <Link className={buttonClass("secondary")} href={page.previewHref}>Ver na minha página</Link>
      </div>
    </div>
  );
}

function SetupLink({ href, label }: { href: string; label: string }) {
  return <Link className={buttonClass("primary")} href={href}>{label}</Link>;
}

function SectionWriter({
  section,
  intent,
  onIntent,
  notice,
  loading,
  suggestions,
  onSuggest,
  onApply,
  onApprove,
  onSaveFacts,
}: {
  section: CopySectionView;
  intent: IntentId;
  onIntent: (intent: IntentId) => void;
  notice?: string | null;
  loading?: boolean;
  suggestions: CopySuggestionResponseV1 | null;
  onSuggest?: (sectionId: string, intent: IntentId) => void;
  onApply?: (sectionId: string, content: unknown, origin: "MANUAL" | "AI_ASSISTED") => void;
  onApprove?: (sectionId: string) => void;
  onSaveFacts?: (facts: unknown) => void;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => editableDraft(section));
  const [writing, setWriting] = useState(section.status !== "PLACEHOLDER");

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{section.label}</h3>
        <p className="text-sm text-muted">O que esta seção precisa fazer</p>
        <p>{section.purpose}</p>
        <p className="text-sm text-muted">{section.statusLabel}</p>
      </div>
      {section.status === "PLACEHOLDER" ? (
        <p className="rounded-lg bg-surface px-3 py-2 text-sm text-muted">A orientação provisória desta seção não é o texto da página.</p>
      ) : (
        <CurrentContent content={section.content} />
      )}
      {section.ai ? (
        <div className="space-y-3">
          <p className="text-sm">A IA usará as informações que você já definiu sobre seu negócio. Revise antes de aplicar.</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Como você quer que esta sugestão soe?</legend>
            {INTENTS.map((item) => (
              <label key={item.id} className="mr-4 text-sm">
                <input type="radio" name={`intent-${section.id}`} checked={intent === item.id} onChange={() => onIntent(item.id)} /> {item.label}
              </label>
            ))}
          </fieldset>
          <button type="button" className={buttonClass("secondary")} disabled={loading} onClick={() => onSuggest?.(section.id, intent)}>
            Sugerir textos com IA
          </button>
          {loading ? <p>Preparando sugestões…</p> : null}
        </div>
      ) : (
        <p className="text-sm text-muted">Esta seção é preenchida por você, sem sugestão automática.</p>
      )}
      {notice ? <p className="text-sm">{notice}</p> : null}
      {suggestions && suggestions.missingFacts.length > 0 ? (
        <FactPrompt codes={suggestions.missingFacts} onSaveFacts={onSaveFacts} />
      ) : null}
      {suggestions?.suggestions.map((item, index) => (
        <article key={item.id} className="space-y-2 rounded-lg border border-border p-3">
          <h4 className="font-medium">Opção {index + 1}</h4>
          <CurrentContent content={item.content} />
          {item.rationale ? <p className="text-xs text-muted">{item.rationale}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass("primary")} onClick={() => onApply?.(section.id, item.content, "AI_ASSISTED")}>Usar esta opção</button>
            <button type="button" className={buttonClass("secondary")} onClick={() => { setDraft(item.content as Record<string, unknown>); setWriting(true); }}>Editar antes de usar</button>
          </div>
        </article>
      ))}
      {!writing ? (
        <button type="button" className={buttonClass("secondary")} onClick={() => setWriting(true)}>Escrever por conta própria</button>
      ) : (
        <ManualFields section={section} draft={draft} onChange={setDraft} onApply={onApply} />
      )}
      <p className="text-sm text-muted">{COPY_APPROVAL_NOTE}</p>
      <button type="button" className={buttonClass("primary")} disabled={section.status !== "DRAFT"} onClick={() => onApprove?.(section.id)}>Aprovar texto</button>
    </section>
  );
}

function CurrentContent({ content }: { content: unknown }) {
  const lines = flattenContent(content);
  if (lines.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm">
      {lines.map((line) => <li key={line}>{line}</li>)}
    </ul>
  );
}

function flattenContent(value: unknown, prefix = ""): string[] {
  if (typeof value === "string" && value.trim()) return [prefix ? `${prefix}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenContent(item, `${prefix}${index + 1}`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      if (key === "type" || key === "phone" || key === "sectionId" || key === "url" || key === "path" || key === "message") return [];
      return flattenContent(item, key);
    });
  }
  return [];
}

function editableDraft(section: CopySectionView): Record<string, unknown> {
  if (section.status === "PLACEHOLDER" || !section.content || typeof section.content !== "object") return {};
  return section.content as Record<string, unknown>;
}

function ManualFields({
  section,
  draft,
  onChange,
  onApply,
}: {
  section: CopySectionView;
  draft: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onApply?: (sectionId: string, content: unknown, origin: "MANUAL" | "AI_ASSISTED") => void;
}) {
  const scalar = scalarFields(section.type);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply?.(section.id, draft, "MANUAL");
      }}
    >
      {scalar.map((field) => (
        <label key={field.key} className="block text-sm">
          {field.label}
          <input
            className="mt-1 w-full rounded-lg border border-border px-3 py-2"
            value={typeof draft[field.key] === "string" ? String(draft[field.key]) : ""}
            onChange={(event) => onChange({ ...draft, [field.key]: event.target.value })}
          />
        </label>
      ))}
      {listKey(section.type) ? (
        <ListFields
          mode={section.type === "FAQ" ? "faq" : "pair"}
          items={Array.isArray(draft[listKey(section.type)!]) ? draft[listKey(section.type)!] as Array<Record<string, string>> : []}
          onChange={(items) => onChange({ ...draft, [listKey(section.type)!]: items })}
        />
      ) : null}
      <button type="submit" className={buttonClass("primary")}>Salvar texto</button>
    </form>
  );
}

function scalarFields(type: string): Array<{ key: string; label: string }> {
  if (type === "HERO") return [
    { key: "eyebrow", label: "Linha curta" },
    { key: "headline", label: "Headline" },
    { key: "subheadline", label: "Complemento" },
    { key: "primaryCtaLabel", label: "Texto do botão" },
  ];
  if (type === "CTA") return [
    { key: "heading", label: "Convite" },
    { key: "description", label: "Complemento" },
    { key: "buttonLabel", label: "Texto do botão" },
  ];
  if (type === "FORM") return [
    { key: "heading", label: "Título" },
    { key: "intro", label: "Introdução" },
    { key: "submitLabel", label: "Texto do envio" },
  ];
  if (type === "CONTACT") return [{ key: "heading", label: "Título" }];
  if (type === "FOOTER") return [
    { key: "brandText", label: "Nome do negócio" },
    { key: "copyrightText", label: "Rodapé" },
  ];
  if (type === "TRUST") return [
    { key: "heading", label: "Título" },
    { key: "intro", label: "Introdução" },
  ];
  return [
    { key: "heading", label: "Título" },
    { key: "description", label: "Texto" },
  ];
}

function listKey(type: string): "items" | "steps" | null {
  if (type === "BENEFITS" || type === "TRUST" || type === "FAQ") return "items";
  if (type === "PROCESS") return "steps";
  return null;
}

function ListFields({
  mode,
  items,
  onChange,
}: {
  mode: "faq" | "pair";
  items: Array<Record<string, string>>;
  onChange: (items: Array<Record<string, string>>) => void;
}) {
  const rows = items.length > 0 ? items : [mode === "faq" ? { question: "", answer: "" } : { title: "", description: "" }];
  const question = mode === "faq";
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2">
          {question ? (
            <>
              <input className="rounded-lg border border-border px-3 py-2" placeholder="Pergunta" value={row.question ?? ""} onChange={(event) => updateRow(rows, index, { question: event.target.value }, onChange)} />
              <input className="rounded-lg border border-border px-3 py-2" placeholder="Resposta" value={row.answer ?? ""} onChange={(event) => updateRow(rows, index, { answer: event.target.value }, onChange)} />
            </>
          ) : (
            <>
              <input className="rounded-lg border border-border px-3 py-2" placeholder="Título" value={row.title ?? ""} onChange={(event) => updateRow(rows, index, { title: event.target.value }, onChange)} />
              <input className="rounded-lg border border-border px-3 py-2" placeholder="Descrição" value={row.description ?? ""} onChange={(event) => updateRow(rows, index, { description: event.target.value }, onChange)} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function updateRow(
  rows: Array<Record<string, string>>,
  index: number,
  patch: Record<string, string>,
  onChange: (items: Array<Record<string, string>>) => void,
) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
}

function FactPrompt({
  codes,
  onSaveFacts,
}: {
  codes: string[];
  onSaveFacts?: (facts: unknown) => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [proofType, setProofType] = useState<(typeof COPY_TRUST_PROOF_TYPES)[number]>("EXPERIENCE");
  const code = codes[0];
  return (
    <form
      className="space-y-2 rounded-lg border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        if (code === "PROCESS_STEPS") onSaveFacts?.({ processSteps: [{ title: title.trim(), ...(detail.trim() ? { description: detail.trim() } : {}) }] });
        else if (code === "TRUST_PROOF") onSaveFacts?.({ trustProofs: [{ type: proofType, title: title.trim(), ...(detail.trim() ? { description: detail.trim() } : {}) }] });
        else if (code === "FAQ_ANSWER" || code === "DELIVERY_TIME") onSaveFacts?.({ objectionAnswers: [{ objection: title.trim(), answerFact: detail.trim() || title.trim() }] });
        else onSaveFacts?.({ additionalBenefits: [{ title: title.trim(), ...(detail.trim() ? { description: detail.trim() } : {}) }] });
      }}
    >
      <p className="text-sm font-medium">Para escrever esta parte sem inventar informações, precisamos saber:</p>
      <ul className="list-disc pl-5 text-sm">
        {codes.map((item) => <li key={item}>{missingFactPrompt(item)}</li>)}
      </ul>
      {code === "TRUST_PROOF" ? (
        <label className="block text-sm">
          Tipo de prova
          <select className="mt-1 w-full rounded-lg border border-border px-3 py-2" value={proofType} onChange={(event) => setProofType(event.target.value as (typeof COPY_TRUST_PROOF_TYPES)[number])}>
            {COPY_TRUST_PROOF_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      ) : null}
      <input className="w-full rounded-lg border border-border px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Fato" />
      <input className="w-full rounded-lg border border-border px-3 py-2" value={detail} onChange={(event) => setDetail(event.target.value)} aria-label="Detalhe do fato" />
      <button type="submit" className={buttonClass("secondary")}>Registrar fato</button>
    </form>
  );
}
