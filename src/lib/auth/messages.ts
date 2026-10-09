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

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  if (value === "/app" || value.startsWith("/app/") || value === "/admin" || value.startsWith("/admin/")) {
    return value;
  }
  return "/app";
}
