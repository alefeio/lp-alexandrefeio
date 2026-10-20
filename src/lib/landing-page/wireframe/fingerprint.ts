import { createHash } from "node:crypto";
import { GUIDED_WIREFRAME_ENGINE_V1 } from "@/lib/landing-page/constants";

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

/** Hash do contexto canônico + versão do motor. Não inclui texto em claro. */
export function wireframePlanFingerprint(context: unknown): string {
  return createHash("sha256").update(`${GUIDED_WIREFRAME_ENGINE_V1}\n${stableStringify(context)}`).digest("hex");
}
