export const publicHomeCopy = {
  hero: "Tecnologia, marketing e estratégia para fazer seu negócio avançar.",
  support:
    "Aprenda com cursos práticos ou conte comigo para estruturar sua presença digital, tráfego e conversão.",
  primaryCta: "Conhecer os cursos",
  secondaryCta: "Quero atrair mais clientes",
} as const;

export const publicHomeMetadata = {
  title: "Cursos, tráfego pago e tecnologia",
  description:
    "Alexandre Feio: cursos práticos e gestão de tráfego, sites e conversão para pequenos negócios avançarem com critério.",
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
