export const publicHomeCopy = {
  hero: "Aprenda tráfego pago aplicando no seu próprio negócio.",
  primaryCta: "Começar gratuitamente",
  secondaryCta: "Prefiro contratar a gestão",
} as const;

export const publicHomeMetadata = {
  title: "Aprenda tráfego pago na prática",
  description:
    "Alexandre Feio ensina tráfego pago para aplicar no próprio negócio e também faz a gestão para quem prefere delegar.",
  canonical: "/",
} as const;

/** A home personalizada é por request. Não entra em cache compartilhado. */
export const studentHomeRendering = {
  dynamic: "force-dynamic",
  sharedCache: false,
} as const;

export function homeAudience(signedIn: boolean): "anonymous" | "student" {
  return signedIn ? "student" : "anonymous";
}

export function homeBelongsToViewer(builtForUserId: string, viewerId: string): boolean {
  return builtForUserId.length > 0 && builtForUserId === viewerId;
}
