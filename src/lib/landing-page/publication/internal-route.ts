const BLOCKED_PREFIXES = [
  "/admin",
  "/app",
  "/diretor",
  "/api",
  "/entrar",
  "/cadastro",
  "/dev",
  "/esqueci-senha",
  "/redefinir-senha",
  "/verificar-email",
];

/** Rota interna que a landing pública pode abrir. Áreas autenticadas ficam de fora. */
export function isPublicInternalRouteAllowed(path: string): boolean {
  if (!path.startsWith("/") || path.includes("..") || path.includes("?") || path.includes("#") || path.includes("\\")) {
    return false;
  }
  const normalized = path.toLowerCase();
  return !BLOCKED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
