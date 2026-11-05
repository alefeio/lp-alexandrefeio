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
import { BLOG_READING_IDLE_MS } from "@/lib/blog/reading/constants";
import { readOrCreateBlogReaderId, readOrCreateBlogSessionId, type BlogReadingStorage } from "@/lib/blog/reading/identity";
import {
  applyObserverActivity,
  applyObserverDepth,
  applyObserverVisibility,
  createBlogReadingObserverState,
  markObserverFlushed,
  renewClientReadingAfterSeal,
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

type QueueItem = {
  seq: number;
  generation: number;
  clientReadingId: string;
  reason: FlushReason;
  snapshot: {
    activeTimeMs: number;
    maxScrollPercent: number;
    reachedEnd: boolean;
    ended: boolean;
  };
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
}): BlogReadingRuntime {
  const send = input.send ?? ((body, options) => sendBlogReadingUpdate(body, options));
  const beacon = input.beacon ?? sendBlogReadingBeacon;
  let state: BlogReadingObserverState | null = null;
  let anonymousId = "";
  let sessionId = "";
  let generation = 0;
  let opened = false;
  let pumping = false;
  let seq = 0;
  let pendingResume: BlogReadingCheckpoint | null = null;
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

  function enqueue(reason: FlushReason, click?: BlogReadingClickCommand) {
    if (!state || state.stopped) return;
    if (reason !== "open" && reason !== "click" && !shouldFlushObserver(state, reason)) return;
    // Updates e hide esperam abertura; cliques entram na fila com o mesmo eventId.
    if (!opened && reason !== "open" && reason !== "click") return;
    if (queue.length >= MAX_QUEUE) {
      if (reason === "interval" || reason === "depth") return;
      queue.shift();
    }
    if (!click && (reason === "interval" || reason === "depth" || reason === "hide")) {
      const index = queue.findIndex((item) => item.generation === generation && !item.click && item.reason === reason);
      if (index >= 0) queue.splice(index, 1);
    }
    queue.push({
      seq: ++seq,
      generation,
      clientReadingId: state.clientReadingId,
      reason,
      snapshot: {
        activeTimeMs: state.activeTimeMs,
        maxScrollPercent: state.maxScrollPercent,
        reachedEnd: state.reachedEnd,
        ended: state.ended || reason === "end",
      },
      click,
      attempts: 0,
    });
    void pump();
  }

  async function pump() {
    if (pumping || !state) return;
    pumping = true;
    try {
      while (queue.length > 0 && state && !state.stopped) {
        const item = queue[0];
        if (!item) break;
        if (item.generation !== generation || item.clientReadingId !== state.clientReadingId) {
          queue.shift();
          continue;
        }
        if (!opened && item.reason !== "open") {
          if (item.reason === "click") {
            const openPending = queue.some((row) => row.reason === "open" && row.generation === generation);
            if (!openPending && state) {
              queue.unshift({
                seq: ++seq,
                generation,
                clientReadingId: state.clientReadingId,
                reason: "open",
                snapshot: {
                  activeTimeMs: state.activeTimeMs,
                  maxScrollPercent: state.maxScrollPercent,
                  reachedEnd: state.reachedEnd,
                  ended: false,
                },
                attempts: 0,
              });
            }
            break;
          }
          queue.shift();
          continue;
        }
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
          if (state.clientReadingId === item.clientReadingId && item.generation === generation) {
            state = markObserverFlushed({
              ...state,
              activeTimeMs: Math.max(state.activeTimeMs, item.snapshot.activeTimeMs),
              maxScrollPercent: Math.max(state.maxScrollPercent, item.snapshot.maxScrollPercent),
              reachedEnd: state.reachedEnd || item.snapshot.reachedEnd,
            });
            persist();
          }
          queue.shift();
          continue;
        }
        item.attempts += 1;
        const result = await send(body, { keepalive: item.reason === "click" || item.reason === "end" });
        if (!state || item.generation !== generation) {
          queue.shift();
          continue;
        }
        if (state.clientReadingId !== item.clientReadingId) {
          queue.shift();
          continue;
        }
        if (result.kind === "ok") {
          opened = true;
          state = markObserverFlushed({
            ...state,
            activeTimeMs: Math.max(state.activeTimeMs, item.snapshot.activeTimeMs),
            maxScrollPercent: Math.max(state.maxScrollPercent, item.snapshot.maxScrollPercent),
            reachedEnd: state.reachedEnd || item.snapshot.reachedEnd,
            ended: state.ended || item.snapshot.ended,
          });
          if (item.reason === "open" && pendingResume) {
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
            queue.shift();
            if (resume.activeTimeMs > 0 || resume.maxScrollPercent > 0 || resume.reachedEnd) {
              enqueue("interval");
            }
            continue;
          }
          persist();
          queue.shift();
          continue;
        }
        if (result.kind === "network" || result.kind === "limited" || result.kind === "other") {
          if (item.attempts < MAX_ATTEMPTS) break;
          queue.shift();
          continue;
        }
        if (result.kind === "closed") {
          queue.shift();
          const idle = state.sealed || input.now() - state.lastActivityAt >= BLOG_READING_IDLE_MS;
          if (idle) {
            renewAfterIdle();
          }
          // 409 sem evidência local de idle: conflito/regressão — não renova.
          continue;
        }
        if (result.kind === "reject" || result.kind === "disabled") {
          state = stopBlogReadingObserver(state);
          queue.length = 0;
          break;
        }
        queue.shift();
      }
    } finally {
      pumping = false;
      if (queue.length > 0 && state && !state.stopped) void pump();
    }
  }

  function renewAfterIdle() {
    if (!state) return;
    clearBlogReadingCheckpoint(input.session, input.blogPostId);
    const clientReadingId = input.randomUUID();
    generation += 1;
    opened = false;
    queue.length = 0;
    state = renewClientReadingAfterSeal(state, clientReadingId, input.now());
    writeBlogReadingCheckpoint(input.session, input.blogPostId, checkpointFromState(state));
    enqueue("open");
  }

  return {
    start() {
      generation += 1;
      queue.length = 0;
      opened = false;
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
          persist();
          return;
        }
        // Abertura ainda não confirmada: cria em zero e reaplica o progresso depois.
        pendingResume = found.checkpoint;
        state = createBlogReadingObserverState({
          clientReadingId: found.checkpoint.clientReadingId,
          blogPostId: input.blogPostId,
          now,
        });
        persist();
        enqueue("open");
        return;
      }
      if (found.kind === "expired") {
        clearBlogReadingCheckpoint(input.session, input.blogPostId);
      }
      const clientReadingId = input.randomUUID();
      state = createBlogReadingObserverState({ clientReadingId, blogPostId: input.blogPostId, now });
      persist();
      enqueue("open");
    },
    dispose(reason) {
      generation += 1;
      queue.length = 0;
      if (reason === "revoke") {
        clearBlogReadingCheckpoint(input.session, input.blogPostId);
        state = state ? stopBlogReadingObserver(state) : null;
        opened = false;
        return;
      }
      if (reason === "unmount" || reason === "navigate") {
        if (state && !state.stopped && opened) {
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
      state = applyObserverActivity(state, input.now());
      persist();
    },
    noteDepth(depth) {
      if (!state || state.stopped) return;
      state = applyObserverDepth(state, depth);
      persist();
      enqueue("depth");
    },
    noteVisibility(visible) {
      if (!state || state.stopped) return;
      state = applyObserverVisibility(state, input.now(), visible);
      persist();
      if (!visible) enqueue("hide");
    },
    tick() {
      if (!state || state.stopped) return;
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
  };
}

export function blogReadingAttributionRaw(): string | null {
  try {
    return sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  } catch {
    return null;
  }
}
