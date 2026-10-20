import type { LandingPageAction } from "@/lib/landing-page/actions";
import { sanitizeWhatsAppPhone } from "@/lib/landing-page/actions";

const SAFE_ANCHOR = /^[A-Za-z0-9_-]{1,64}$/;

export type ResolvedLandingPageAction = {
  href: string;
  label: string;
  external: boolean;
};

export function resolveLandingPageAction(action: LandingPageAction): ResolvedLandingPageAction | null {
  const label = "label" in action && action.label ? action.label : defaultActionLabel(action);

  switch (action.type) {
    case "WHATSAPP": {
      const phone = sanitizeWhatsAppPhone(action.phone);
      if (!phone) return null;
      const href = action.message
        ? `https://wa.me/${phone}?text=${encodeURIComponent(action.message)}`
        : `https://wa.me/${phone}`;
      return { href, label, external: true };
    }
    case "EXTERNAL_URL":
      return { href: action.url, label, external: true };
    case "INTERNAL_ROUTE":
      return { href: action.path, label, external: false };
    case "FORM_ANCHOR": {
      const id = action.sectionId ?? "formulario";
      if (!SAFE_ANCHOR.test(id)) return null;
      return { href: `#${id}`, label, external: false };
    }
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

function defaultActionLabel(action: LandingPageAction): string {
  switch (action.type) {
    case "WHATSAPP":
      return "Falar no WhatsApp";
    case "EXTERNAL_URL":
      return "Continuar";
    case "INTERNAL_ROUTE":
      return "Continuar";
    case "FORM_ANCHOR":
      return "Ir para o formulário";
    default: {
      const _never: never = action;
      return _never;
    }
  }
}
