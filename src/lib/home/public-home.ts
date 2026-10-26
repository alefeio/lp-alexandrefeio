export const publicHomeCopy = {
  hero: "Transforme tráfego em oportunidades.",
  support: "Aprenda a atrair as pessoas certas, construir a página para onde elas vão e usar os resultados para decidir o que melhorar.",
  complement: "Duas formações práticas. Um sistema aplicado ao seu negócio.",
  primaryCta: "Conhecer as formações",
  secondaryCta: "Começar gratuitamente",
  finalTitle: "Descubra qual parte do sistema seu negócio precisa fortalecer agora.",
  finalPrimaryCta: "Ver as formações",
} as const;

export const publicHomeMetadata = {
  title: "Tráfego e páginas para pequenos negócios",
  description: "Alexandre Feio: atraia as pessoas certas, construa a página e use os resultados para decidir o próximo passo.",
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
