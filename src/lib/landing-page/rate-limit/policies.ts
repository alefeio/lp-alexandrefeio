/** Limites técnicos antiabuso. Não são cota comercial de lead, mídia ou geração. */
export const LANDING_PAGE_RATE_POLICIES = {
  copy: { namespace: "landing-copy", limit: 10, windowSeconds: 10 * 60 },
  mediaUpload: { namespace: "landing-media-upload", limit: 20, windowSeconds: 10 * 60 },
  form: { namespace: "landing-form", limit: 5, windowSeconds: 10 * 60 },
  publicEvent: { namespace: "landing-public-event", limit: 120, windowSeconds: 10 * 60 },
} as const;
