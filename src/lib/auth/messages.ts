export const AUTH_MESSAGES = {
  generic: "Não foi possível concluir. Tente novamente.",
  credentials: "E-mail ou senha inválidos.",
  unverified: "Confirme seu e-mail antes de entrar.",
  resetRequested: "Se o e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.",
  resetDone: "Senha redefinida. Entre com a nova senha.",
  invalidToken: "Este link é inválido ou expirou. Solicite outro.",
  rateLimited: "Muitas tentativas. Aguarde um pouco e tente novamente.",
  emailFailed: "Não foi possível enviar o e-mail agora. Tente novamente.",
  signedUp: "Enviamos um e-mail para confirmar a conta.",
} as const;

export function mapAuthError(error: { message?: string | null; status?: number | null; code?: string | null } | null | undefined): string {
  if (!error) return AUTH_MESSAGES.generic;

  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  const status = error.status ?? 0;

  if (status === 429 || message.includes("too many") || code.includes("rate")) return AUTH_MESSAGES.rateLimited;
  if (message.includes("email_not_verified") || code.includes("email_not_verified")) return AUTH_MESSAGES.unverified;
  if (message.includes("expired") || message.includes("invalid token") || code.includes("invalid_token")) {
    return AUTH_MESSAGES.invalidToken;
  }
  if (message.includes("invalid email") || message.includes("invalid password") || code.includes("invalid_email_or_password")) {
    return AUTH_MESSAGES.credentials;
  }
  if (message.includes("email_not_configured") || code.includes("email_not_configured")) return AUTH_MESSAGES.emailFailed;

  return AUTH_MESSAGES.generic;
}

const RETURN_HASH = /^[A-Za-z0-9_-]+$/;

/** Caminho interno para voltar à aula ou à área logada. Recusa URL externa. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed !== value || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("://") ||
    trimmed.includes("\\") ||
    trimmed.includes("?") ||
    trimmed.includes("%") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return null;
  }
  const hashAt = trimmed.indexOf("#");
  const path = hashAt === -1 ? trimmed : trimmed.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : trimmed.slice(hashAt + 1);
  if (hashAt !== -1 && (!RETURN_HASH.test(hash) || trimmed.includes("#", hashAt + 1))) return null;
  const allowed =
    path === "/app" ||
    path.startsWith("/app/") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/cursos" ||
    path.startsWith("/cursos/") ||
    path.startsWith("/aulas/");
  return allowed ? trimmed : null;
}

export function safeNextPath(value: string | null | undefined): string {
  return safeReturnPath(value) ?? "/app";
}

export function authNextHref(base: "/entrar" | "/cadastro", next: string | null | undefined): string {
  const safe = safeReturnPath(next);
  return safe ? `${base}?next=${encodeURIComponent(safe)}` : base;
}

/** Destino do clique no e-mail. O estado de sucesso não é a tela de “confira sua caixa”. */
export function verificationCallbackPath(next: string | null | undefined): string {
  const destination = safeReturnPath(next) ?? "/app";
  return `/verificar-email?confirmado=1&next=${encodeURIComponent(destination)}`;
}

export type VerificationView = "pending" | "confirmed" | "invalid";

export function verificationView(input: { confirmado?: string | null; error?: string | null }): VerificationView {
  if (input.error?.trim()) return "invalid";
  if (input.confirmado === "1") return "confirmed";
  return "pending";
}

export function lessonToolReturnPath(slug: string, hash = "diagnostico"): string {
  return `/aulas/${slug}#${hash}`;
}
