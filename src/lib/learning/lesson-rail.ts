export const lessonRail = {
  logoHref: "/",
  logoLabel: "Página inicial — Alexandre Feio",
  desktopClass:
    "sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain lg:block",
  mobileClass: "rounded-lg border border-border p-4 lg:hidden",
  sectionStates: ["Você está aqui", "Já passou", "Adiante"] as const,
  appliesInReader: true,
  appliesInAdminPreview: true,
} as const;

export function lessonRailSectionState(index: number, currentIndex: number): (typeof lessonRail.sectionStates)[number] {
  if (currentIndex >= 0 && index === currentIndex) return "Você está aqui";
  if (currentIndex >= 0 && index < currentIndex) return "Já passou";
  return "Adiante";
}
