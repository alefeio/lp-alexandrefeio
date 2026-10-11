import { EditorialForm } from "@/components/editorial/EditorialForm";
import { fieldClass } from "@/components/editorial/fields";
import { parseBlockData, type LessonBlockData } from "@/lib/learning/blocks";

export function ExistingBlock({
  block,
  updatedAt,
  published,
  save,
  remove,
}: {
  block: { id: string; blockKey: string; position: number; payload: unknown };
  updatedAt: string;
  published: boolean;
  save: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  remove: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
}) {
  const data = parseBlockData(block.payload);
  if (!data) return <p className="text-sm">O bloco {block.blockKey} está inválido.</p>;
  return (
    <article className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">{data.type}</p>
      <EditorialForm action={save} submit="Salvar bloco">
        <input type="hidden" name="updatedAt" value={updatedAt} />
        <input type="hidden" name="type" value={data.type} />
        <label className="block text-sm font-medium">
          Chave
          <input className={fieldClass} name="blockKey" defaultValue={block.blockKey} />
        </label>
        {published ? (
          <label className="flex items-center gap-2 text-sm">
            <input name="confirmKeyChange" type="checkbox" />
            Aposentar esta chave e criar outra. O progresso antigo não acompanha.
          </label>
        ) : null}
        <Fields data={data} />
      </EditorialForm>
      <EditorialForm action={remove} submit={published ? "Aposentar bloco" : "Retirar bloco"} />
    </article>
  );
}

function Fields({ data }: { data: LessonBlockData }) {
  if (data.type === "TEXT" || data.type === "CONCLUSION") return <Area name="body" label="Texto" defaultValue={data.body} />;
  if (data.type === "HEADING") {
    return (
      <>
        <Area name="text" label="Título da seção" defaultValue={data.text} />
        <label className="block text-sm font-medium">
          Nível
          <select className={fieldClass} name="level" defaultValue={String(data.level)}>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
      </>
    );
  }
  if (data.type === "CALLOUT" || data.type === "EXAMPLE") {
    return (
      <>
        <Area name="title" label="Título" defaultValue={data.title ?? ""} />
        <Area name="body" label="Texto" defaultValue={data.body} />
        {data.type === "CALLOUT" ? (
          <label className="block text-sm font-medium">
            Tom
            <select className={fieldClass} name="tone" defaultValue={data.tone}>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="tip">tip</option>
            </select>
          </label>
        ) : null}
      </>
    );
  }
  if (data.type === "CHECKPOINT") {
    const correct = data.correctOptionId ? data.options.findIndex((option) => option.id === data.correctOptionId) + 1 : 1;
    return (
      <>
        <Area name="question" label="Pergunta" defaultValue={data.question} />
        <Area name="options" label="Opções, uma por linha" defaultValue={data.options.map((option) => option.label).join("\n")} />
        <label className="block text-sm font-medium">
          Opção correta (número da linha)
          <input className={fieldClass} name="correct" type="number" min={1} defaultValue={correct} />
        </label>
        <Area name="explanation" label="Explicação" defaultValue={data.explanation ?? ""} />
      </>
    );
  }
  if (data.type === "ACTIVITY") {
    return (
      <>
        <Area name="prompt" label="Enunciado" defaultValue={data.prompt} />
        <label className="block text-sm font-medium">
          Campo
          <select className={fieldClass} name="inputType" defaultValue={data.inputType}>
            <option value="short_text">texto curto</option>
            <option value="long_text">texto longo</option>
          </select>
        </label>
      </>
    );
  }
  if (data.type === "CHECKLIST") return <Area name="items" label="Itens, um por linha" defaultValue={data.items.map((item) => item.label).join("\n")} />;
  if (data.type === "RESULT") {
    return (
      <>
        <Area name="title" label="Título" defaultValue={data.title} />
        <Area name="prompt" label="Pedido" defaultValue={data.prompt} />
        <Area name="fields" label="Campos, um rótulo por linha" defaultValue={data.fields.map((field) => field.label).join("\n")} />
      </>
    );
  }
  return (
    <>
      <label className="block text-sm font-medium">
        URL https
        <input className={fieldClass} name="url" defaultValue={data.url} />
      </label>
      <label className="block text-sm font-medium">
        public_id
        <input className={fieldClass} name="publicId" defaultValue={data.publicId ?? ""} />
      </label>
      <Area name="alt" label="Texto alternativo" defaultValue={data.alt ?? ""} />
      <label className="flex items-center gap-2 text-sm">
        <input name="decorative" type="checkbox" defaultChecked={data.decorative === true} />
        Imagem decorativa
      </label>
    </>
  );
}

function Area({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea className={`${fieldClass} min-h-28 py-3`} name={name} defaultValue={defaultValue} />
    </label>
  );
}
