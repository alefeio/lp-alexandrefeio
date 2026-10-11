"use client";

import { useState } from "react";
import { EditorialForm } from "@/components/editorial/EditorialForm";
import { fieldClass } from "@/components/editorial/fields";
import { suggestBlockKey } from "@/lib/editorial/keys";

const TYPES = ["TEXT", "HEADING", "CALLOUT", "EXAMPLE", "CHECKPOINT", "ACTIVITY", "CHECKLIST", "RESULT", "CONCLUSION", "IMAGE"] as const;

export function BlockComposer({
  action,
  updatedAt,
  taken,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  updatedAt: string;
  taken: string[];
}) {
  const [type, setType] = useState<(typeof TYPES)[number]>("TEXT");
  const [source, setSource] = useState("novo-bloco");
  const suggestion = suggestBlockKey(source, taken);

  return (
    <EditorialForm action={action} submit="Criar bloco">
      <input type="hidden" name="updatedAt" value={updatedAt} />
      <label className="block text-sm font-medium">
        Tipo
        <select className={fieldClass} name="type" value={type} onChange={(event) => setType(event.target.value as (typeof TYPES)[number])}>
          {TYPES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Chave
        <input className={fieldClass} name="blockKey" defaultValue={suggestion} key={suggestion} />
      </label>
      <p className="text-sm text-muted">A chave pode ser revista antes da primeira gravação. Depois ela identifica o progresso.</p>
      <BlockFields type={type} onSource={setSource} />
    </EditorialForm>
  );
}

function BlockFields({ type, onSource }: { type: (typeof TYPES)[number]; onSource: (value: string) => void }) {
  if (type === "TEXT" || type === "CONCLUSION") {
    return <Area name="body" label="Texto" onSource={onSource} />;
  }
  if (type === "HEADING") {
    return (
      <>
        <Area name="text" label="Título da seção" onSource={onSource} />
        <label className="block text-sm font-medium">
          Nível
          <select className={fieldClass} name="level" defaultValue="2">
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
      </>
    );
  }
  if (type === "CALLOUT" || type === "EXAMPLE") {
    return (
      <>
        <Area name="title" label="Título" onSource={onSource} />
        <Area name="body" label="Texto" />
        {type === "CALLOUT" ? (
          <label className="block text-sm font-medium">
            Tom
            <select className={fieldClass} name="tone" defaultValue="info">
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="tip">tip</option>
            </select>
          </label>
        ) : null}
      </>
    );
  }
  if (type === "CHECKPOINT") {
    return (
      <>
        <Area name="question" label="Pergunta" onSource={onSource} />
        <Area name="options" label="Opções, uma por linha" />
        <label className="block text-sm font-medium">
          Opção correta (número da linha)
          <input className={fieldClass} name="correct" type="number" min={1} defaultValue={1} />
        </label>
        <Area name="explanation" label="Explicação" />
      </>
    );
  }
  if (type === "ACTIVITY") {
    return (
      <>
        <Area name="prompt" label="Enunciado" onSource={onSource} />
        <label className="block text-sm font-medium">
          Campo
          <select className={fieldClass} name="inputType" defaultValue="long_text">
            <option value="short_text">texto curto</option>
            <option value="long_text">texto longo</option>
          </select>
        </label>
      </>
    );
  }
  if (type === "CHECKLIST") return <Area name="items" label="Itens, um por linha" onSource={onSource} />;
  if (type === "RESULT") {
    return (
      <>
        <Area name="title" label="Título" onSource={onSource} />
        <Area name="prompt" label="Pedido" />
        <Area name="fields" label="Campos, um rótulo por linha" />
      </>
    );
  }
  return (
    <>
      <label className="block text-sm font-medium">
        URL https
        <input className={fieldClass} name="url" onChange={(event) => onSource(event.target.value)} />
      </label>
      <label className="block text-sm font-medium">
        public_id
        <input className={fieldClass} name="publicId" />
      </label>
      <Area name="alt" label="Texto alternativo" />
      <label className="flex items-center gap-2 text-sm">
        <input name="decorative" type="checkbox" />
        Imagem decorativa
      </label>
    </>
  );
}

function Area({ name, label, onSource }: { name: string; label: string; onSource?: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea className={`${fieldClass} min-h-28 py-3`} name={name} onChange={onSource ? (event) => onSource(event.target.value) : undefined} />
    </label>
  );
}
