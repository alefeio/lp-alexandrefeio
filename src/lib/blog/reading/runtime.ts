import { ATTRIBUTION_STORAGE_KEY } from "@/lib/attribution";
import {
  clearBlogReadingCheckpoint,
  readBlogReadingCheckpoint,
  writeBlogReadingCheckpoint,
  type BlogReadingCheckpoint,
} from "@/lib/blog/reading/checkpoint";
import {
  buildBlogReadingPayload,
  sendBlogReadingBeacon,
  sendBlogReadingUpdate,
  type BlogReadingSendBody,
  type BlogReadingSendResult,
} from "@/lib/blog/reading/client";
import {
  BLOG_READING_IDLE_MS,
  BLOG_READING_MIN_SEND_GAP_MS,
  BLOG_READING_RETRY_BACKOFF_MS,
} from "@/lib/blog/reading/constants";
import { readOrCreateBlogReaderId, readOrCreateBlogSessionId, type BlogReadingStorage } from "@/lib/blog/reading/identity";
import {
  applyObserverActivity,
  applyObserverDepth,
  applyObserverVisibility,
  createBlogReadingObserverState,
  shouldFlushObserver,
  stopBlogReadingObserver,
  tickBlogReadingObserver,
  type BlogReadingObserverState,
} from "@/lib/blog/reading/observer-core";

export type BlogReadingClickCommand = {
  eventId: string;
  ctaName: string;
  destinationType: "course" | "service";
  targetPath: string;
};

type FlushReason = "open" | "interval" | "depth" | "hide" | "click" | "end";

type ProgressSnapshot = {
  activeTimeMs: number;
  maxScrollPercent: number;
  reachedEnd: boolean;
  ended: boolean;
};

type QueueItem = {
  id: number;
  generation: number;
  clientReadingId: string;
  reason: FlushReason;
  snapshot: ProgressSnapshot;
  click?: BlogReadingClickCommand;
  attempts: number;
};

const MAX_QUEUE = 8;
const MAX_ATTEMPTS = 3;

export type BlogReadingRuntime = {
  start: () => void;
  dispose: (reason: "unmount" | "revoke" | "navigate") => void;
  noteActivity: () => void;
  noteDepth: (depth: { percent: number; reachedEnd: boolean }) => void;
  noteVisibility: (visible: boolean) => void;
  tick: () => void;
  reportClick: (input: Omit<BlogReadingClickCommand, "eventId"> & { eventId?: string }) => string;
  getState: () => BlogReadingObserverState | null;
  isOpened: () => boolean;
  getGeneration: () => number;
  getConfirmed: () => ProgressSnapshot | null;
  getQueueSize: () => number;
};

