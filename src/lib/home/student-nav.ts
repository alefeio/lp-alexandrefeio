export const STUDENT_NAV = [
  { id: "inicio", href: "/app", label: "Início" },
  { id: "cursos", href: "/app/aprendizado", label: "Meus cursos" },
  { id: "diagnosticos", href: "/app/diagnosticos", label: "Diagnósticos" },
  { id: "negocio", href: "/app/projetos", label: "Meu negócio" },
  { id: "alertas", href: "/app/alertas", label: "Alertas" },
  { id: "compras", href: "/app/compras", label: "Compras" },
] as const;

export type StudentNavId = (typeof STUDENT_NAV)[number]["id"];

/** Seção atual a partir de um caminho interno. Checkout e carrinho não fingem ser outra área. */
export function activeStudentItem(pathname: string): StudentNavId | null {
  if (pathname === "/app") return "inicio";
  if (pathname === "/app/aprendizado" || pathname.startsWith("/app/aprendizado/")) return "cursos";
  if (pathname === "/app/cursos" || pathname.startsWith("/app/cursos/")) return "cursos";
  if (pathname === "/app/diagnosticos" || pathname.startsWith("/app/diagnosticos/")) return "diagnosticos";
  if (/^\/app\/projetos\/[^/]+\/diagnostico$/.test(pathname)) return "diagnosticos";
  if (/^\/app\/projetos\/[^/]+\/diagnosticos\/[^/]+$/.test(pathname)) return "diagnosticos";
  if (pathname === "/app/projetos" || pathname.startsWith("/app/projetos/")) return "negocio";
  if (pathname === "/app/alertas" || pathname.startsWith("/app/alertas/")) return "alertas";
  if (pathname === "/app/compras" || pathname.startsWith("/app/compras/")) return "compras";
  return null;
}
