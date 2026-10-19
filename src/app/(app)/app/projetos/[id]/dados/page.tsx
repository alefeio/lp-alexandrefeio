import Link from "next/link";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/campaign-data/UploadForm";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { deleteCampaignImportAction } from "@/lib/campaign-data/actions";
import { failureLabel, importStatusLabel } from "@/lib/campaign-data/labels";
import { platformLabel } from "@/lib/campaign-data/mapping";
import { listCampaignImports } from "@/lib/campaign-data/service";
import { buttonClass } from "@/lib/button-styles";
import type { SourcePlatform } from "@/lib/campaign-data/types";

export const metadata = { title: "Dados da campanha", robots: { index: false, follow: false } };

export default async function CampaignDataPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const data = await listCampaignImports(session.user.id, id);
  if (!data) notFound();

  return (
    <Container className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Projeto</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Dados da campanha</h1>
      <p className="mt-3 text-base leading-relaxed">Envie um relatório CSV ou XLSX para usar nas análises do seu projeto.</p>
      {query.erro ? <p className="mt-3 text-sm">{failureLabel(query.erro)}</p> : null}
      <section className="mt-8 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Enviar arquivo</h2>
        <p className="mt-2 text-sm text-muted">Tipos aceitos: CSV e XLSX. Limite: 10 MB.</p>
        <p className="mt-2 text-sm">Seus arquivos são privados e vinculados a este projeto.</p>
        <p className="mt-2 text-sm text-muted">O arquivo fica guardado até você excluir. Não há prazo automático.</p>
        <div className="mt-4">
          <UploadForm projectId={data.project.id} />
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Arquivos</h2>
        {data.imports.length === 0 ? <p className="mt-3 text-sm text-muted">Nenhum arquivo enviado.</p> : null}
        <ul className="mt-4 space-y-4">
          {data.imports.map((item) => (
            <li key={item.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{item.originalFileName || "Arquivo"}</p>
              <p className="mt-1 text-sm text-muted">
                {platformLabel(item.sourcePlatform as SourcePlatform)} · {item.fileFormat} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(item.createdAt)}
              </p>
              <p className="mt-1 text-sm">
                {importStatusLabel(item.status)}
                {item.rowCount != null ? ` · ${item.rowCount} linhas` : ""}
                {item.columnCount != null ? ` · ${item.columnCount} colunas` : ""}
              </p>
              {item.failureCode ? <p className="mt-2 text-sm">{failureLabel(item.failureCode)}</p> : null}
              <div className="mt-3 flex flex-wrap gap-3">
                {item.status === "NEEDS_SHEET_SELECTION" || item.status === "NEEDS_MAPPING" ? (
                  <Link className={buttonClass("secondary")} href={`/app/projetos/${id}/dados/${item.id}`}>Continuar configuração</Link>
                ) : (
                  <Link className="text-sm underline underline-offset-4" href={`/app/projetos/${id}/dados/${item.id}`}>Ver estrutura</Link>
                )}
                <form action={deleteCampaignImportAction.bind(null, id, item.id)}>
                  <button className="text-sm underline underline-offset-4" type="submit">Excluir</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
