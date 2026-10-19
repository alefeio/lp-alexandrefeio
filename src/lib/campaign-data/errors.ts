export const CAMPAIGN_DATA_CODES = [
  "UNSUPPORTED_FORMAT",
  "FILE_TOO_LARGE",
  "INVALID_XLSX",
  "TOO_MANY_ROWS",
  "TOO_MANY_COLUMNS",
  "TOO_MANY_SHEETS",
  "ENCODING_UNSUPPORTED",
  "PARSE_FAILED",
  "MAPPING_REQUIRED",
  "STORAGE_FAILED",
  "UPLOADS_DISABLED",
  "NOT_FOUND",
] as const;

export type CampaignDataCode = (typeof CAMPAIGN_DATA_CODES)[number];

const MESSAGES: Record<CampaignDataCode, string> = {
  UNSUPPORTED_FORMAT: "Envie um arquivo CSV ou XLSX.",
  FILE_TOO_LARGE: "Este arquivo é grande demais. Exporte um período menor e tente novamente.",
  INVALID_XLSX: "Não foi possível ler esta planilha. Exporte novamente em XLSX, sem macro e sem senha.",
  TOO_MANY_ROWS: "Este arquivo é grande demais. Exporte um período menor e tente novamente.",
  TOO_MANY_COLUMNS: "Este arquivo tem colunas demais. Exporte só as colunas necessárias e tente novamente.",
  TOO_MANY_SHEETS: "Este arquivo tem planilhas demais. Exporte uma planilha e tente novamente.",
  ENCODING_UNSUPPORTED: "Não foi possível ler a codificação deste arquivo.",
  PARSE_FAILED: "Não foi possível ler este arquivo.",
  MAPPING_REQUIRED: "Confirme o significado das colunas antes de continuar.",
  STORAGE_FAILED: "Não foi possível guardar o arquivo. Tente novamente.",
  UPLOADS_DISABLED: "O envio de arquivos não está disponível neste ambiente.",
  NOT_FOUND: "Arquivo não encontrado.",
};

export function campaignDataMessage(code: CampaignDataCode): string {
  return MESSAGES[code];
}

export class CampaignDataError extends Error {
  readonly code: CampaignDataCode;

  constructor(code: CampaignDataCode) {
    super(campaignDataMessage(code));
    this.name = "CampaignDataError";
    this.code = code;
  }
}
