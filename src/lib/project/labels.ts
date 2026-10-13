import { DESTINATION_TYPES, PROJECT_OBJECTIVES } from "@/lib/project/schema";

export const OBJECTIVE_LABEL: Record<(typeof PROJECT_OBJECTIVES)[number], string> = {
  LEADS: "Receber contatos",
  SALES: "Vender diretamente",
  WHATSAPP: "Receber mensagens no WhatsApp",
  STORE_VISITS: "Levar pessoas a uma loja",
  AWARENESS: "Aumentar reconhecimento",
  UNDEFINED: "Ainda não sei",
};

export const DESTINATION_LABEL: Record<(typeof DESTINATION_TYPES)[number], string> = {
  LANDING_PAGE: "Landing page",
  WEBSITE: "Site",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  MARKETPLACE: "Marketplace",
  OTHER: "Outro",
  UNDEFINED: "Ainda não defini",
};
