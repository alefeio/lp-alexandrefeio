import { persistJourneyEvent } from "@/lib/product-journey/client";

/** Uma visualização atual. Não é fila de eventos anteriores. */
export const PENDING_COURSE_VIEW_KEY = "af_pending_course_view_v1";

type PendingCourseView = { courseSlug: string; path: string };

export function courseViewJourneyKey(courseSlug: string): string {
  return `af_journey_course_view_${courseSlug}`;
}

function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function readPending(storage: Storage): PendingCourseView | null {
  const raw = storage.getItem(PENDING_COURSE_VIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingCourseView>;
    if (typeof parsed.courseSlug !== "string" || typeof parsed.path !== "string") return null;
    if (!parsed.courseSlug || !parsed.path.startsWith("/") || parsed.path.startsWith("//")) return null;
    return { courseSlug: parsed.courseSlug, path: parsed.path };
  } catch {
    return null;
  }
}

export function rememberPendingCourseView(courseSlug: string, path: string): void {
  const storage = sessionStore();
  if (!storage || !courseSlug || !path.startsWith("/") || path.startsWith("//")) return;
  storage.setItem(PENDING_COURSE_VIEW_KEY, JSON.stringify({ courseSlug, path }));
}

export function clearPendingCourseView(): void {
  sessionStore()?.removeItem(PENDING_COURSE_VIEW_KEY);
}

export function courseViewAlreadyPersisted(courseSlug: string, path: string): boolean {
  return sessionStore()?.getItem(courseViewJourneyKey(courseSlug)) === path;
}

function markPersisted(storage: Storage, courseSlug: string, path: string): void {
  storage.setItem(courseViewJourneyKey(courseSlug), path);
  storage.removeItem(PENDING_COURSE_VIEW_KEY);
}

/** Persiste só a visualização da página ainda aberta, uma vez nesta sessão. */
export function flushPendingCourseView(consentUpdatedAt: number): void {
  const storage = sessionStore();
  if (!storage || typeof window === "undefined") return;
  const pending = readPending(storage);
  if (!pending) return;
  if (pending.path !== window.location.pathname) {
    storage.removeItem(PENDING_COURSE_VIEW_KEY);
    return;
  }
  if (storage.getItem(courseViewJourneyKey(pending.courseSlug)) === pending.path) {
    storage.removeItem(PENDING_COURSE_VIEW_KEY);
    return;
  }
  markPersisted(storage, pending.courseSlug, pending.path);
  persistJourneyEvent({
    eventName: "course_view",
    params: { course_slug: pending.courseSlug },
    consentUpdatedAt,
  });
}
