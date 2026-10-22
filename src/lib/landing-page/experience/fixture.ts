import { createEmptyLandingPageDocument, landingPageDocumentSchema, type LandingPageDocumentV1 } from "@/lib/landing-page/document";

const visual = { backgroundRole: "DEFAULT" as const, alignment: "LEFT" as const, emphasis: "NORMAL" as const };
const action = { type: "WHATSAPP" as const, phone: "11999998888" };
const longHeadline = "Móveis sob medida para quem precisa decidir prazo, medida e confiança antes de contratar o projeto";
const longBenefit = "O texto deste benefício continua por várias linhas para mostrar como a leitura se comporta quando a frase não cabe em uma única linha da tela.";
const longAnswer = `${"A resposta desta pergunta explica o prazo, a medida e o que entra no orçamento. ".repeat(8)}Ela precisa quebrar sem estourar a largura.`;

export function landingExperienceFixtureEnabled(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== "production";
}

/** Documento sintético para revisão visual. Não grava projeto e não usa armazenamento remoto. */
export function experienceReviewFixture(): {
  document: LandingPageDocumentV1;
  media: Array<{ id: string; status: "READY"; publicUrl: string | null; width: number; height: number; altText: string | null }>;
} {
  const document = createEmptyLandingPageDocument();
  document.theme = {
    ...document.theme,
    colors: {
      ...document.theme.colors,
      background: "#f8fafc",
      surface: "#ffffff",
      text: "#0f172a",
      mutedText: "#334155",
      primary: "#1d4ed8",
      primaryText: "#ffffff",
    },
  };
  document.conversion.primaryAction = action;
  document.strategy = {
    copyFacts: {
      version: 1,
      trustProofs: [
        {
          id: "proof-1",
          type: "TESTIMONIAL",
          title: "Depoimento informado",
          quote: "O orçamento ficou claro e o prazo combinado foi cumprido no projeto da sala.",
          authorName: "Cliente informado",
          consentConfirmed: true,
          status: "READY_FOR_DISPLAY",
        },
      ],
    },
  };
  document.sections = [
    {
      id: "hero",
      type: "HERO",
      variant: "split",
      order: 0,
      enabled: true,
      contentStatus: "APPROVED",
      content: { headline: longHeadline, subheadline: longBenefit, primaryCta: action, mediaRef: { mediaId: "fixture-photo", usage: "HERO", altText: "Peça de madeira sobre a bancada" } },
      settings: visual,
    },
    {
      id: "problem",
      type: "PROBLEM",
      variant: "default",
      order: 1,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "O que trava a decisão", description: longBenefit },
      settings: visual,
    },
    {
      id: "solution",
      type: "SOLUTION",
      variant: "default",
      order: 2,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Como o projeto anda", description: longBenefit },
      settings: visual,
    },
    {
      id: "benefits",
      type: "BENEFITS",
      variant: "grid",
      order: 3,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "O que fica claro", items: [{ title: "Prazo visível", description: longBenefit }, { title: "Medida combinada", description: longBenefit }] },
      settings: visual,
    },
    {
      id: "process",
      type: "PROCESS",
      variant: "numbered",
      order: 4,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Passos", steps: [{ title: "Conversa", description: longBenefit }, { title: "Proposta", description: longBenefit }] },
      settings: visual,
    },
    {
      id: "trust",
      type: "TRUST",
      variant: "default",
      order: 5,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Trabalho real", items: [], proofRefs: ["proof-1"] },
      settings: visual,
    },
    {
      id: "portfolio",
      type: "PORTFOLIO",
      variant: "default",
      order: 6,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Peças", items: [{ title: "Bancada", description: longBenefit, mediaRef: { mediaId: "fixture-photo", usage: "PORTFOLIO", altText: "Bancada de madeira" } }] },
      settings: visual,
    },
    {
      id: "testimonials",
      type: "TESTIMONIALS",
      variant: "default",
      order: 7,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Quem contratou", proofRefs: ["proof-1"] },
      settings: visual,
    },
    {
      id: "faq",
      type: "FAQ",
      variant: "default",
      order: 8,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Perguntas", items: [{ question: "Quanto tempo leva?", answer: longAnswer }] },
      settings: visual,
    },
    {
      id: "cta",
      type: "CTA",
      variant: "banner",
      order: 9,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Pedir o próximo passo", action },
      settings: { backgroundRole: "SURFACE", alignment: "CENTER", emphasis: "FEATURED" },
    },
    {
      id: "form",
      type: "FORM",
      variant: "default",
      order: 10,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Mensagem", fields: ["name", "email"], submitLabel: "Enviar mensagem" },
      settings: visual,
    },
    {
      id: "contact",
      type: "CONTACT",
      variant: "default",
      order: 11,
      enabled: true,
      contentStatus: "APPROVED",
      content: { heading: "Contato", phone: "11999998888" },
      settings: visual,
    },
    {
      id: "footer",
      type: "FOOTER",
      variant: "default",
      order: 12,
      enabled: true,
      contentStatus: "APPROVED",
      content: { brandText: "Oficina", links: [{ label: "Falar no WhatsApp", action }] },
      settings: visual,
    },
  ];
  const parsed = landingPageDocumentSchema.parse(document);
  return {
    document: parsed,
    media: [
      {
        id: "fixture-photo",
        status: "READY",
        publicUrl: "https://example.com/experience-fixture.png",
        width: 64,
        height: 64,
        altText: "Peça de madeira sobre a bancada",
      },
    ],
  };
}
