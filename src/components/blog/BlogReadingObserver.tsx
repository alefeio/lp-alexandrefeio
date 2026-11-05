"use client";

import { useEffect, useMemo, useRef } from "react";
import { useConsent } from "@/components/consent/ConsentProvider";
import { BlogReadingProvider, type BlogReadingClickInput } from "@/components/blog/BlogReadingContext";
import { BLOG_READING_TICK_MS } from "@/lib/blog/reading/constants";
import { measureEditorialDepth } from "@/lib/blog/reading/observer-core";
import { blogReadingAttributionRaw, createBlogReadingRuntime, type BlogReadingRuntime } from "@/lib/blog/reading/runtime";

/**
 * Observa leitura no artigo publicado. Não renderiza UI.
 * Retomada: checkpoint em sessionStorage (tempo/profundidade/id). Idle ≥ 30 min renova a sessão.
 * Ordenação: abertura confirmada antes de updates; cliques esperam com o mesmo eventId.
 * Revogação: invalida geração, limpa fila e checkpoint; não envia no cleanup.
 * pagehide/visibility: best effort, sem entrega garantida.
 */
export function BlogReadingObserver({ blogPostId, children }: { blogPostId: string; children: React.ReactNode }) {
  const { consent, ready } = useConsent();
  const runtimeRef = useRef<BlogReadingRuntime | null>(null);
  const consentAtRef = useRef(consent.updatedAt);
  const analyticsRef = useRef(consent.analytics);

  useEffect(() => {
    analyticsRef.current = consent.analytics;
    if (consent.analytics) consentAtRef.current = consent.updatedAt;
  }, [consent.analytics, consent.updatedAt]);

  useEffect(() => {
    if (!ready) return;

    if (!consent.analytics) {
      runtimeRef.current?.dispose("revoke");
      runtimeRef.current = null;
      return;
    }

    const runtime = createBlogReadingRuntime({
      blogPostId,
      local: localStorage,
      session: sessionStorage,
      now: () => Date.now(),
      randomUUID: () => crypto.randomUUID(),
      consentUpdatedAt: () => consentAtRef.current,
      attributionRaw: blogReadingAttributionRaw,
    });
    runtimeRef.current = runtime;
    runtime.start();

    const readDepth = () => {
      const body = document.querySelector<HTMLElement>("[data-blog-reading-body]");
      if (!body) return { percent: 0, reachedEnd: false };
      const rect = body.getBoundingClientRect();
      return measureEditorialDepth({
        bodyTop: rect.top + window.scrollY,
        bodyHeight: Math.max(body.offsetHeight, rect.height),
        viewportTop: window.scrollY,
        viewportHeight: window.innerHeight || 1,
      });
    };

    const onActivity = () => runtime.noteActivity();
    const onScroll = () => {
      runtime.noteActivity();
      runtime.noteDepth(readDepth());
    };
    const onVisibility = () => {
      runtime.noteVisibility(document.visibilityState === "visible");
    };
    const onPageHide = () => {
      runtime.noteVisibility(false);
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      runtime.tick();
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
      // Só envia best effort se analytics ainda estiver concedido.
      if (analyticsRef.current) runtime.dispose("unmount");
      else runtime.dispose("revoke");
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [ready, consent.analytics, blogPostId]);

  const reportCommercialClick = (input: BlogReadingClickInput) => {
    if (!analyticsRef.current) return;
    runtimeRef.current?.reportClick(input);
  };

  const value = useMemo(
    () => ({ blogPostId, reportCommercialClick }),
    [blogPostId],
  );

  return <BlogReadingProvider value={value}>{children}</BlogReadingProvider>;
}
