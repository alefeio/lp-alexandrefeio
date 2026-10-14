import type { PublicBlock } from "@/lib/learning/catalog";

export function PublicLessonArticle({ blocks }: { blocks: PublicBlock[] }) {
  return (
    <div className="mt-10 space-y-8">
      {blocks.map((block) => (
        <PreviewBlock key={block.blockKey} block={block} />
      ))}
    </div>
  );
}

function PreviewBlock({ block }: { block: PublicBlock }) {
  const data = block.data;
  if (data.type === "HEADING") {
    return <h2 className="text-2xl font-semibold tracking-tight">{data.text}</h2>;
  }
  if (data.type === "TEXT") {
    return <p className="whitespace-pre-wrap text-base leading-[1.7]">{data.body}</p>;
  }
  if (data.type === "CALLOUT" || data.type === "EXAMPLE") {
    return (
      <aside className="rounded-lg border border-border bg-surface px-5 py-5">
        {data.title ? <p className="font-medium">{data.title}</p> : null}
        <p className={`whitespace-pre-wrap text-base leading-[1.7] ${data.title ? "mt-3" : ""}`}>{data.body}</p>
      </aside>
    );
  }
  return null;
}
