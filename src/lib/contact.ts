import { siteConfig } from "../data/site-config";
import type { AnalyticsEventName } from "@/lib/analytics";

const PLACEHOLDER_PATTERN = /\{\{[^{}]+\}\}/;

export function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERN.test(value.trim());
}

export function isWhatsAppConfigured(value = siteConfig.contact.whatsapp): boolean {
  if (isPlaceholder(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/** Monta o link do WhatsApp. Retorna null enquanto o número for placeholder. */
export function buildWhatsAppUrl(message = siteConfig.contact.whatsappMessage): string | null {
  if (!isWhatsAppConfigured()) return null;
  const digits = siteConfig.contact.whatsapp.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function emailHref(): string | null {
  const email = siteConfig.contact.email.trim();
  if (isPlaceholder(email) || !email.includes("@")) return null;
  return `mailto:${email}`;
}

export function instagramHref(): string | null {
  const explicit = siteConfig.contact.instagramUrl.trim();
  if (!isPlaceholder(explicit) && (explicit.startsWith("https://") || explicit.startsWith("http://"))) {
    return explicit;
  }

  const instagram = siteConfig.contact.instagram.trim();
  if (isPlaceholder(instagram)) return null;
  if (instagram.startsWith("http://") || instagram.startsWith("https://")) return instagram;

  const handle = instagram.replace(/^@/, "").replace(/\/$/, "");
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

/** Link para conversar com um número informado pelo visitante. */
export function visitorWhatsAppUrl(digits: string): string | null {
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}

export interface CtaTarget {
  href: string;
  external: boolean;
  event: Extract<AnalyticsEventName, "cta_click" | "whatsapp_click" | "service_interest">;
}

/**
 * CTAs gerais e de serviço abrem o formulário.
 * Só o canal "whatsapp" abre a conversa direta.
 */
export function resolveCta(serviceId?: string, channel: "form" | "whatsapp" = "form"): CtaTarget {
  if (serviceId) {
    return {
      href: `/?servico=${encodeURIComponent(serviceId)}#contato`,
      external: false,
      event: "service_interest",
    };
  }

  if (channel === "whatsapp") {
    const whatsappUrl = buildWhatsAppUrl();
    if (whatsappUrl) {
      return { href: whatsappUrl, external: true, event: "whatsapp_click" };
    }
  }

  return { href: "#contato", external: false, event: "cta_click" };
}
