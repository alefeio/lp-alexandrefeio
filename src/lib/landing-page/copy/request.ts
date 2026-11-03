import { z } from "zod";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { LANDING_PAGE_COPY_FEATURE_KEY } from "@/lib/ai/features";
import { runGuardedAiOperation, type AiIdempotencyBlockKind } from "@/lib/ai/idempotency-guard";
import { landingPageCopyFingerprint } from "@/lib/ai/idempotency-fingerprints";
import { createPrismaAiIdempotencyStore } from "@/lib/ai/idempotency-prisma";
import { COPY_ASSIST_EDITOR_ROLE, COPY_ASSIST_LESSON_SLUG, copyAssistAccessDecision } from "@/lib/landing-page/copy/access";
import { COPY_LIVE_PROVIDER_TIMEOUT_MS } from "@/lib/landing-page/copy/config";
import { COPY_INTENTS, COPY_VARIANT_MAX } from "@/lib/landing-page/copy/constants";
import { consumeCopyAssistRateLimit } from "@/lib/landing-page/copy/rate-limit";
import { generateLandingPageCopySuggestions } from "@/lib/landing-page/copy/service";
import { resolveLandingPageCopyProvider } from "@/lib/landing-page/copy/providers/provider";
import { LANDING_PAGE_COURSE_SLUG } from "@/lib/landing-page/constants";
import { fail, type LandingPageCode, type LandingPageResult } from "@/lib/landing-page/errors";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import type { CopySuggestionResponseV1 } from "@/lib/landing-page/copy/schemas";

const requestSchema = z
  .object({
    landingPageProjectId: z.string().trim().min(1).max(80),
    sectionId: z.string().trim().min(1).max(64),
    intent: z.enum(COPY_INTENTS).optional(),
    variantCount: z.number().int().min(1).max(COPY_VARIANT_MAX).optional(),
    idempotencyKey: z.string().trim().min(8).max(128),
  })
  .strict();

function publicationStatus(value: string | undefined): "DRAFT" | "PUBLISHED" | null {
  if (value === "DRAFT" || value === "PUBLISHED") return value;
  return null;
}

function blockCode(block: AiIdempotencyBlockKind): LandingPageCode {
  if (block === "missing_key") return "COPY_ASSIST_IDEMPOTENCY_REQUIRED";
  if (block === "in_progress") return "COPY_ASSIST_IN_PROGRESS";
  if (block === "completed") return "COPY_ASSIST_ALREADY_COMPLETED";
  if (block === "fingerprint_conflict") return "COPY_ASSIST_FINGERPRINT_CONFLICT";
  if (block === "unknown_blocked") return "COPY_ASSIST_OPERATION_UNKNOWN";
  return "COPY_ASSIST_IDEMPOTENCY_UNAVAILABLE";
}

export async function requestLandingPageCopySuggestions(input: unknown): Promise<LandingPageResult<CopySuggestionResponseV1>> {
  const session = await getSession();
  if (!session?.user?.id) return fail("FORBIDDEN");
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    const raw = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
    if (typeof raw.idempotencyKey !== "string") return fail("COPY_ASSIST_IDEMPOTENCY_REQUIRED");
    return fail("INVALID_INPUT");
  }

  const prisma = getPrisma();
  const course = await prisma.course.findUnique({
    where: { slug: LANDING_PAGE_COURSE_SLUG },
    select: { id: true, status: true },
  });
  const lesson = await prisma.lesson.findUnique({
    where: { slug: COPY_ASSIST_LESSON_SLUG },
    select: { id: true, status: true, module: { select: { courseId: true } } },
  });
  const lessonInCourse = Boolean(course && lesson && lesson.module.courseId === course.id);
  const entitled = session.user.role === COPY_ASSIST_EDITOR_ROLE || !lesson
    ? false
    : await hasActiveEntitlement(session.user.id, lesson.id);
  if (!copyAssistAccessDecision({
    role: session.user.role,
    courseStatus: publicationStatus(course?.status),
    lessonStatus: publicationStatus(lesson?.status),
    lessonInCourse,
    entitled,
  })) {
    return fail("FORBIDDEN");
  }
  if (!(await consumeCopyAssistRateLimit(session.user.id))) return fail("COPY_ASSIST_RATE_LIMITED");

  const store = createPrismaLandingPageStore();
  const record = await store.findByIdForUser(parsed.data.landingPageProjectId, session.user.id);
  if (!record || record.courseId !== course?.id) return fail("NOT_FOUND");
  const section = record.draftDocument.sections.find((item) => item.id === parsed.data.sectionId);
  if (!section) return fail("INVALID_INPUT");

  let generationFailure: LandingPageResult<CopySuggestionResponseV1> | null = null;

  const guarded = await runGuardedAiOperation({
    userId: session.user.id,
    featureKey: LANDING_PAGE_COPY_FEATURE_KEY,
    idempotencyKey: parsed.data.idempotencyKey,
    fingerprintHash: landingPageCopyFingerprint({
      landingPageProjectId: parsed.data.landingPageProjectId,
      sectionId: parsed.data.sectionId,
      draftRevision: record.draftRevision,
      intent: parsed.data.intent,
      variantCount: parsed.data.variantCount,
    }),
    store: createPrismaAiIdempotencyStore(),
    execute: async ({ requestId, markDispatched }) => {
      const generated = await generateLandingPageCopySuggestions(store, {
        userId: session.user.id,
        landingPageProjectId: parsed.data.landingPageProjectId,
        sectionId: parsed.data.sectionId,
        intent: parsed.data.intent,
        variantCount: parsed.data.variantCount,
      }, resolveLandingPageCopyProvider(), {
        timeoutMs: COPY_LIVE_PROVIDER_TIMEOUT_MS,
        requestId,
        onBeforeProvider: markDispatched,
      });
      if (generated.ok) return { ok: true as const, value: generated.value };
      generationFailure = generated;
      return {
        ok: false as const,
        uncertain: "uncertain" in generated ? Boolean(generated.uncertain) : false,
      };
    },
  });

  if (guarded.ok) return { ok: true, value: guarded.value };
  if ("block" in guarded && guarded.block) return fail(blockCode(guarded.block));
  if (generationFailure) return generationFailure;
  return fail("COPY_ASSIST_PROVIDER_ERROR");
}
