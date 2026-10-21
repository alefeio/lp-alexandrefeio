/**
 * Limites técnicos da mídia pública da landing page.
 * BEFORE_PUBLIC_RELEASE: revisar o teto comercial de assets antes de abrir o curso.
 * A retenção definitiva do arquivo depois do fim do projeto continua em aberto.
 */

export const LANDING_PAGE_MEDIA_TYPES = [
  "LOGO",
  "HERO_IMAGE",
  "PORTFOLIO_IMAGE",
  "TRUST_IMAGE",
  "TESTIMONIAL_AVATAR",
  "CREDENTIAL_IMAGE",
  "GENERAL_IMAGE",
] as const;

export type LandingPageMediaType = (typeof LANDING_PAGE_MEDIA_TYPES)[number];

export const LANDING_PAGE_MEDIA_STATUSES = ["UPLOADING", "READY", "FAILED", "DELETED"] as const;

export type LandingPageMediaStatus = (typeof LANDING_PAGE_MEDIA_STATUSES)[number];

export const LANDING_PAGE_MEDIA_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type LandingPageMediaContentType = (typeof LANDING_PAGE_MEDIA_CONTENT_TYPES)[number];

export const LANDING_PAGE_MEDIA_USAGES = ["LOGO", "HERO", "PORTFOLIO", "TRUST", "TESTIMONIAL", "CREDENTIAL", "GENERAL"] as const;

export type LandingPageMediaUsage = (typeof LANDING_PAGE_MEDIA_USAGES)[number];

export const LANDING_PAGE_MEDIA_FITS = ["COVER", "CONTAIN"] as const;
export const LANDING_PAGE_MEDIA_POSITIONS = ["CENTER", "TOP", "BOTTOM"] as const;
export const LANDING_PAGE_MEDIA_ASPECTS = ["AUTO", "SQUARE", "LANDSCAPE", "PORTRAIT"] as const;

export const LANDING_PAGE_MEDIA_LIMITS = {
  maxAssetsPerProject: 20,
  maxLogoBytes: 5 * 1024 * 1024,
  maxImageBytes: 10 * 1024 * 1024,
  maxPortfolioItems: 12,
  maxAltText: 180,
  uploadWindowMs: 10 * 60 * 1000,
  uploadMaxPerWindow: 20,
  abandonedUploadMs: 15 * 60 * 1000,
} as const;

export function maxBytesForMediaType(type: LandingPageMediaType): number {
  return type === "LOGO" ? LANDING_PAGE_MEDIA_LIMITS.maxLogoBytes : LANDING_PAGE_MEDIA_LIMITS.maxImageBytes;
}
