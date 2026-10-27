"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { blogCategoryLabel } from "@/lib/blog/catalog";
import { dismissIdeaAction, draftFromIdeaAction, editorialAction, saveIdeaAction } from "@/lib/blog/actions";
import type { EditorialSuggestion } from "@/lib/blog/editorial";

type TrendItem = {
  topic: string;
  trendStatus: string;
  summary: string;
  whyRelevant: string;
  categorySlug: string;
  existingCoverage: string;
  recommendedAction: string;
  suggestedAngle: string;
  sourceUrls: string[];
  sourceDates: string[];
};

export function EditorialDesk({ ideas }: { ideas: Array<{ id: string; title: string; status: string; categorySlug: string; angle: string; rationale: string; draftPostId: string | null }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [coverage, setCoverage] = useState<Record<string, unknown> | null>(null);
  const [suggestions, setSuggestions] = useState<EditorialSuggestion[]>([]);
  const [trends, setTrends] = useState<{ searchedAt: string; items: TrendItem[] } | null>(null);

  async function run(action: "coverage" | "next" | "trends") {
    setPending(true);
    setMessage("");
    const result = await editorialAction(action);
    setPending(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.action === "coverage") setCoverage(result.value);
    if (result.action === "next") setSuggestions(result.suggestions);
    if (result.action === "trends") setTrends({ searchedAt: result.searchedAt, items: result.items });
  }

  async function save(suggestion: EditorialSuggestion) {
    setPending(true);
    const result = await saveIdeaAction(suggestion);
    setPending(false);
    setMessage(result.ok ? "Pauta salva no planejamento." : result.message);
    if (result.ok) router.refresh();
  }

  return (
    <div className="mt-8 grid gap-10">
      <section>
        <h2 className="text-lg font-semibold">Cobertura atual</h2>
        <button type="button" className="mt-3 rounded-md border border-foreground px-3 py-2 text-sm" disabled={pending} onClick={() => run("coverage")}>Analisar cobertura editorial</button>
        {coverage ? <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border p-4 text-sm">{JSON.stringify(coverage, null, 2)}</pre> : null}
      </section>
      <section>
        <h2 className="text-lg font-semibold">Próximos conteúdos</h2>
        <button type="button" className="mt-3 rounded-md border border-foreground px-3 py-2 text-sm" disabled={pending} onClick={() => run("next")}>Sugerir próximos conteúdos</button>
        <ul className="mt-4 space-y-4">
          {suggestions.map((suggestion) => (
            <li key={suggestion.title} className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">{suggestion.title}</p>
              <p className="mt-2 text-muted">{blogCategoryLabel(suggestion.categorySlug)} · {suggestion.contentRole} · {suggestion.searchIntent} · risco {suggestion.duplicateRisk}</p>
              <p className="mt-2">{suggestion.whyNext}</p>
              <p className="mt-2">{suggestion.advice === "ATUALIZAR_ARTIGO_EXISTENTE" ? "Recomendação: atualizar um artigo existente." : suggestion.advice === "CRIAR_ANGULO_DIFERENCIADO" ? "Recomendação: criar um ângulo diferente." : "Pode virar pauta nova."}</p>
              <button type="button" className="mt-3 rounded-md border border-border px-3 py-1.5" disabled={pending} onClick={() => save(suggestion)}>Salvar no planejamento</button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Tendências agora</h2>
        <button type="button" className="mt-3 rounded-md border border-foreground px-3 py-2 text-sm" disabled={pending} onClick={() => run("trends")}>Pesquisar tendências agora</button>
        {trends ? <p className="mt-3 text-sm">Pesquisa realizada em: {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", dateStyle: "short", timeStyle: "short" }).format(new Date(trends.searchedAt))}.</p> : null}
        <ul className="mt-4 space-y-4">
          {trends?.items.map((item) => (
            <li key={item.topic} className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">{item.topic}</p>
              <p className="mt-2 text-muted">{item.trendStatus} · {item.recommendedAction}</p>
              <p className="mt-2">{item.summary}</p>
              {item.sourceDates.length > 0 ? <p className="mt-2 text-muted">Datas: {item.sourceDates.join(", ")}</p> : null}
              <ul className="mt-2 space-y-1">
                {item.sourceUrls.map((url) => (
                  <li key={url}><a href={url} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">{url}</a></li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Ideias editoriais</h2>
        {ideas.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhuma pauta salva.</p> : (
          <ul className="mt-4 space-y-3">
            {ideas.map((idea) => (
              <li key={idea.id} className="rounded-lg border border-border p-4 text-sm">
                <p className="font-medium">{idea.title}</p>
                <p className="mt-1 text-muted">{idea.status} · {blogCategoryLabel(idea.categorySlug)}</p>
                {idea.angle ? <p className="mt-2">{idea.angle}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {idea.status !== "DISMISSED" ? <button type="button" className="rounded-md border border-border px-3 py-1.5" disabled={pending} onClick={async () => { setPending(true); const result = await dismissIdeaAction(idea.id); setPending(false); setMessage(result.ok ? "Pauta descartada." : result.message); if (result.ok) router.refresh(); }}>Descartar</button> : null}
                  {!idea.draftPostId ? <button type="button" className="rounded-md border border-border px-3 py-1.5" disabled={pending} onClick={async () => { setPending(true); const result = await draftFromIdeaAction(idea.id); setPending(false); setMessage(result.ok ? "Rascunho criado. Nada foi publicado." : result.message); if (result.ok) router.push(`/admin/blog/${result.postId}`); }}>Criar rascunho</button> : <a className="rounded-md border border-border px-3 py-1.5" href={`/admin/blog/${idea.draftPostId}`}>Abrir rascunho</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
    </div>
  );
}
