import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";

export function landingPageContentReferencesMedia(document: LandingPageDocumentV1, mediaId: string): boolean {
  for (const section of document.sections) {
    if ((section.type === "HERO" || section.type === "FOOTER") && section.content.mediaRef?.mediaId === mediaId) return true;
    if (section.type === "PORTFOLIO" && section.content.items.some((item) => item.mediaRef.mediaId === mediaId)) return true;
  }
  for (const proof of document.strategy?.copyFacts?.trustProofs ?? []) {
    if (proof.mediaIds?.includes(mediaId) || proof.avatarMediaId === mediaId) return true;
  }
  return false;
}

export function landingPageReferencesMedia(document: LandingPageDocumentV1, mediaId: string): boolean {
  return document.mediaRefs.some((ref) => ref.mediaId === mediaId) || landingPageContentReferencesMedia(document, mediaId);
}

export function landingPageReferencesProof(document: LandingPageDocumentV1, proofId: string): boolean {
  return document.sections.some((section) => {
    if (section.type !== "TRUST" && section.type !== "TESTIMONIALS") return false;
    return section.content.proofRefs?.includes(proofId) ?? false;
  });
}
