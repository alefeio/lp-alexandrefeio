import {
  BLOG_READING_ACTIVITY_IDLE_MS,
  BLOG_READING_DEPTH_MARKS,
  BLOG_READING_FLUSH_ACTIVE_MS,
  BLOG_READING_IDLE_MS,
  BLOG_READING_MAX_ACTIVE_MS,
  BLOG_READING_MAX_INCREMENT_MS,
} from "@/lib/blog/reading/constants";

export type BlogReadingObserverState = {
  clientReadingId: string;
  blogPostId: string;
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  ended: boolean;
  lastFlushActiveMs: number;
  lastFlushScroll: number;
  lastActivityAt: number;
  lastTickAt: number;
  sealed: boolean;
  stopped: boolean;
};

export type BlogReadingObserverSnapshot = {
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  ended: boolean;
};

export function createBlogReadingObserverState(input: {
  clientReadingId: string;
  blogPostId: string;
  now: number;
}): BlogReadingObserverState {
  return {
    clientReadingId: input.clientReadingId,
    blogPostId: input.blogPostId,
    activeTimeMs: 0,
    maxScrollPercent: 0,
    reachedEnd: false,
    ended: false,
    lastFlushActiveMs: 0,
    lastFlushScroll: 0,
    lastActivityAt: input.now,
    lastTickAt: input.now,
    sealed: false,
    stopped: false,
  };
}

/** Profundidade pelo corpo editorial: quanto do bloco já passou pela base da viewport. */
export function measureEditorialDepth(input: {
  bodyTop: number;
  bodyHeight: number;
  viewportTop: number;
  viewportHeight: number;
}): { percent: number; reachedEnd: boolean } {
  if (input.bodyHeight <= 0 || input.viewportHeight <= 0) return { percent: 0, reachedEnd: false };
  const viewportBottom = input.viewportTop + input.viewportHeight;
  const progressed = viewportBottom - input.bodyTop;
  const percent = Math.max(0, Math.min(100, Math.floor((progressed / input.bodyHeight) * 100)));
  const reachedEnd = viewportBottom >= input.bodyTop + input.bodyHeight - 8;
  return { percent: reachedEnd ? 100 : percent, reachedEnd };
}

export function isObserverIdleExpired(state: BlogReadingObserverState, now: number): boolean {
  if (state.stopped || state.sealed || state.ended) return false;
  return now - state.lastActivityAt >= BLOG_READING_IDLE_MS;
}

export function applyObserverActivity(state: BlogReadingObserverState, now: number): BlogReadingObserverState {
  if (state.stopped || state.sealed || state.ended) return state;
  // Expiração antes de renovar lastActivityAt — evita reutilizar sessão ociosa.
  if (now - state.lastActivityAt >= BLOG_READING_IDLE_MS) {
    return { ...state, sealed: true };
  }
  return { ...state, lastActivityAt: now };
}

export function applyObserverVisibility(state: BlogReadingObserverState, now: number, visible: boolean): BlogReadingObserverState {
  if (state.stopped || state.sealed || state.ended) return state;
  if (!visible) return { ...state, lastTickAt: now };
  // Visível de novo: checa idle antes de tocar lastActivityAt (aba oculta ≠ interação).
  if (now - state.lastActivityAt >= BLOG_READING_IDLE_MS) {
    return { ...state, lastTickAt: now, sealed: true };
  }
  return { ...state, lastTickAt: now, lastActivityAt: now };
}

export function applyObserverDepth(state: BlogReadingObserverState, depth: { percent: number; reachedEnd: boolean }): BlogReadingObserverState {
  if (state.stopped || state.sealed || state.ended) return state;
  return {
    ...state,
    maxScrollPercent: Math.max(state.maxScrollPercent, Math.min(100, Math.max(0, depth.percent))),
    reachedEnd: state.reachedEnd || depth.reachedEnd,
  };
}

export function tickBlogReadingObserver(
  state: BlogReadingObserverState,
  now: number,
  options?: { visible?: boolean },
): BlogReadingObserverState {
  if (state.stopped || state.sealed || state.ended) return state;
  const visible = options?.visible !== false;
  const elapsed = Math.max(0, now - state.lastTickAt);
  const next = { ...state, lastTickAt: now };
  if (!visible) return next;
  if (now - state.lastActivityAt >= BLOG_READING_IDLE_MS) {
    return { ...next, sealed: true };
  }
  if (now - state.lastActivityAt > BLOG_READING_ACTIVITY_IDLE_MS) return next;
  const add = Math.min(elapsed, BLOG_READING_MAX_INCREMENT_MS);
  return {
    ...next,
    activeTimeMs: Math.min(BLOG_READING_MAX_ACTIVE_MS, next.activeTimeMs + add),
  };
}

export function shouldFlushObserver(state: BlogReadingObserverState, reason: "interval" | "depth" | "hide" | "click" | "end" | "open"): boolean {
  if (state.stopped) return false;
  if (reason === "open") return true;
  if (reason === "hide" || reason === "click" || reason === "end") return true;
  if (reason === "depth") {
    if (state.reachedEnd && state.lastFlushScroll < 100) return true;
    return BLOG_READING_DEPTH_MARKS.some((mark) => state.maxScrollPercent >= mark && state.lastFlushScroll < mark);
  }
  return state.activeTimeMs - state.lastFlushActiveMs >= BLOG_READING_FLUSH_ACTIVE_MS;
}

export function markObserverFlushed(state: BlogReadingObserverState): BlogReadingObserverState {
  return {
    ...state,
    lastFlushActiveMs: state.activeTimeMs,
    lastFlushScroll: state.maxScrollPercent,
  };
}

export function stopBlogReadingObserver(state: BlogReadingObserverState, ended = false): BlogReadingObserverState {
  return { ...state, stopped: true, ended: ended || state.ended };
}

export function renewClientReadingAfterSeal(state: BlogReadingObserverState, clientReadingId: string, now: number): BlogReadingObserverState {
  return createBlogReadingObserverState({
    clientReadingId,
    blogPostId: state.blogPostId,
    now,
  });
}

export function observerSnapshot(state: BlogReadingObserverState): BlogReadingObserverSnapshot {
  return {
    activeTimeMs: state.activeTimeMs,
    maxScrollPercent: state.maxScrollPercent,
    reachedEnd: state.reachedEnd,
    ended: state.ended,
  };
}
