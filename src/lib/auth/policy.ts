import { AUTH_MESSAGES, mapAuthError } from "@/lib/auth/messages";

export const USER_ROLES = {
  user: "USER",
  admin: "ADMIN",
} as const;

const HOUR_SECONDS = 60 * 60;
const WEEK_SECONDS = 7 * 24 * HOUR_SECONDS;

export const SESSION_EXPIRES_IN_SECONDS = WEEK_SECONDS;
export const RESET_TOKEN_EXPIRES_IN_SECONDS = HOUR_SECONDS;

export const SESSION_COOKIE_ATTRIBUTES = {
  httpOnly: true,
  sameSite: "lax",
} as const;

/** Cookie Secure segue o endereço público. HTTP local continua sem o prefixo seguro. */
export function secureSessionCookies(baseURL: string): boolean {
  return baseURL.startsWith("https://");
}

/** Cadastro nunca aceita role enviada pelo navegador. */
export function roleForNewUser(requested?: unknown): typeof USER_ROLES.user {
  void requested;
  return USER_ROLES.user;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === USER_ROLES.admin;
}

/**
 * Pedido de recuperação e reenvio de confirmação.
 * Só o limite de taxa vira erro visível. Conta inexistente, falha de envio e sucesso
 * usam a mesma confirmação pública.
 */
export function accountLookupFeedback(
  error: { message?: string | null; status?: number | null; code?: string | null } | null | undefined,
): string | null {
  if (!error) return null;
  const mapped = mapAuthError(error);
  if (mapped === AUTH_MESSAGES.rateLimited) return mapped;
  return null;
}
