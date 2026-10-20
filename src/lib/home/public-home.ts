export const publicHomeCopy = {
  hero: "Aprenda. Aplique. Faça seu negócio avançar.",
  support:
    "Cursos práticos de tecnologia e marketing em que cada etapa ajuda você a tomar decisões, construir algo real e avançar no seu próprio negócio.",
  primaryCta: "Explorar os cursos",
  secondaryCta: "Prefiro contratar a gestão",
  finalSecondaryCta: "Quero atrair mais clientes",
} as const;

export const publicHomeMetadata = {
  title: "Cursos práticos de tecnologia e marketing",
  description:
    "Alexandre Feio: aprenda, aplique e avance com cursos práticos de tecnologia, marketing e tráfego — ou delegue a gestão.",
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
