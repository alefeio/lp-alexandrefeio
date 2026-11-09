import { journeyPath } from "@/lib/product-journey/paths";

/** Paths públicos observados por site_page_view. Admin, API e app autenticado ficam de fora. */
export function isJourneyObservedPath(value: string | undefined): boolean {
  const path = journeyPath(value);
  if (!path) return false;
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  if (path === "/api" || path.startsWith("/api/")) return false;
  if (path === "/app" || path.startsWith("/app/")) return false;
  return true;
}

export function journeyObservedPath(value: string | undefined): string | undefined {
  const path = journeyPath(value);
  if (!path || !isJourneyObservedPath(path)) return undefined;
  return path;
}
