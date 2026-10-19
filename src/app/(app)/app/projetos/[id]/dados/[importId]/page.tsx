import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { confirmCampaignMappingAction, selectCampaignSheetAction } from "@/lib/campaign-data/actions";
import { failureLabel, fieldLabel, importStatusLabel } from "@/lib/campaign-data/labels";
import { campaignImportDetail } from "@/lib/campaign-data/service";
import { CANONICAL_FIELDS } from "@/lib/campaign-data/types";
import { buttonClass } from "@/lib/button-styles";

export const metadata = { title: "Estrutura do arquivo", robots: { index: false, follow: false } };

export default async function CampaignImportPage({ params, searchParams }: { params: Promise<{ id: string; importId: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id, importId } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const detail = await campaignImportDetail(session.user.id, id, importId);
  if (!detail) notFound();
  const headers = detail.preview?.headers.length ? detail.preview.headers : detail.headers;

  return (
    <Container className="max-w-3xl">
      <Link className="text-sm underline underline-offset-4" href={`/app/projetos/${id}/dados`}>Voltar para os arquivos</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{detail.originalFileName || "Arquivo"}</h1>
      <p className="mt-2 text-sm text-muted">{importStatusLabel(detail.status)} · {detail.fileFormat}</p>
      {detail.failureCode ? <p className="mt-3 text-sm">{failureLabel(detail.failureCode)}</p> : null}
      {query.erro ? <p className="mt-3 text-sm">{failureLabel(query.erro)}</p> : null}
      {detail.warnings.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
          {detail.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {detail.status === "NEEDS_SHEET_SELECTION" ? (
        <form action={selectCampaignSheetAction.bind(null, id, importId)} className="mt-6 space-y-3">
          <fieldset>
            <legend className="font-medium">Qual planilha você quer importar?</legend>
            <div className="mt-3 space-y-2">
              {detail.sheetNames.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="sheet" value={name} required />
                  {name}
                </label>
              ))}
            </div>
          </fieldset>
          <button className={buttonClass("primary")} type="submit">Usar esta planilha</button>
        </form>
      ) : null}
      {detail.status === "NEEDS_MAPPING" ? (
        <form action={confirmCampaignMappingAction.bind(null, id, importId)} className="mt-6 space-y-4">
          <p className="text-sm">A detecção é uma sugestão. Confirme ou corrija antes de continuar. A coluna Resultados não é tratada como conversão.</p>
          <label className="block text-sm">
            <span className="font-medium">Números</span>
            <select name="locale" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" defaultValue={detail.numberLocale ?? "PT_BR"} required>
              <option value="PT_BR">1.234,56</option>
              <option value="EN_US">1,234.56</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Moeda</span>
            <select name="currency" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" defaultValue={detail.currency ?? "BRL"} required>
              <option value="BRL">Real</option>
              <option value="USD">Dólar</option>
              <option value="OTHER">Outra</option>
            </select>
          </label>
          <div className="space-y-3">
            {headers.map((header, index) => {
              const suggestion = detail.suggestions.find((item) => item.index === index);
              return (
                <label key={`${header}-${index}`} className="block text-sm">
                  <span className="font-medium">{header || `Coluna ${index + 1}`}</span>
                  {suggestion?.ambiguous ? <span className="mt-1 block text-muted">Confirme o que esta coluna significa nesta campanha.</span> : null}
                  {suggestion?.sourceRatio ? <span className="mt-1 block text-muted">Percentual calculado. Ele não entra como base.</span> : null}
                  <select name={`column-${index}`} className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-3" defaultValue={suggestion?.canonical ?? (suggestion?.ambiguous ? "" : "IGNORE")}>
                    <option value="">{suggestion?.ambiguous ? "Escolha" : "Não usar"}</option>
                    <option value="IGNORE">Não usar</option>
                    {CANONICAL_FIELDS.map((field) => (
                      <option key={field} value={field}>{fieldLabel(field)}</option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <button className={buttonClass("primary")} type="submit">Confirmar colunas</button>
        </form>
      ) : null}
      {detail.preview && detail.preview.rows.length > 0 ? (
        <section className="mt-8 overflow-x-auto">
          <h2 className="text-lg font-semibold">Amostra</h2>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr>{detail.preview.headers.map((header, index) => <th key={`${header}-${index}`} className="border-b border-border px-2 py-2 font-medium">{header}</th>)}</tr>
            </thead>
            <tbody>
              {detail.preview.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {detail.preview?.headers.map((_, cellIndex) => <td key={cellIndex} className="border-b border-border px-2 py-2">{row[cellIndex] ?? ""}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {detail.status === "READY" ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">O que dá para calcular</h2>
          <p className="mt-2 text-sm">{Array.isArray(detail.availableMetrics) ? detail.availableMetrics.map((item) => fieldLabel(String(item))).join(", ") : "Nada ainda."}</p>
        </section>
      ) : null}
    </Container>
  );
}
