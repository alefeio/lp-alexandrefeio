/** Uma vez por carregamento da página. Recarregar o documento zera o conjunto. */
export function createPublicLifecycleTracker() {
  const seen = new Set<string>();
  return {
    once(key: string): boolean {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    },
  };
}

export const publicLandingLifecycle = createPublicLifecycleTracker();

export function reportPublicLandingEvent(
  slug: string,
  body: { eventType: string; sectionId?: string },
  transport: (url: string, init: { method: string; headers: { "content-type": string }; body: string; keepalive: boolean }) => Promise<unknown> = fetch,
): void {
  try {
    const payload = JSON.stringify(body);
    const url = `/api/public/landing-pages/${encodeURIComponent(slug)}/events`;
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      if (sent) return;
    }
    void transport(url, { method: "POST", headers: { "content-type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
  } catch {
    // A métrica não pode impedir o clique.
  }
}
