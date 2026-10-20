import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "@/lib/landing-page/document";

const longCopy =
  "Um texto longo precisa quebrar em telas estreitas sem estourar a largura da página, mesmo quando a frase continua por muitas palavras seguidas.";

/** Landing fictícia neutra, só para testes. Não é rota pública nem cliente real. */
export function consultoriaLandingFixture(): LandingPageDocumentV1 {
  const document = createEmptyLandingPageDocument();
  document.theme = {
    fontFamily: "sans",
    primaryColor: "#1d4ed8",
    backgroundColor: "#f8fafc",
    textColor: "#0f172a",
    buttonRadius: "md",
    contentWidth: "default",
  };
  document.sections = [
    {
      id: "off",
      type: "BENEFITS",
      variant: "default",
      order: 9,
      enabled: false,
      content: { heading: "Oculto", items: [{ title: "Oculto", description: "Não deve aparecer." }] },
      settings: {},
    },
    {
      id: "benefits",
      type: "BENEFITS",
      variant: "grid",
      order: 0,
      enabled: true,
      content: {
        heading: "O que você organiza",
        items: [{ title: "Oferta clara", description: longCopy }],
      },
      settings: {},
    },
    {
      id: "hero",
      type: "HERO",
      variant: "split",
      order: 1,
      enabled: true,
      content: {
        eyebrow: "Consultoria",
        headline: "Consultoria para pequenos negócios",
        subheadline: "Uma página de exemplo, sem cliente real.",
        primaryCta: { type: "WHATSAPP", phone: "5511999990000", message: "Olá" },
        secondaryCta: { type: "FORM_ANCHOR", sectionId: "formulario", label: "Pedir contato" },
      },
      settings: {},
    },
    {
      id: "process",
      type: "PROCESS",
      variant: "numbered",
      order: 1,
      enabled: true,
      content: {
        heading: "Como funciona",
        steps: [
          { title: "Entender", description: "Mapear o próximo passo." },
          { title: "Estruturar", description: "Organizar a página." },
        ],
      },
      settings: {},
    },
    {
      id: "trust",
      type: "TRUST",
      variant: "default",
      order: 3,
      enabled: true,
      content: {
        heading: "Sobre o trabalho",
        intro: "Somente o que foi informado.",
        items: [{ title: "Processo", description: "Atendimento combinado antes do início." }],
      },
      settings: {},
    },
    {
      id: "faq",
      type: "FAQ",
      variant: "default",
      order: 4,
      enabled: true,
      content: {
        heading: "Perguntas",
        items: [{ question: "Preciso de site completo?", answer: "Não. Esta página é um exemplo." }],
      },
      settings: {},
    },
    {
      id: "cta",
      type: "CTA",
      variant: "banner",
      order: 5,
      enabled: true,
      content: {
        heading: "Fale sobre o seu negócio",
        description: longCopy,
        action: { type: "EXTERNAL_URL", url: "https://exemplo.com/contato", label: "Ver site" },
      },
      settings: {},
    },
    {
      id: "formulario",
      type: "FORM",
      variant: "default",
      order: 6,
      enabled: true,
      content: {
        heading: "Contato",
        fields: ["name", "email", "phone", "message"],
        consentEnabled: true,
        consentText: "Aceito o uso destes dados para retorno do contato.",
        submitLabel: "Enviar",
      },
      settings: {},
    },
    {
      id: "contact",
      type: "CONTACT",
      variant: "default",
      order: 7,
      enabled: true,
      content: {
        heading: "Onde falar",
        email: "contato@exemplo.com",
        whatsapp: "5511999990000",
      },
      settings: {},
    },
    {
      id: "footer",
      type: "FOOTER",
      variant: "default",
      order: 8,
      enabled: true,
      content: {
        brandText: "Consultoria exemplo",
        copyrightText: "Página de demonstração.",
        links: [{ label: "Início", action: { type: "INTERNAL_ROUTE", path: "/inicio", label: "Início" } }],
      },
      settings: {},
    },
  ];
  return landingPageDocumentSchema.parse(document);
}
