import { landingPageSectionSchema, type LandingPageSection } from "@/lib/landing-page/components";
import { parseLandingPageDocument, type LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { fail, ok, type LandingPageCode, type LandingPageResult } from "@/lib/landing-page/errors";
import type { LandingPageProjectView } from "@/lib/landing-page/service";
import type { LandingPageStore } from "@/lib/landing-page/types";
import { COPY_PROVIDER_TIMEOUT_MS, COPY_VARIANT_MAX, LANDING_PAGE_COPY_PROMPT_V1, type CopyIntent, type CopyMissingFact } from "@/lib/landing-page/copy/constants";
import { buildCopyContextForSection } from "@/lib/landing-page/copy/context";
import { emitCopyAssistLog, type CopyAssistOperationalEvent } from "@/lib/landing-page/copy/log";
import type { CopyProviderResult, CopyProviderUsage, LandingPageCopyProvider } from "@/lib/landing-page/copy/providers/provider";
import { benefitCountAllowed, claimViolations, sectionPreconditions } from "@/lib/landing-page/copy/policy";
import { copySuggestionContentSchemas, copySuggestionResponseSchema, type CopySuggestionResponseV1 } from "@/lib/landing-page/copy/schemas";

type Origin = "MANUAL" | "AI_ASSISTED";

function viewFromRecord(record: {
  id: string;
  userId: string;
  projectId: string | null;
  courseId: string;
  slug: string;
  title: string;
  status: LandingPageProjectView["status"];
  draftDocument: LandingPageDocumentV1;
  draftRevision: number;
  publishedPublicationId: string | null;
  createdAt: Date;
  updatedAt: Date;
  publicationCount: number;
}): LandingPageProjectView {
  return {
    id: record.id,
    userId: record.userId,
    projectId: record.projectId,
    courseId: record.courseId,
    slug: record.slug,
    title: record.title,
    status: record.status,
    draftDocument: record.draftDocument,
    draftRevision: record.draftRevision,
    publishedPublicationId: record.publishedPublicationId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasPublicationHistory: record.publicationCount > 0,
  };
}

function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
    work(controller.signal).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function missingResponse(sectionId: string, sectionType: CopySuggestionResponseV1["sectionType"], missingFacts: CopyMissingFact[]): CopySuggestionResponseV1 {
  return {
    version: 1,
    promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
    sectionId,
    sectionType,
    suggestions: [],
    warnings: [{ code: "MISSING_FACT", text: "Ainda falta um fato informado por você para escrever esta parte." }],
    missingFacts,
  };
}

function acceptSuggestions(raw: unknown, sectionType: string, sectionId: string, facts: Record<string, string>, variantCount: number): CopySuggestionResponseV1 | null {
  const parsed = copySuggestionResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.sectionType !== sectionType || parsed.data.sectionId !== sectionId) return null;
  if (parsed.data.suggestions.length > variantCount || parsed.data.suggestions.length > COPY_VARIANT_MAX) return null;
  const schema = copySuggestionContentSchemas[sectionType as keyof typeof copySuggestionContentSchemas];
  const suggestions = [];
  for (const suggestion of parsed.data.suggestions) {
    if (!schema || !schema.safeParse(suggestion.content).success) return null;
    if (claimViolations(suggestion.content, facts, suggestion.rationale).length > 0) return null;
    if (sectionType === "BENEFITS") {
      const items = (suggestion.content as { items?: unknown[] }).items ?? [];
      if (items.length > benefitCountAllowed(facts)) return null;
    }
    suggestions.push(suggestion);
  }
  return { ...parsed.data, suggestions };
}

