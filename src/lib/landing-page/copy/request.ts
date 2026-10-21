import { z } from "zod";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { getPrisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { COPY_ASSIST_EDITOR_ROLE, COPY_ASSIST_LESSON_SLUG, copyAssistAccessDecision } from "@/lib/landing-page/copy/access";
import { COPY_LIVE_PROVIDER_TIMEOUT_MS } from "@/lib/landing-page/copy/config";
import { COPY_INTENTS, COPY_VARIANT_MAX } from "@/lib/landing-page/copy/constants";
import { consumeCopyAssistRateLimit } from "@/lib/landing-page/copy/rate-limit";
import { generateLandingPageCopySuggestions } from "@/lib/landing-page/copy/service";
import { resolveLandingPageCopyProvider } from "@/lib/landing-page/copy/providers/provider";
import { LANDING_PAGE_COURSE_SLUG } from "@/lib/landing-page/constants";
import { fail, type LandingPageResult } from "@/lib/landing-page/errors";
import { createPrismaLandingPageStore } from "@/lib/landing-page/prisma-store";
import type { CopySuggestionResponseV1 } from "@/lib/landing-page/copy/schemas";

const requestSchema = z
  .object({
    landingPageProjectId: z.string().trim().min(1).max(80),
    sectionId: z.string().trim().min(1).max(64),
    intent: z.enum(COPY_INTENTS).optional(),
    variantCount: z.number().int().min(1).max(COPY_VARIANT_MAX).optional(),
  })
  .strict();

function publicationStatus(value: string | undefined): "DRAFT" | "PUBLISHED" | null {
  if (value === "DRAFT" || value === "PUBLISHED") return value;
  return null;
}

export async function requestLandingPageCopySuggestions(input: unknown): Promise<LandingPageResult<CopySuggestionResponseV1>> {
  const session = await getSession();
  if (!session?.user?.id) return fail("FORBIDDEN");
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT");

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
  if (!consumeCopyAssistRateLimit(session.user.id)) return fail("COPY_ASSIST_RATE_LIMITED");

  const store = createPrismaLandingPageStore();
  const record = await store.findByIdForUser(parsed.data.landingPageProjectId, session.user.id);
  if (!record || record.courseId !== course?.id) return fail("NOT_FOUND");
  const section = record.draftDocument.sections.find((item) => item.id === parsed.data.sectionId);
  if (!section) return fail("INVALID_INPUT");

  return generateLandingPageCopySuggestions(store, {
    userId: session.user.id,
    landingPageProjectId: parsed.data.landingPageProjectId,
    sectionId: parsed.data.sectionId,
    intent: parsed.data.intent,
    variantCount: parsed.data.variantCount,
  }, resolveLandingPageCopyProvider(), { timeoutMs: COPY_LIVE_PROVIDER_TIMEOUT_MS });
}
