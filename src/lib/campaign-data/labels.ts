import { campaignDataMessage, type CampaignDataCode } from "@/lib/campaign-data/errors";
import type { BaseMetricId, CanonicalField, DerivedMetricId, DimensionId } from "@/lib/campaign-data/types";

const STATUS: Record<string, string> = {
  PENDING_UPLOAD: "Aguardando envio",
  UPLOADED: "Enviado",
  NEEDS_SHEET_SELECTION: "Escolha a planilha",
  NEEDS_MAPPING: "Confirme as colunas",
  PROCESSING: "Processando",
  READY: "Pronto",
  FAILED: "Falhou",
  DELETED: "Excluído",
};

const FIELDS: Record<CanonicalField, string> = {
  DATE: "Data",
  CAMPAIGN: "Campanha",
  AD_GROUP: "Grupo de anúncios",
  AD_SET: "Conjunto de anúncios",
  AD: "Anúncio",
  KEYWORD: "Palavra-chave",
  SEARCH_TERM: "Termo de pesquisa",
  PLACEMENT: "Posicionamento",
  DEVICE: "Dispositivo",
  NETWORK: "Rede",
  IMPRESSIONS: "Impressões",
  CLICKS: "Cliques",
  SPEND: "Gasto",
  CONVERSIONS: "Conversões",
  CONVERSION_VALUE: "Valor da conversão",
  LEADS: "Leads",
  QUALIFIED_LEADS: "Leads qualificados",
  SALES: "Vendas",
  REVENUE: "Receita",
};

export function importStatusLabel(status: string): string {
  return STATUS[status] ?? status;
}

export function fieldLabel(field: CanonicalField | DimensionId | BaseMetricId | DerivedMetricId | string): string {
  return FIELDS[field as CanonicalField] ?? field;
}

export function failureLabel(code: string | null): string | null {
  if (!code) return null;
  return campaignDataMessage(code as CampaignDataCode);
}
