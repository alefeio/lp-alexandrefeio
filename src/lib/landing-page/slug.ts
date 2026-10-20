import { LANDING_PAGE_LIMITS, LANDING_PAGE_RESERVED_SLUGS } from "@/lib/landing-page/constants";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeLandingPageSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidLandingPageSlug(input: string): boolean {
  const slug = normalizeLandingPageSlug(input);
  if (slug.length < 2 || slug.length > LANDING_PAGE_LIMITS.maxSlug) return false;
  if (LANDING_PAGE_RESERVED_SLUGS.has(slug)) return false;
  if (slug.includes(".") || slug.includes("/") || slug.includes("\\")) return false;
  if (slug.includes("..")) return false;
  return SLUG_RE.test(slug);
}