export async function generateLandingPageCopySuggestions(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    sectionId: string;
    intent?: CopyIntent;
    variantCount?: number;
  },
  provider: LandingPageCopyProvider,
  options?: { log?: (event: CopyAssistOperationalEvent) => void; timeoutMs?: number },
): Promise<LandingPageResult<CopySuggestionResponseV1>> {
  if (input.variantCount !== undefined && (input.variantCount < 1 || input.variantCount > COPY_VARIANT_MAX)) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  const built = buildCopyContextForSection({ document: record.draftDocument, sectionId: input.sectionId, intent: input.intent });
  if (!built.ok) {
    const code: LandingPageCode = built.reason === "INSUFFICIENT" ? "COPY_ASSIST_INSUFFICIENT_CONTEXT" : "INVALID_INPUT";
    return fail(code);
  }
  const started = Date.now();
  const missing = sectionPreconditions(built.context);
  if (missing.length > 0) {
    emitCopyAssistLog({
      requestId: crypto.randomUUID(),
      providerId: "none",
      modelId: "none",
      promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
      sectionType: built.context.sectionType,
      latencyMs: Date.now() - started,
      status: "ok",
    }, options?.log);
    return ok(missingResponse(built.section.id, built.context.sectionType, missing));
  }

  const requestId = crypto.randomUUID();
  const variantCount = input.variantCount ?? COPY_VARIANT_MAX;
  const logEvent = (status: CopyAssistOperationalEvent["status"], errorCode?: string, usage?: CopyProviderUsage) => {
    const inputTokens = usage?.inputTokens;
    const outputTokens = usage?.outputTokens;
    emitCopyAssistLog({
      requestId,
      providerId: provider.id,
      modelId: provider.modelId,
      promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
      sectionType: built.context.sectionType,
      latencyMs: Date.now() - started,
      status,
      ...(errorCode ? { errorCode } : {}),
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
      ...(inputTokens !== undefined || outputTokens !== undefined ? { tokenUsage: (inputTokens ?? 0) + (outputTokens ?? 0) } : {}),
    }, options?.log);
  };
  const ask = (repair: boolean, signal: AbortSignal) =>
    provider.generateCopySuggestion({
      promptVersion: LANDING_PAGE_COPY_PROMPT_V1,
      context: built.context,
      repair,
      signal,
      variantCount,
    });
  let providerResult: CopyProviderResult;
  try {
    providerResult = await withTimeout((signal) => ask(false, signal), options?.timeoutMs ?? COPY_PROVIDER_TIMEOUT_MS);
  } catch {
    logEvent("error", "COPY_ASSIST_PROVIDER_ERROR");
    return fail("COPY_ASSIST_PROVIDER_ERROR");
  }
  if (!providerResult.ok) {
    logEvent("error", providerResult.code);
    return fail(providerResult.code);
  }

  let usage = providerResult.usage;
  let accepted = acceptSuggestions(providerResult.raw, built.context.sectionType, built.section.id, built.context.userProvidedFacts, variantCount);
  if (!accepted) {
    try {
      const repaired = await withTimeout((signal) => ask(true, signal), options?.timeoutMs ?? COPY_PROVIDER_TIMEOUT_MS);
      if (repaired.ok) {
        usage = repaired.usage ?? usage;
        accepted = acceptSuggestions(repaired.raw, built.context.sectionType, built.section.id, built.context.userProvidedFacts, variantCount);
      }
    } catch {
      accepted = null;
    }
  }
  if (!accepted) {
    logEvent("error", "COPY_ASSIST_INVALID_RESPONSE", usage);
    return fail("COPY_ASSIST_INVALID_RESPONSE");
  }
  logEvent("ok", undefined, usage);
  return ok(accepted);
}

function labelOnly<T extends { type: string; label?: string }>(existing: T, label?: string): T {
  if (!label || existing.type === "WHATSAPP") return existing;
  return { ...existing, label };
}

