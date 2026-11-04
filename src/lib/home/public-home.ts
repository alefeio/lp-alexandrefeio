export const publicHomeCopy = {
  hero: "Transforme tráfego em oportunidades.",
  support: "Atraia as pessoas certas, leve-as a uma página clara e saiba o que melhorar.",
  primaryCta: "Conhecer as formações",
  secondaryCta: "Começar gratuitamente",
  formationsTitle: "Escolha o resultado que precisa agora.",
  trafficPromise: "Planeje campanhas e tome decisões com os seus próprios dados.",
  sitesPromise: "Construa e publique uma landing page para o seu negócio.",
  resultsTitle: "Você sai com algo pronto para usar.",
  resultsSupport: "Decisões, planos e páginas construídos com o seu próprio negócio.",
  freeTitle: "Comece grátis e descubra seu próximo passo.",
  freeSupport: "Três aulas abertas em cada formação.",
  aboutName: "Alexandre Feio",
  aboutLine: "Desenvolvimento, marketing e produto no mesmo sistema.",
  aboutSupport: "Você pode aprender a executar ou delegar a estratégia e a gestão.",
  learnLabel: "APRENDER",
  learnCta: "Ver as formações",
  delegateLabel: "DELEGAR",
  delegateCta: "Conhecer a gestão",
  blogTitle: "Aprenda a atrair e converter mais clientes",
  blogSupport: "Conteúdos práticos sobre sites, tráfego pago e estratégias para melhorar seus resultados.",
  blogCta: "Ver todos os artigos",
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
