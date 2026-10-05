/**
 * Único lugar para identidade, contato, SEO e textos de CTA.
 * WhatsApp, e-mail e Instagram ainda são placeholders.
 * Enquanto o WhatsApp contiver {{...}}, os CTAs não abrem wa.me.
 */
export const siteConfig = {
  name: "Alexandre Feio",
  url: "https://seudominio.com.br",
  location: {
    city: "Belém",
    state: "Pará",
    short: "Belém, Pará",
    serviceArea: "Atendimento em Belém/PA e projetos para todo o Brasil.",
  },
  contact: {
    whatsapp: "{{WHATSAPP}}",
    email: "{{EMAIL}}",
    instagram: "{{INSTAGRAM}}",
    whatsappMessage:
      "Olá, vi seu site e gostaria de conversar sobre como melhorar a presença digital da minha empresa.",
  },
  ctas: {
    primary: "Quero atrair mais clientes",
    secondary: "Conhecer os serviços",
    talk: "Quero conversar",
    final: "Falar sobre meu projeto",
  },
  seo: {
    title: "Alexandre Feio | Sites e Tráfego Pago em Belém",
    description:
      "Criação de sites, landing pages e gestão de tráfego pago para empresas que querem gerar mais oportunidades. Atendimento em Belém e projetos para todo o Brasil.",
    locale: "pt_BR",
  },
  features: {
    /**
     * "mock": envio simulado, sem rede.
     * "live": bloqueia o sucesso simulado até o POST real ser implementado em LeadForm.
     */
    leadForm: "mock" as "mock" | "live",
  },
};
