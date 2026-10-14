import type { NavItem } from "@/types/content";

export const navigation: readonly NavItem[] = [
  { href: "/cursos/trafego-pago-na-pratica", label: "Curso" },
  { href: "/cursos/trafego-pago-na-pratica#aulas-gratuitas", label: "Aulas gratuitas" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#sobre", label: "Sobre" },
  { href: "/trafego-pago", label: "Gestão" },
];

export const footerNavigation: readonly NavItem[] = [
  ...navigation,
  { href: "/trafego-pago#contato", label: "Contato" },
];
