import type { NavItem } from "@/types/content";

export const navigation: readonly NavItem[] = [
  { href: "#servicos", label: "Serviços" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#diferenca", label: "Diferenciais" },
  { href: "#sobre", label: "Sobre" },
  { href: "#faq", label: "FAQ" },
];

export const footerNavigation: readonly NavItem[] = [
  ...navigation,
  { href: "#contato", label: "Contato" },
];