function mergedContent(section: LandingPageSection, content: Record<string, unknown>): Record<string, unknown> | null {
  if (section.type === "HERO") {
    const headline = content.headline;
    if (typeof headline !== "string") return null;
    const next: Record<string, unknown> = {
      headline,
      ...(typeof content.eyebrow === "string" ? { eyebrow: content.eyebrow } : {}),
      ...(typeof content.subheadline === "string" ? { subheadline: content.subheadline } : {}),
    };
    if (section.content.primaryCta) {
      const label = typeof content.primaryCtaLabel === "string"
        ? content.primaryCtaLabel
        : typeof (content.primaryCta as { label?: string } | undefined)?.label === "string"
          ? (content.primaryCta as { label: string }).label
          : undefined;
      next.primaryCta = labelOnly(section.content.primaryCta, label);
    }
    return next;
  }
  if (section.type === "CTA" && section.content.action) {
    const label = typeof content.buttonLabel === "string"
      ? content.buttonLabel
      : typeof (content.action as { label?: string } | undefined)?.label === "string"
        ? (content.action as { label: string }).label
        : undefined;
    return {
      heading: content.heading,
      ...(typeof content.description === "string" ? { description: content.description } : {}),
      action: labelOnly(section.content.action, label),
    };
  }
  if (section.type === "FORM") {
    return {
      ...section.content,
      ...(typeof content.heading === "string" ? { heading: content.heading } : {}),
      ...(typeof content.intro === "string" ? { intro: content.intro } : {}),
      ...(typeof content.submitLabel === "string" ? { submitLabel: content.submitLabel } : {}),
    };
  }
  return content;
}

async function writeSection(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    sectionId: string;
    expectedRevision: number;
    content: unknown;
    origin: Origin;
    unresolvedFacts: string[];
    nextStatus: "DRAFT" | "APPROVED";
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  if (record.status === "PUBLISHED" || record.status === "UNPUBLISHED") return fail("INVALID_INPUT");
  const current = record.draftDocument.sections.find((section) => section.id === input.sectionId);
  if (!current) return fail("INVALID_INPUT");
  if (!input.content || typeof input.content !== "object" || Array.isArray(input.content)) return fail("INVALID_INPUT");
  const merged = mergedContent(current, input.content as Record<string, unknown>);
  if (!merged) return fail("INVALID_INPUT");
  const candidate = {
    ...current,
    content: merged,
    contentStatus: input.nextStatus,
    copyMeta: { origin: input.origin, unresolvedFacts: input.unresolvedFacts },
  };
  const parsedSection = landingPageSectionSchema.safeParse(candidate);
  if (!parsedSection.success) return fail("INVALID_INPUT");
  const document = {
    ...record.draftDocument,
    sections: record.draftDocument.sections.map((section) => (section.id === current.id ? parsedSection.data : section)),
  };
  const parsed = parseLandingPageDocument(document);
  if (!parsed.ok) return fail("INVALID_DOCUMENT");
  const updated = await store.updateDraftAtomic({
    id: record.id,
    userId: input.userId,
    expectedRevision: input.expectedRevision,
    document: parsed.document,
  });
  if (!updated.ok) return fail(updated.reason === "CONFLICT" ? "LANDING_PAGE_DRAFT_CONFLICT" : "NOT_FOUND");
  return ok(viewFromRecord(updated.record));
}

export async function applyLandingPageCopy(
  store: LandingPageStore,
  input: {
    userId: string;
    landingPageProjectId: string;
    sectionId: string;
    expectedRevision: number;
    content: unknown;
    origin?: Origin;
    unresolvedFacts?: string[];
  },
): Promise<LandingPageResult<LandingPageProjectView>> {
  return writeSection(store, {
    ...input,
    origin: input.origin ?? "MANUAL",
    unresolvedFacts: input.unresolvedFacts ?? [],
    nextStatus: "DRAFT",
  });
}

export async function approveLandingPageSectionCopy(
  store: LandingPageStore,
  input: { userId: string; landingPageProjectId: string; sectionId: string; expectedRevision: number },
): Promise<LandingPageResult<LandingPageProjectView>> {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) return fail("INVALID_INPUT");
  const record = await store.findByIdForUser(input.landingPageProjectId, input.userId);
  if (!record) return fail("NOT_FOUND");
  const section = record.draftDocument.sections.find((item) => item.id === input.sectionId);
  if (!section) return fail("INVALID_INPUT");
  if (section.contentStatus !== "DRAFT") return fail("LANDING_PAGE_SECTION_INCOMPLETE");
  if ((section.copyMeta?.unresolvedFacts.length ?? 0) > 0) return fail("LANDING_PAGE_SECTION_INCOMPLETE");
  return writeSection(store, {
    ...input,
    content: section.content,
    origin: section.copyMeta?.origin ?? "MANUAL",
    unresolvedFacts: [],
    nextStatus: "APPROVED",
  });
}
