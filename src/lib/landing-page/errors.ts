export const LANDING_PAGE_CODES = [
  "NOT_FOUND",
  "FORBIDDEN",
  "INVALID_SLUG",
  "SLUG_TAKEN",
  "LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION",
  "LANDING_PAGE_DRAFT_CONFLICT",
  "INVALID_DOCUMENT",
  "UNSUPPORTED_SCHEMA_VERSION",
  "UNSUPPORTED_REGISTRY_VERSION",
  "INVALID_TITLE",
  "COURSE_NOT_FOUND",
  "INVALID_INPUT",
  "LANDING_PAGE_WIREFRAME_NOT_EMPTY",
  "LANDING_PAGE_WIREFRAME_REPLACE_DISABLED",
  "LANDING_PAGE_BRIEF_REQUIRED",
  "ACTION_CHANGE_REQUIRES_CONFIRMATION",
] as const;

export type LandingPageCode = (typeof LANDING_PAGE_CODES)[number];

const MESSAGES: Record<LandingPageCode, string> = {
  NOT_FOUND: "Página não encontrada.",
  FORBIDDEN: "Você não tem permissão para esta página.",
  INVALID_SLUG: "Use um endereço com letras minúsculas, números e hífens.",
  SLUG_TAKEN: "Este endereço já está em uso.",
  LANDING_PAGE_SLUG_LOCKED_AFTER_PUBLICATION: "O endereço não pode ser alterado depois da primeira publicação.",
  LANDING_PAGE_DRAFT_CONFLICT: "Esta página foi alterada em outro lugar. Atualize antes de salvar novamente.",
  INVALID_DOCUMENT: "O conteúdo da página é inválido.",
  UNSUPPORTED_SCHEMA_VERSION: "Esta versão do documento da página não é suportada.",
  UNSUPPORTED_REGISTRY_VERSION: "Esta versão do catálogo de componentes não é suportada.",
  INVALID_TITLE: "Informe um título válido.",
  COURSE_NOT_FOUND: "Curso associado à landing page não encontrado.",
  INVALID_INPUT: "Dados inválidos.",
  LANDING_PAGE_WIREFRAME_NOT_EMPTY: "O rascunho já tem seções. A estrutura guiada só entra em uma página vazia.",
  LANDING_PAGE_WIREFRAME_REPLACE_DISABLED: "Substituir a estrutura inteira ainda não está disponível.",
  LANDING_PAGE_BRIEF_REQUIRED: "Defina primeiro a estratégia básica desta página.",
  ACTION_CHANGE_REQUIRES_CONFIRMATION: "A ação principal vai mudar. Confirme antes de salvar.",
};

export function landingPageMessage(code: LandingPageCode): string {
  return MESSAGES[code];
}

export class LandingPageError extends Error {
  readonly code: LandingPageCode;

  constructor(code: LandingPageCode, detail?: string) {
    super(detail ?? landingPageMessage(code));
    this.name = "LandingPageError";
    this.code = code;
  }
}

export type LandingPageResult<T> = { ok: true; value: T } | { ok: false; code: LandingPageCode; message: string };

export function ok<T>(value: T): LandingPageResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: LandingPageCode, detail?: string): LandingPageResult<T> {
  return { ok: false, code, message: detail ?? landingPageMessage(code) };
}
