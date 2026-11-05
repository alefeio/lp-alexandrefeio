"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useConsent } from "@/components/consent/ConsentProvider";
import { BlogReadingProvider, type BlogReadingClickInput } from "@/components/blog/BlogReadingContext";
import { ATTRIBUTION_STORAGE_KEY } from "@/lib/attribution";
import {
  BLOG_READING_TICK_MS,
} from "@/lib/blog/reading/constants";
import {
  buildBlogReadingPayload,
  clearBlogReadingClientId,
  rememberBlogReadingClientId,
  resolveBlogReadingIdentities,
  sendBlogReadingBeacon,
  sendBlogReadingUpdate,
} from "@/lib/blog/reading/client";
import {
  applyObserverActivity,
  applyObserverDepth,
  applyObserverVisibility,
  createBlogReadingObserverState,
  markObserverFlushed,
  measureEditorialDepth,
  renewClientReadingAfterSeal,
  shouldFlushObserver,
  stopBlogReadingObserver,
  tickBlogReadingObserver,
  type BlogReadingObserverState,
} from "@/lib/blog/reading/observer-core";

type Identities = { anonymousId: string; sessionId: string; clientReadingId: string };

/**
 * Observa leitura no artigo publicado. Não renderiza UI.
 * Só envia com consentimento de analytics. A coleta no servidor continua desligada até a flag.
 */
export function BlogReadingObserver({ blogPostId, children }: { blogPostId: string; children: React.ReactNode }) {
  const { consent, ready } = useConsent();
  const stateRef = useRef<BlogReadingObserverState | null>(null);
  const identitiesRef = useRef<Identities | null>(null);
  const consentAtRef = useRef(0);
  const inflightRef = useRef(false);
  const openedRef = useRef(false);

  const readDepth = useCallback(() => {
    const body = document.querySelector<HTMLElement>("[data-blog-reading-body]");
    if (!body) return { percent: 0, reachedEnd: false };
    const rect = body.getBoundingClientRect();
    return measureEditorialDepth({
      bodyTop: rect.top + window.scrollY,
      bodyHeight: Math.max(body.offsetHeight, rect.height),
      viewportTop: window.scrollY,
      viewportHeight: window.innerHeight || 1,
    });
  }, []);

  const flush = useCallback(async (reason: "interval" | "depth" | "hide" | "click" | "end" | "open", click?: BlogReadingClickInput & { eventId: string }) => {
    const state = stateRef.current;
    const identities = identitiesRef.current;
    if (!state || !identities || state.stopped) return;
    if (!shouldFlushObserver(state, reason) && reason !== "click") return;
    if (inflightRef.current && reason !== "hide" && reason !== "click") return;
    const snapshot = {
      activeTimeMs: state.activeTimeMs,
      maxScrollPercent: state.maxScrollPercent,
      reachedEnd: state.reachedEnd,
      ended: state.ended || reason === "end",
    };
    const body = buildBlogReadingPayload({
      ...identities,
      blogPostId: state.blogPostId,
      ...snapshot,
      consentUpdatedAt: consentAtRef.current,
      attributionRaw: sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY),
      click: click
        ? {
            eventId: click.eventId,
            ctaName: click.ctaName,
            destinationType: click.destinationType,
            targetPath: click.targetPath,
          }
        : undefined,
    });
    if (reason === "hide") {
      sendBlogReadingBeacon(body);
      stateRef.current = markObserverFlushed(state);
      return;
    }
    inflightRef.current = true;
    const result = await sendBlogReadingUpdate(body, { keepalive: reason === "click" || reason === "end" });
    inflightRef.current = false;
    if (!stateRef.current) return;
    if (result.kind === "ok") {
      stateRef.current = markObserverFlushed({ ...stateRef.current, ended: snapshot.ended });
      openedRef.current = true;
      return;
    }
    if (result.kind === "closed") {
      clearBlogReadingClientId(sessionStorage, blogPostId);
      const renewed = resolveBlogReadingIdentities({
        local: localStorage,
        session: sessionStorage,
        blogPostId,
        now: Date.now(),
        randomUUID: () => crypto.randomUUID(),
        renew: true,
      });
      rememberBlogReadingClientId(sessionStorage, blogPostId, renewed.clientReadingId);
      identitiesRef.current = renewed;
      stateRef.current = renewClientReadingAfterSeal(stateRef.current, renewed.clientReadingId, Date.now());
      openedRef.current = false;
      return;
    }
    if (result.kind === "reject" || result.kind === "disabled") {
      stateRef.current = stopBlogReadingObserver(stateRef.current);
    }
  }, [blogPostId]);

  const reportCommercialClick = useCallback((input: BlogReadingClickInput) => {
    if (!consent.analytics || !stateRef.current || stateRef.current.stopped) return;
    const eventId = crypto.randomUUID();
    void flush("click", { ...input, eventId });
  }, [consent.analytics, flush]);

  useEffect(() => {
    if (!ready) return;
    if (!consent.analytics) {
      stateRef.current = stateRef.current ? stopBlogReadingObserver(stateRef.current) : null;
      identitiesRef.current = null;
      openedRef.current = false;
      return;
    }
    consentAtRef.current = consent.updatedAt;
    const now = Date.now();
    const identities = resolveBlogReadingIdentities({
      local: localStorage,
      session: sessionStorage,
      blogPostId,
      now,
      randomUUID: () => crypto.randomUUID(),
    });
    identitiesRef.current = identities;
    stateRef.current = createBlogReadingObserverState({
      clientReadingId: identities.clientReadingId,
      blogPostId,
      now,
    });
    openedRef.current = false;
    void flush("open");

    const onActivity = () => {
      if (!stateRef.current) return;
      stateRef.current = applyObserverActivity(stateRef.current, Date.now());
    };
    const onScroll = () => {
      if (!stateRef.current) return;
      onActivity();
      stateRef.current = applyObserverDepth(stateRef.current, readDepth());
      void flush("depth");
    };
    const onVisibility = () => {
      if (!stateRef.current) return;
      const visible = document.visibilityState === "visible";
      stateRef.current = applyObserverVisibility(stateRef.current, Date.now(), visible);
      if (!visible) void flush("hide");
    };
    const onPageHide = () => {
      void flush("hide");
    };
    const timer = window.setInterval(() => {
      if (!stateRef.current) return;
      const visible = document.visibilityState === "visible";
      stateRef.current = tickBlogReadingObserver(stateRef.current, Date.now(), { visible });
      if (stateRef.current.sealed) {
        void flush("end");
        return;
      }
      void flush("interval");
    }, BLOG_READING_TICK_MS);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    onScroll();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void flush("hide");
      stateRef.current = stateRef.current ? stopBlogReadingObserver(stateRef.current) : null;
    };
  }, [ready, consent.analytics, consent.updatedAt, blogPostId, flush, readDepth]);

  const value = useMemo(
    () => ({ blogPostId, reportCommercialClick }),
    [blogPostId, reportCommercialClick],
  );

  return <BlogReadingProvider value={value}>{children}</BlogReadingProvider>;
}
