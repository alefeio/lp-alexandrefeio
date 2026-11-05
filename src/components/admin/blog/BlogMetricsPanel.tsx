import Link from "next/link";
import {
  BLOG_METRIC_PERIOD_LABEL,
  BLOG_METRIC_PERIODS,
  blogMetricsHref,
  type BlogMetricsView,
} from "@/lib/admin/blog-metrics";
import type { BlogReadingMetricsView } from "@/lib/admin/blog-reading-metrics";

export function BlogMetricsPanel({
  reading,
  ga4,
}: {
  reading: BlogReadingMetricsView;
  ga4: BlogMetricsView;
}) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Admin</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Métricas do blog</h1>
        <Link href="/admin/blog" className="text-sm underline underline-offset-4">Voltar aos artigos</Link>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        O bloco first-party usa sessões observadas no PostgreSQL. O GA4 continua opcional e separado, sem somar os dois universos.
      </p>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Período">
        {BLOG_METRIC_PERIODS.map((period) => (
          <Link
            key={period}
            href={blogMetricsHref(period)}
            aria-current={reading.period === period ? "page" : undefined}
            className={reading.period === period ? "rounded-md border border-foreground px-3 py-1.5 text-sm font-medium" : "rounded-md border border-border px-3 py-1.5 text-sm text-muted"}
          >
            {BLOG_METRIC_PERIOD_LABEL[period]}
          </Link>
        ))}
      </nav>
      <ReadingSection view={reading} />
      <Ga4Section view={ga4} />
    </>
  );
}

function ReadingSection({ view }: { view: BlogReadingMetricsView }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">Leitura first-party</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed">{view.queryLabel}</p>
      {!view.ingestEnabled ? (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
          Coleta pública desligada (`BLOG_READING_INGEST_ENABLED` diferente de true). O painel só mostra o que já estiver no banco.
        </p>
      ) : null}
      {view.sampleWarning ? <p className="mt-3 max-w-3xl text-sm leading-relaxed">{view.sampleWarning}</p> : null}
      {view.status === "migration_missing" || view.status === "unavailable" ? (
        <div className="mt-6 max-w-3xl rounded-lg border border-border p-4">
          <h3 className="text-lg font-semibold">{view.status === "migration_missing" ? "Migration pendente" : "Consulta indisponível"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{view.message}</p>
        </div>
      ) : null}
      {view.status === "empty" || view.status === "ready" ? (
        <>
          {view.message ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{view.message}</p> : null}
          {view.totals ? <ReadingTotals totals={view.totals} /> : null}
          <ReadingArticles articles={view.articles} />
          <ReadingCategories rows={view.categories} />
        </>
      ) : null}
    </section>
  );
}

function ReadingTotals({ totals }: { totals: NonNullable<BlogReadingMetricsView["totals"]> }) {
  const cards = [
    { label: "Sessões observadas", value: totals.sessions },
    { label: "Navegadores distintos", value: totals.browsers },
    { label: "Tempo ativo médio", value: formatMs(totals.meanActiveMs) },
    { label: "Tempo ativo mediano", value: formatMs(totals.medianActiveMs) },
    { label: "Leitores engajados", value: totals.engaged },
    { label: "Leitura profunda", value: totals.deep },
    { label: "Profundidade ≥ 25%", value: totals.depth25 },
    { label: "Profundidade ≥ 50%", value: totals.depth50 },
    { label: "Profundidade ≥ 75%", value: totals.depth75 },
    { label: "Final alcançado", value: totals.reachedEnd },
    { label: "Cliques para cursos", value: totals.courseClicks },
    { label: "Cliques para serviços", value: totals.serviceClicks },
    { label: "Taxa de cliques por sessão", value: formatRate(totals.clickRate) },
  ];
  return (
    <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.label} className="rounded-lg border border-border p-4">
          <p className="text-sm">{card.label}</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{card.value}</p>
        </li>
      ))}
    </ul>
  );
}

