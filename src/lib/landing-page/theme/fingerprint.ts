import { createHash } from "node:crypto";
import type { LandingPageThemeV1 } from "@/lib/landing-page/theme/schema";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Hash do tema salvo. Não inclui a paleta em claro no resultado da aula. */
export function themeFingerprint(theme: LandingPageThemeV1): string {
  return createHash("sha256").update(`LANDING_PAGE_THEME_V1\n${stableStringify(theme)}`).digest("hex");
}