export function createBlogReadingRuntime(input: {
  blogPostId: string;
  local: BlogReadingStorage;
  session: BlogReadingStorage;
  now: () => number;
  randomUUID: () => string;
  consentUpdatedAt: () => number;
  attributionRaw?: () => string | null;
  send?: (body: BlogReadingSendBody, options?: { keepalive?: boolean }) => Promise<BlogReadingSendResult>;
  beacon?: (body: BlogReadingSendBody) => void;
  schedule?: (fn: () => void, ms: number) => { cancel: () => void };
}): BlogReadingRuntime {
  const send = input.send ?? ((body, options) => sendBlogReadingUpdate(body, options));
  const beacon = input.beacon ?? sendBlogReadingBeacon;
  const schedule =
    input.schedule ??
    ((fn, ms) => {
      const handle = setTimeout(fn, ms);
      return { cancel: () => clearTimeout(handle) };
    });

  let state: BlogReadingObserverState | null = null;
  let anonymousId = "";
  let sessionId = "";
  let generation = 0;
  let opened = false;
  let pumping = false;
  let nextId = 0;
  let pendingResume: BlogReadingCheckpoint | null = null;
  let confirmed: ProgressSnapshot | null = null;
  let inFlight: QueueItem | null = null;
  let lastNonUrgentSendAt = 0;
  let retryTimer: { cancel: () => void } | null = null;
  const queue: QueueItem[] = [];

  function checkpointFromState(current: BlogReadingObserverState): BlogReadingCheckpoint {
    return {
      clientReadingId: current.clientReadingId,
      activeTimeMs: current.activeTimeMs,
      maxScrollPercent: current.maxScrollPercent,
      reachedEnd: current.reachedEnd,
      lastActivityAt: current.lastActivityAt,
      opened,
    };
  }

  function persist() {
    if (!state || state.stopped) return;
    writeBlogReadingCheckpoint(input.session, input.blogPostId, checkpointFromState(state));
  }

  function observeSnapshot(current: BlogReadingObserverState, ended = false): ProgressSnapshot {
    return {
      activeTimeMs: current.activeTimeMs,
      maxScrollPercent: current.maxScrollPercent,
      reachedEnd: current.reachedEnd,
      ended: ended || current.ended,
    };
  }

  function applyConfirmed(snapshot: ProgressSnapshot) {
    confirmed = {
      activeTimeMs: snapshot.activeTimeMs,
      maxScrollPercent: snapshot.maxScrollPercent,
      reachedEnd: snapshot.reachedEnd,
      ended: snapshot.ended,
    };
    if (!state) return;
    state = {
      ...state,
      lastFlushActiveMs: snapshot.activeTimeMs,
      lastFlushScroll: snapshot.maxScrollPercent,
      ended: state.ended || snapshot.ended,
    };
  }

  function waitingCount() {
    return queue.length + (inFlight ? 1 : 0);
  }

  function dropOldestPassiveWaiting() {
    const index = queue.findIndex((item) => item.reason === "interval" || item.reason === "depth" || item.reason === "hide");
    if (index >= 0) queue.splice(index, 1);
  }

  function enqueue(reason: FlushReason, click?: BlogReadingClickCommand, snapshotOverride?: ProgressSnapshot) {
    if (!state || state.stopped) return;
    if (state.sealed && reason !== "end" && reason !== "hide") return;
    if (reason !== "open" && reason !== "click" && !shouldFlushObserver(state, reason)) return;
    if (!opened && reason !== "open" && reason !== "click") return;

    const snapshot = snapshotOverride ?? observeSnapshot(state, reason === "end");

    // Consolida updates passivos aguardando (nunca o inFlight).
    if (!click && (reason === "interval" || reason === "depth" || reason === "hide")) {
      const index = queue.findIndex((item) => item.generation === generation && !item.click && item.reason === reason);
      if (index >= 0) {
        queue[index] = {
          ...queue[index]!,
          snapshot,
          id: queue[index]!.id,
        };
        void pump();
        return;
      }
    }

    if (waitingCount() >= MAX_QUEUE) {
      if (reason === "interval" || reason === "depth" || reason === "hide") {
        dropOldestPassiveWaiting();
        if (waitingCount() >= MAX_QUEUE) return;
      } else if (reason === "click" || reason === "open" || reason === "end") {
        dropOldestPassiveWaiting();
        if (waitingCount() >= MAX_QUEUE) return;
      }
    }

    queue.push({
      id: ++nextId,
      generation,
      clientReadingId: state.clientReadingId,
      reason,
      snapshot,
      click,
      attempts: 0,
    });
    void pump();
  }

  function ensureZeroOpenAhead() {
    if (!state || opened) return;
    const openPending =
      (inFlight && inFlight.reason === "open" && inFlight.generation === generation) ||
      queue.some((row) => row.reason === "open" && row.generation === generation);
    if (openPending) return;
    queue.unshift({
      id: ++nextId,
      generation,
      clientReadingId: state.clientReadingId,
      reason: "open",
      snapshot: { activeTimeMs: 0, maxScrollPercent: 0, reachedEnd: false, ended: false },
      attempts: 0,
    });
  }

  function scheduleRetry(delayMs: number) {
    retryTimer?.cancel();
    retryTimer = schedule(() => {
      retryTimer = null;
      void pump();
    }, delayMs);
  }

  async function pump() {
    if (pumping || !state) return;
    if (inFlight) return;
    pumping = true;
    try {
      while (queue.length > 0 && state && !state.stopped && !inFlight) {
        const item = queue[0];
        if (!item) break;
        if (item.generation !== generation || item.clientReadingId !== state.clientReadingId) {
          queue.shift();
          continue;
        }
        if (!opened && item.reason !== "open") {
          if (item.reason === "click") {
            ensureZeroOpenAhead();
            break;
          }
          queue.shift();
          continue;
        }
        // Espaça só intervalos; marcos de profundidade são raros e devem sair sem esperar o gap.
        if (item.reason === "interval") {
          const gap = input.now() - lastNonUrgentSendAt;
          if (lastNonUrgentSendAt > 0 && gap < BLOG_READING_MIN_SEND_GAP_MS) {
            scheduleRetry(BLOG_READING_MIN_SEND_GAP_MS - gap);
            break;
          }
        }

        queue.shift();
        inFlight = item;
        const body = buildBlogReadingPayload({
          clientReadingId: item.clientReadingId,
          blogPostId: input.blogPostId,
          anonymousId,
          sessionId,
          activeTimeMs: item.snapshot.activeTimeMs,
          maxScrollPercent: item.snapshot.maxScrollPercent,
          reachedEnd: item.snapshot.reachedEnd,
          ended: item.snapshot.ended,
          consentUpdatedAt: input.consentUpdatedAt(),
          attributionRaw: input.attributionRaw?.() ?? null,
          click: item.click
            ? {
                eventId: item.click.eventId,
                ctaName: item.click.ctaName,
                destinationType: item.click.destinationType,
                targetPath: item.click.targetPath,
              }
            : undefined,
        });

        if (item.reason === "hide") {
          beacon(body);
          if (state && item.generation === generation && state.clientReadingId === item.clientReadingId) {
            // Best effort: não confirma snapshot (sem 200/202).
            persist();
          }
          inFlight = null;
          continue;
        }

        item.attempts += 1;
        const result = await send(body, { keepalive: item.reason === "click" || item.reason === "end" });
        const finished = inFlight;
        inFlight = null;
        if (!finished || finished.id !== item.id) continue;
        if (!state || finished.generation !== generation) continue;
        if (state.clientReadingId !== finished.clientReadingId) continue;

        if (result.kind === "ok") {
          opened = true;
          if (finished.reason === "interval" || finished.reason === "open") {
            lastNonUrgentSendAt = input.now();
          }
          applyConfirmed(finished.snapshot);
          if (finished.reason === "end" || finished.snapshot.ended) {
            sealLocally();
            continue;
          }
          if (finished.reason === "open" && pendingResume) {
            const resume = pendingResume;
            pendingResume = null;
            state = {
              ...state,
              activeTimeMs: Math.max(state.activeTimeMs, resume.activeTimeMs),
              maxScrollPercent: Math.max(state.maxScrollPercent, resume.maxScrollPercent),
              reachedEnd: state.reachedEnd || resume.reachedEnd,
              lastActivityAt: input.now(),
            };
            persist();
            if (resume.activeTimeMs > 0 || resume.maxScrollPercent > 0 || resume.reachedEnd) {
              enqueue("interval");
            }
            continue;
          }
          if (finished.reason === "open" && shouldFlushObserver(state, "depth")) {
            persist();
            enqueue("depth");
            continue;
          }
          persist();
          continue;
        }

        if (result.kind === "network" || result.kind === "limited" || result.kind === "other") {
          if (finished.attempts < MAX_ATTEMPTS) {
            // Reabre sempre em zero após falhas na abertura.
            if (finished.reason === "open") {
              queue.unshift({
                ...finished,
                snapshot: { activeTimeMs: 0, maxScrollPercent: 0, reachedEnd: false, ended: false },
              });
            } else {
              queue.unshift(finished);
            }
            const backoff = BLOG_READING_RETRY_BACKOFF_MS * 2 ** (finished.attempts - 1);
            scheduleRetry(backoff);
            break;
          }
          if (finished.reason === "open") {
            pendingResume = null;
            state = stopBlogReadingObserver(state);
            queue.length = 0;
            break;
          }
          continue;
        }

        if (result.kind === "closed") {
          // Idle local: apenas sela; não cria sessão fantasma.
          if (state.sealed || input.now() - state.lastActivityAt >= BLOG_READING_IDLE_MS) {
            sealLocally();
          }
          continue;
        }

        if (result.kind === "reject" || result.kind === "disabled") {
          state = stopBlogReadingObserver(state);
          queue.length = 0;
          break;
        }
      }
    } finally {
      pumping = false;
      if (!inFlight && queue.length > 0 && state && !state.stopped) void pump();
    }
  }

  function sealLocally() {
    if (!state) return;
    state = { ...state, sealed: true, ended: true };
    opened = false;
    pendingResume = null;
    queue.length = 0;
    inFlight = null;
    clearBlogReadingCheckpoint(input.session, input.blogPostId);
  }

  /** Após idle selado, só uma interação real abre outra sessão. */
  function beginFreshAfterIdle() {
    if (!state?.sealed) return;
    generation += 1;
    confirmed = null;
    pendingResume = null;
    queue.length = 0;
    inFlight = null;
    const now = input.now();
    const clientReadingId = input.randomUUID();
    state = createBlogReadingObserverState({ clientReadingId, blogPostId: input.blogPostId, now });
    opened = false;
    persist();
    enqueue("open", undefined, { activeTimeMs: 0, maxScrollPercent: 0, reachedEnd: false, ended: false });
  }

  return {
    start() {
      generation += 1;
      queue.length = 0;
      inFlight = null;
      opened = false;
      confirmed = null;
      pendingResume = null;
      retryTimer?.cancel();
      retryTimer = null;
      const now = input.now();
      anonymousId = readOrCreateBlogReaderId(input.local, now, input.randomUUID);
      sessionId = readOrCreateBlogSessionId(input.session, input.randomUUID);
      const found = readBlogReadingCheckpoint(input.session, input.blogPostId, now);
      if (found.kind === "resume") {
        if (found.checkpoint.opened) {
          state = {
            ...createBlogReadingObserverState({
              clientReadingId: found.checkpoint.clientReadingId,
              blogPostId: input.blogPostId,
              now,
            }),
            activeTimeMs: found.checkpoint.activeTimeMs,
            maxScrollPercent: found.checkpoint.maxScrollPercent,
            reachedEnd: found.checkpoint.reachedEnd,
            lastFlushActiveMs: found.checkpoint.activeTimeMs,
            lastFlushScroll: found.checkpoint.maxScrollPercent,
            lastActivityAt: now,
          };
          opened = true;
          confirmed = {
            activeTimeMs: found.checkpoint.activeTimeMs,
            maxScrollPercent: found.checkpoint.maxScrollPercent,
            reachedEnd: found.checkpoint.reachedEnd,
            ended: false,
          };
          persist();
          return;
        }
        pendingResume = found.checkpoint;
        state = createBlogReadingObserverState({
          clientReadingId: found.checkpoint.clientReadingId,
          blogPostId: input.blogPostId,
          now,
        });
        persist();
        enqueue("open", undefined, { activeTimeMs: 0, maxScrollPercent: 0, reachedEnd: false, ended: false });
        return;
      }
      if (found.kind === "expired") {
        clearBlogReadingCheckpoint(input.session, input.blogPostId);
      }
      const clientReadingId = input.randomUUID();
      state = createBlogReadingObserverState({ clientReadingId, blogPostId: input.blogPostId, now });
      persist();
      enqueue("open", undefined, { activeTimeMs: 0, maxScrollPercent: 0, reachedEnd: false, ended: false });
    },
    dispose(reason) {
      generation += 1;
      queue.length = 0;
      inFlight = null;
      retryTimer?.cancel();
      retryTimer = null;
      if (reason === "revoke") {
        clearBlogReadingCheckpoint(input.session, input.blogPostId);
        state = state ? stopBlogReadingObserver(state) : null;
        opened = false;
        confirmed = null;
        return;
      }
      if (reason === "unmount" || reason === "navigate") {
        if (state && !state.stopped && opened && !state.sealed) {
          const body = buildBlogReadingPayload({
            clientReadingId: state.clientReadingId,
            blogPostId: input.blogPostId,
            anonymousId,
            sessionId,
            activeTimeMs: state.activeTimeMs,
            maxScrollPercent: state.maxScrollPercent,
            reachedEnd: state.reachedEnd,
            ended: false,
            consentUpdatedAt: input.consentUpdatedAt(),
            attributionRaw: input.attributionRaw?.() ?? null,
          });
          beacon(body);
          persist();
        }
        state = state ? stopBlogReadingObserver(state) : null;
      }
    },
    noteActivity() {
      if (!state || state.stopped) return;
      if (state.sealed) {
        beginFreshAfterIdle();
        return;
      }
      state = applyObserverActivity(state, input.now());
      persist();
    },
    noteDepth(depth) {
      if (!state || state.stopped) return;
      if (state.sealed) {
        beginFreshAfterIdle();
        if (!state || state.stopped) return;
      }
      state = applyObserverDepth(state, depth);
      persist();
      enqueue("depth");
    },
    noteVisibility(visible) {
      if (!state || state.stopped || state.sealed) return;
      state = applyObserverVisibility(state, input.now(), visible);
      persist();
      if (!visible) enqueue("hide");
    },
    tick() {
      if (!state || state.stopped) return;
      if (state.sealed) return;
      state = tickBlogReadingObserver(state, input.now(), { visible: true });
      persist();
      if (state.sealed) {
        enqueue("end");
        return;
      }
      enqueue("interval");
    },
    reportClick(command) {
      const eventId = command.eventId ?? input.randomUUID();
      if (!state || state.stopped) return eventId;
      if (state.sealed) {
        beginFreshAfterIdle();
        if (!state || state.stopped) return eventId;
      }
      enqueue("click", {
        eventId,
        ctaName: command.ctaName,
        destinationType: command.destinationType,
        targetPath: command.targetPath,
      });
      return eventId;
    },
    getState: () => state,
    isOpened: () => opened,
    getGeneration: () => generation,
    getConfirmed: () => confirmed,
    getQueueSize: () => waitingCount(),
  };
}

export function blogReadingAttributionRaw(): string | null {
  try {
    return sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    return null;
  }
}
