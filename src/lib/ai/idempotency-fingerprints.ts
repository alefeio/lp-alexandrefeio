import { createHash } from "node:crypto";
import { fingerprintAiParams } from "@/lib/ai/idempotency";
import { LANDING_PAGE_COPY_PROMPT_V1 } from "@/lib/landing-page/copy/constants";
import type { EditorialInventory } from "@/lib/blog/inventory";
import type { BlogAiAction } from "@/lib/blog/ai-request";

function contentRevision(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

/** Fingerprint editorial sem persistir inventário nem foco em texto claro. */
export function blogAiFingerprint(input: {
  action: BlogAiAction;
  inventory: EditorialInventory;
  focus?: Record<string, string>;
}): string {
  const focus = input.focus ?? {};
  return fingerprintAiParams({
    v: 1,
    action: input.action,
    inventory: {
      published: input.inventory.published.map((row) => row.logicalId).sort(),
      drafts: input.inventory.drafts.map((row) => row.logicalId).sort(),
      planned: input.inventory.planned.map((row) => row.logicalId).sort(),
      dismissed: input.inventory.dismissed.map((row) => row.logicalId).sort(),
    },
    focus: Object.keys(focus)
      .sort()
      .map((key) => [key, contentRevision(focus[key] ?? "")]),
  });
}

/** Fingerprint de copy de LP: projeto, seção, revisão e versão de prompt — sem fatos/texto. */
export function landingPageCopyFingerprint(input: {
  landingPageProjectId: string;
  sectionId: string;
  draftRevision: number;
  intent?: string;
  variantCount?: number;
  promptVersion?: string;
}): string {
  return fingerprintAiParams({
    v: 1,
    landingPageProjectId: input.landingPageProjectId,
    sectionId: input.sectionId,
    draftRevision: input.draftRevision,
    intent: input.intent ?? null,
    variantCount: input.variantCount ?? null,
    promptVersion: input.promptVersion ?? LANDING_PAGE_COPY_PROMPT_V1,
  });
}