function ReadingArticles({ articles }: { articles: BlogReadingMetricsView["articles"] }) {
  return (
    <section className="mt-10">
      <h3 className="text-lg font-semibold">Ranking de artigos</h3>
      {articles.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum artigo publicado.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
            <caption className="sr-only">Artigos por sessões first-party</caption>
            <thead>
              <tr className="border-b border-border text-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Título</th>
                <th scope="col" className="px-3 py-2 font-medium">Categoria</th>
                <th scope="col" className="px-3 py-2 font-medium">Sessões</th>
                <th scope="col" className="px-3 py-2 font-medium">Tempo médio</th>
                <th scope="col" className="px-3 py-2 font-medium">Engajados</th>
                <th scope="col" className="px-3 py-2 font-medium">Profundos</th>
                <th scope="col" className="px-3 py-2 font-medium">Final</th>
                <th scope="col" className="px-3 py-2 font-medium">Cursos</th>
                <th scope="col" className="px-3 py-2 font-medium">Serviços</th>
                <th scope="col" className="px-3 py-2 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => (
                <tr key={article.key} className="border-b border-border">
                  <th scope="row" className="py-2 pr-3 font-normal">
                    {article.url ? <Link href={article.url} className="underline-offset-4 hover:underline">{article.title}</Link> : article.title}
                    {article.removed ? <span className="mt-1 block text-xs text-muted">Artigo removido; slug observado preservado.</span> : null}
                    {!article.removed && article.sessions === 0 ? <span className="mt-1 block text-xs text-muted">Sem sessões neste recorte.</span> : null}
                  </th>
                  <td className="px-3 py-2">{article.category}</td>
                  <td className="px-3 py-2 tabular-nums">{article.sessions}</td>
                  <td className="px-3 py-2 tabular-nums">{formatMs(article.meanActiveMs)}</td>
                  <td className="px-3 py-2 tabular-nums">{article.engaged}</td>
                  <td className="px-3 py-2 tabular-nums">{article.deep}</td>
                  <td className="px-3 py-2 tabular-nums">{article.reachedEnd}</td>
                  <td className="px-3 py-2 tabular-nums">{article.courseClicks}</td>
                  <td className="px-3 py-2 tabular-nums">{article.serviceClicks}</td>
                  <td className="px-3 py-2 tabular-nums">{formatRate(article.clickRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ReadingCategories({ rows }: { rows: BlogReadingMetricsView["categories"] }) {
  return (
    <section className="mt-10">
      <h3 className="text-lg font-semibold">Comparação por categoria</h3>
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhuma categoria com sessão neste recorte.</p> : (
        <ul className="mt-3 max-w-xl space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="border-b border-border py-2">
              <div className="flex items-baseline justify-between gap-4">
                <span>{row.label}</span>
                <span className="tabular-nums">{row.sessions} sessões</span>
              </div>
              <p className="mt-1 text-muted">
                Engajados {row.engaged} · Profundos {row.deep} · Cursos {row.courseClicks} · Serviços {row.serviceClicks}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Ga4Section({ view }: { view: BlogMetricsView }) {
  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="text-xl font-semibold tracking-tight">GA4 complementar</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Visualizações e origem de tráfego vêm dos relatórios agregados do GA4. Este bloco é opcional e não entra nas contas first-party.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed">{view.queryLabel}</p>
      {view.status === "ready" ? <Ga4Ready view={view} /> : <Ga4Pending view={view} />}
    </section>
  );
}

function Ga4Pending({ view }: { view: BlogMetricsView }) {
  return (
    <div className="mt-6 max-w-3xl rounded-lg border border-border p-4">
      <h3 className="text-lg font-semibold">{view.status === "unconfigured" ? "Configuração pendente" : view.status === "unavailable" ? "GA4 indisponível" : "Sem dados neste recorte"}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{view.message || "Não há visualização de blog para mostrar."}</p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{view.clickNote}</p>
    </div>
  );
}

function Ga4Ready({ view }: { view: BlogMetricsView }) {
  return (
    <>
      {view.scopeNote ? <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted">{view.scopeNote}</p> : null}
      {view.message ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{view.message}</p> : null}
      {view.insight ? <p className="mt-3 max-w-3xl text-sm leading-relaxed">{view.insight}</p> : null}
      {view.totals ? (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li className="rounded-lg border border-border p-4">
            <p className="text-sm">Visualizações</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{view.totals.views == null ? "—" : view.totals.views}</p>
          </li>
          <li className="rounded-lg border border-border p-4">
            <p className="text-sm">Usuários ativos</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{view.totals.activeUsers == null ? "—" : view.totals.activeUsers}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{view.activeUserNote}</p>
          </li>
        </ul>
      ) : null}
      <section className="mt-10">
        <h3 className="text-lg font-semibold">Artigos (GA4)</h3>
        {view.articles.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum artigo publicado.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <caption className="sr-only">Artigos publicados por visualização</caption>
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Título</th>
                  <th scope="col" className="px-3 py-2 font-medium">Categoria</th>
                  <th scope="col" className="px-3 py-2 font-medium">URL</th>
                  <th scope="col" className="px-3 py-2 font-medium">Visualizações</th>
                  <th scope="col" className="px-3 py-2 font-medium">Usuários ativos</th>
                </tr>
              </thead>
              <tbody>
                {view.articles.map((article) => (
                  <tr key={article.url} className="border-b border-border">
                    <th scope="row" className="py-2 pr-3 font-normal">{article.title}</th>
                    <td className="px-3 py-2">{article.category}</td>
                    <td className="px-3 py-2">{article.url}</td>
                    <td className="px-3 py-2 tabular-nums">{article.views}</td>
                    <td className="px-3 py-2 tabular-nums">{article.activeUsers == null ? "—" : article.activeUsers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {view.listing ? (
        <p className="mt-4 text-sm">Listagem /blog: <strong className="tabular-nums">{view.listing.views}</strong> visualizações. Usuários ativos: <strong className="tabular-nums">{view.listing.activeUsers == null ? "—" : view.listing.activeUsers}</strong>.</p>
      ) : null}
      <Split title="Categorias (GA4)" rows={view.categories.map((row) => ({ label: row.label, value: row.views }))} empty="Nenhuma categoria com visualização." />
      <Split title="Origem de tráfego" rows={view.sources.map((row) => ({ label: row.label, value: row.views }))} empty="O GA4 não devolveu origem neste conjunto." note={view.sourceNote} />
      <section className="mt-10">
        <h3 className="text-lg font-semibold">Evolução</h3>
        {view.seriesNote ? <p className="mt-2 max-w-3xl text-sm text-muted">{view.seriesNote}</p> : null}
        {view.series.length === 0 ? <p className="mt-3 text-sm text-muted">Sem visualização diária neste recorte.</p> : (
          <div className="mt-4 max-w-md">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Visualizações por dia</caption>
              <thead>
                <tr className="border-b border-border text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Dia</th>
                  <th scope="col" className="px-3 py-2 font-medium">Visualizações</th>
                </tr>
              </thead>
              <tbody>
                {view.series.map((row) => (
                  <tr key={row.label} className="border-b border-border">
                    <th scope="row" className="py-2 pr-3 font-normal">{row.label}</th>
                    <td className="px-3 py-2 tabular-nums">{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {view.unmatched.length > 0 ? (
        <section className="mt-10">
          <h3 className="text-lg font-semibold">URLs sem artigo publicado</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">Caminhos antigos ou fora do catálogo atual. Eles não herdam o título de um artigo renomeado.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {view.unmatched.map((row) => (
              <li key={row.path}>{row.path}: <span className="tabular-nums">{row.views}</span></li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">{view.clickNote}</p>
    </>
  );
}

function Split({ title, rows, empty, note }: { title: string; rows: Array<{ label: string; value: number }>; empty: string; note?: string }) {
  return (
    <section className="mt-10">
      <h3 className="text-lg font-semibold">{title}</h3>
      {note ? <p className="mt-2 max-w-3xl text-sm text-muted">{note}</p> : null}
      {rows.length === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : (
        <ul className="mt-3 max-w-xl space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border py-2">
              <span>{row.label}</span>
              <span className="tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatMs(value: number | null): string {
  if (value == null) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
}

function formatRate(value: number | null): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
