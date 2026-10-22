import type { LandingPageDocumentV1 } from "@/lib/landing-page/document";
import { sanitizeWhatsAppPhone } from "@/lib/landing-page/actions";
import { resolveLandingPageAction } from "@/lib/landing-page/action-resolver";
import type { LandingPageAction } from "@/lib/landing-page/actions";
import {
  EXPERIENCE_CAPABILITIES_V1,
  type ExperienceActionCode,
  type ExperienceCapabilities,
  type ExperienceFindingCategory,
  type ExperienceFindingV1,
  type ExperienceSeverity,
} from "@/lib/landing-page/experience/schema";
import type { ExperienceViewportId } from "@/lib/landing-page/experience/viewports";
import { assessThemeContrast } from "@/lib/landing-page/theme/schema";
import { evaluateVisualHierarchy } from "@/lib/landing-page/theme/hierarchy";
import { trustProofReady } from "@/lib/landing-page/trust/schema";

const CORE_TYPES = ["HERO", "PROBLEM", "SOLUTION", "BENEFITS", "CTA"] as const;
const HEADLINE_ATTENTION = 72;
const ACTION_LABEL_ATTENTION = 32;
const FAQ_ANSWER_ATTENTION = 500;
const LARGE_IMAGE_BYTES = 5 * 1024 * 1024;
const MANY_IMAGES = 8;
const MANY_SECTIONS = 12;
const MANY_CTA = 2;
const ACTION_GAP = 6;

export type ExperienceMediaInput = {
  id: string;
  status: "UPLOADING" | "READY" | "FAILED" | "DELETED";
  fileSize: number;
  altText: string | null;
};

type DraftFinding = {
  code: string;
  category: ExperienceFindingCategory;
  severity: ExperienceSeverity;
  scope: "PAGE" | "SECTION";
  sectionId?: string;
  viewport?: ExperienceViewportId;
  message: string;
  recommendation: string;
  actionCode?: ExperienceActionCode;
  platformLimitation?: boolean;
};

function findingId(draft: DraftFinding): string {
  return [draft.code, draft.sectionId ?? "-", draft.viewport ?? "-"].join(":");
}

function push(list: DraftFinding[], draft: DraftFinding) {
  if (list.some((item) => findingId(item) === findingId(draft))) return;
  list.push(draft);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Revisão determinística do documento.
 * Não grava, não chama IA e não produz nota de experiência.
 */
export function evaluateLandingPageExperience(
  document: LandingPageDocumentV1,
  options: { media?: ExperienceMediaInput[]; capabilities?: ExperienceCapabilities } = {},
): ExperienceFindingV1[] {
  const capabilities = options.capabilities ?? EXPERIENCE_CAPABILITIES_V1;
  const media = options.media ?? [];
  const mediaById = new Map(media.map((item) => [item.id, item]));
  const drafts: DraftFinding[] = [];
  const enabled = document.sections.filter((section) => section.enabled);
  const proofs = document.strategy?.copyFacts?.trustProofs ?? [];

  if (!enabled.some((section) => section.type === "HERO")) {
    push(drafts, {
      code: "HERO_MISSING",
      category: "HIERARCHY",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A página não tem uma seção de abertura.",
      recommendation: "Inclua uma abertura com a oferta e a ação principal.",
      actionCode: "REVIEW_COPY",
    });
  }

  for (const section of enabled) {
    const status = section.contentStatus ?? "PLACEHOLDER";
    const core = (CORE_TYPES as readonly string[]).includes(section.type);
    if (core && status === "PLACEHOLDER") {
      push(drafts, {
        code: "CORE_PLACEHOLDER",
        category: "CONTENT",
        severity: "BLOCKER",
        scope: "SECTION",
        sectionId: section.id,
        message: "Esta seção ainda possui conteúdo provisório.",
        recommendation: "Escreva e aprove o texto desta seção antes de seguir.",
        actionCode: "REVIEW_COPY",
      });
    } else if (core && status === "DRAFT") {
      push(drafts, {
        code: "CORE_DRAFT",
        category: "CONTENT",
        severity: "ATTENTION",
        scope: "SECTION",
        sectionId: section.id,
        message: "Este texto ainda está em revisão.",
        recommendation: "Releia o texto e aprove quando ele representar a oferta.",
        actionCode: "REVIEW_COPY",
      });
    } else if (!core && status === "PLACEHOLDER" && section.type !== "FOOTER") {
      push(drafts, {
        code: "OPTIONAL_PLACEHOLDER",
        category: "CONTENT",
        severity: "ATTENTION",
        scope: "SECTION",
        sectionId: section.id,
        message: "Uma seção opcional ainda está com conteúdo provisório.",
        recommendation: "Complete o texto ou retire a seção se ela não for necessária.",
        actionCode: "REVIEW_COPY",
      });
    }

    if (section.type === "HERO") {
      if (textOf(section.content.headline).length > HEADLINE_ATTENTION) {
        push(drafts, {
          code: "HEADLINE_LONG",
          category: "READABILITY",
          severity: "ATTENTION",
          scope: "SECTION",
          sectionId: section.id,
          message: "O título de abertura está longo para ler com conforto.",
          recommendation: "Encurte o título para a ideia principal da oferta.",
          actionCode: "REVIEW_COPY",
        });
      }
      if (section.content.primaryCta) noteAction(drafts, section.id, section.content.primaryCta);
      if (section.variant === "split") {
        for (const viewport of ["MOBILE_SMALL", "MOBILE"] as const) {
          push(drafts, {
            code: "HERO_SPLIT_MOBILE_DENSITY",
            category: "RESPONSIVE",
            severity: "INFO",
            scope: "SECTION",
            sectionId: section.id,
            viewport,
            message: "A abertura em duas colunas empilha no celular.",
            recommendation: "Confira se o título e a ação continuam fáceis de ler nessa largura.",
            actionCode: "REVIEW_THEME",
          });
        }
      }
      if (section.variant === "split" && section.content.mediaRef) {
        noteMedia(drafts, section.id, section.content.mediaRef.mediaId, section.content.mediaRef.altText, section.content.mediaRef.decorative, mediaById, "HERO_MEDIA_MISSING");
      } else if (section.content.mediaRef) {
        noteMedia(drafts, section.id, section.content.mediaRef.mediaId, section.content.mediaRef.altText, section.content.mediaRef.decorative, mediaById, "MEDIA_MISSING");
      }
    }

    if (section.type === "CTA") {
      noteAction(drafts, section.id, section.content.action);
    }
    if (section.type === "FAQ") {
      for (const item of section.content.items) {
        if (item.answer.length > FAQ_ANSWER_ATTENTION) {
          push(drafts, {
            code: "FAQ_ANSWER_LONG",
            category: "READABILITY",
            severity: "ATTENTION",
            scope: "SECTION",
            sectionId: section.id,
            message: "Uma resposta da seção de perguntas está longa.",
            recommendation: "Quebre a resposta em uma frase direta e um detalhe curto.",
            actionCode: "REVIEW_COPY",
          });
          break;
        }
      }
    }
    if (section.type === "FORM") {
      if (section.content.fields.length >= 4) {
        push(drafts, {
          code: "FORM_MANY_FIELDS",
          category: "FORM",
          severity: "ATTENTION",
          scope: "SECTION",
          sectionId: section.id,
          message: "O formulário pede muitos campos.",
          recommendation: "Deixe só o que é necessário para o próximo passo.",
          actionCode: "REVIEW_FORM",
        });
      }
      if (section.content.consentEnabled && !textOf(section.content.consentText)) {
        push(drafts, {
          code: "FORM_CONSENT_TEXT",
          category: "FORM",
          severity: "ATTENTION",
          scope: "SECTION",
          sectionId: section.id,
          message: "O consentimento do formulário está sem texto.",
          recommendation: "Escreva o que a pessoa autoriza ao enviar.",
          actionCode: "REVIEW_FORM",
        });
      }
      if (!capabilities.formsFunctional) {
        push(drafts, {
          code: "FORM_PLATFORM_UNAVAILABLE",
          category: "FORM",
          severity: "INFO",
          scope: "SECTION",
          sectionId: section.id,
          message: "O envio real será configurado em uma etapa posterior.",
          recommendation: "Revise rótulos, quantidade de campos e o texto de consentimento. O envio ainda não funciona.",
          actionCode: "REVIEW_FORM",
          platformLimitation: true,
        });
      }
    }
    if (section.type === "TRUST" || section.type === "TESTIMONIALS") {
      for (const proofId of section.content.proofRefs ?? []) {
        const proof = proofs.find((item) => item.id === proofId);
        if (!proof || proof.status !== "READY_FOR_DISPLAY" || (proof.type === "TESTIMONIAL" && !trustProofReady(proof))) {
          push(drafts, {
            code: proof?.type === "TESTIMONIAL" && proof.consentConfirmed !== true ? "TESTIMONIAL_WITHOUT_CONSENT" : "TRUST_REF_INVALID",
            category: "CONTENT",
            severity: "BLOCKER",
            scope: "SECTION",
            sectionId: section.id,
            message: proof?.type === "TESTIMONIAL" && proof.consentConfirmed !== true
              ? "Há um depoimento sem autorização confirmada ligado à página."
              : "Há uma prova ligada à página que não está pronta para uso.",
            recommendation: "Mostre só provas reais e, no depoimento, confirme a autorização.",
            actionCode: "REVIEW_TRUST",
          });
        }
      }
    }
    if (section.type === "PORTFOLIO") {
      for (const item of section.content.items) {
        noteMedia(drafts, section.id, item.mediaRef.mediaId, item.mediaRef.altText, item.mediaRef.decorative, mediaById, "MEDIA_MISSING");
      }
    }
    if (section.type === "FOOTER" && section.content.mediaRef) {
      noteMedia(drafts, section.id, section.content.mediaRef.mediaId, section.content.mediaRef.altText, section.content.mediaRef.decorative, mediaById, "MEDIA_MISSING");
    }
    if (section.type === "FOOTER") {
      for (const link of section.content.links) noteAction(drafts, section.id, link.action);
    }
  }

  const briefAction = document.strategy?.brief?.primaryAction;
  if (briefAction?.type === "WHATSAPP" && !sanitizeWhatsAppPhone(briefAction.phone ?? "")) {
    push(drafts, {
      code: "ACTION_TARGET_MISSING",
      category: "ACTION",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A ação de WhatsApp ainda não tem um número utilizável.",
      recommendation: "Informe o número que realmente recebe a conversa.",
      actionCode: "CONFIGURE_ACTION",
    });
  }
  if (briefAction?.type === "FORM" && !enabled.some((section) => section.type === "FORM")) {
    push(drafts, {
      code: "ACTION_FORM_SECTION_MISSING",
      category: "ACTION",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A ação principal aponta para um formulário que não está na página.",
      recommendation: "Inclua a seção de formulário ou escolha outra ação.",
      actionCode: "CONFIGURE_ACTION",
    });
  }
  if (briefAction?.type === "EXTERNAL_URL" && !briefAction.url) {
    push(drafts, {
      code: "ACTION_TARGET_MISSING",
      category: "ACTION",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A ação principal ainda não tem um endereço de destino.",
      recommendation: "Informe o link que a pessoa deve abrir.",
      actionCode: "CONFIGURE_ACTION",
    });
  }
  if (briefAction?.type === "INTERNAL_ROUTE" && !briefAction.path) {
    push(drafts, {
      code: "ACTION_TARGET_MISSING",
      category: "ACTION",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A ação principal ainda não tem um caminho interno.",
      recommendation: "Escolha a rota que a pessoa deve seguir.",
      actionCode: "CONFIGURE_ACTION",
    });
  }

  const hasAction = Boolean(document.conversion.primaryAction) || enabled.some((section) => section.type === "HERO" && section.content.primaryCta) || enabled.some((section) => section.type === "CTA");
  if (!hasAction) {
    push(drafts, {
      code: "ACTION_MISSING",
      category: "ACTION",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A página ainda não tem um caminho de ação.",
      recommendation: "Defina o que a pessoa deve fazer em seguida.",
      actionCode: "CONFIGURE_ACTION",
    });
  }

  let sinceAction = 0;
  let sawGap = false;
  for (const section of enabled) {
    const carries = section.type === "CTA" || section.type === "FORM" || (section.type === "HERO" && Boolean(section.content.primaryCta));
    if (carries) sinceAction = 0;
    else sinceAction += 1;
    if (sinceAction >= ACTION_GAP && !sawGap) {
      sawGap = true;
      push(drafts, {
        code: "ACTION_GAP",
        category: "ACTION",
        severity: "ATTENTION",
        scope: "PAGE",
        message: "Há um trecho longo sem uma ação visível.",
        recommendation: "Confira se a pessoa ainda encontra o próximo passo depois desse trecho.",
        actionCode: "CONFIGURE_ACTION",
      });
    }
  }
  if (enabled.filter((section) => section.type === "CTA").length > MANY_CTA) {
    push(drafts, {
      code: "CTA_FREQUENCY",
      category: "ACTION",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "Há várias seções só de chamada para ação.",
      recommendation: "Mantenha a ação principal clara e reduza repetições.",
      actionCode: "REVIEW_COPY",
    });
  }
  if (enabled.length > MANY_SECTIONS) {
    push(drafts, {
      code: "SECTION_DENSITY",
      category: "HIERARCHY",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "A página tem muitas seções em sequência.",
      recommendation: "Revise se cada seção ajuda a decisão ou se alguma pode sair.",
      actionCode: "REVIEW_THEME",
    });
  }

  const contrast = assessThemeContrast(document.theme);
  if (contrast.blocked.length > 0) {
    push(drafts, {
      code: "CONTRAST_BLOCKER",
      category: "ACCESSIBILITY",
      severity: "BLOCKER",
      scope: "PAGE",
      message: "A combinação de cores deixa um texto difícil de ler.",
      recommendation: "Ajuste o tema até o contraste principal ficar legível.",
      actionCode: "REVIEW_THEME",
    });
  } else if (contrast.warnings.length > 0) {
    push(drafts, {
      code: "CONTRAST_ATTENTION",
      category: "ACCESSIBILITY",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "Há um contraste que merece uma olhada.",
      recommendation: "Confira as cores de texto e de fundo no tema.",
      actionCode: "REVIEW_THEME",
    });
  }
  const hierarchy = evaluateVisualHierarchy(document.theme, enabled);
  if (hierarchy.includes("TOO_MANY_FEATURED_SECTIONS")) {
    push(drafts, {
      code: "FEATURED_DENSITY",
      category: "HIERARCHY",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "Muitas seções estão com destaque ao mesmo tempo.",
      recommendation: "Deixe o destaque para o que a pessoa precisa ver primeiro.",
      actionCode: "REVIEW_THEME",
    });
  }
  if (hierarchy.includes("PRIMARY_USED_AS_BACKGROUND_TOO_OFTEN")) {
    push(drafts, {
      code: "PRIMARY_BACKGROUND_RUN",
      category: "HIERARCHY",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "Várias seções seguidas usam o fundo de destaque.",
      recommendation: "Alterne o fundo para a leitura não cansar.",
      actionCode: "REVIEW_THEME",
    });
  }

  const referenced = collectReferencedMedia(enabled);
  const large = referenced.filter((id) => (mediaById.get(id)?.fileSize ?? 0) > LARGE_IMAGE_BYTES);
  if (large.length > 0) {
    push(drafts, {
      code: "MEDIA_LARGE",
      category: "PERFORMANCE_PERCEIVED",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "Há imagem acima de 5 MB ligada à página.",
      recommendation: "Use uma imagem mais leve para a página abrir com menos espera.",
      actionCode: "REVIEW_MEDIA",
    });
  }
  if (referenced.length > MANY_IMAGES) {
    push(drafts, {
      code: "MEDIA_COUNT",
      category: "PERFORMANCE_PERCEIVED",
      severity: "ATTENTION",
      scope: "PAGE",
      message: "A página liga muitas imagens.",
      recommendation: "Mostre só as imagens que ajudam a entender o trabalho.",
      actionCode: "REVIEW_MEDIA",
    });
  }

  const rank: Record<ExperienceSeverity, number> = { BLOCKER: 0, ATTENTION: 1, INFO: 2 };
  return drafts
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.code.localeCompare(b.code))
    .map((draft) => ({
      id: findingId(draft),
      code: draft.code,
      category: draft.category,
      severity: draft.severity,
      scope: draft.scope,
      ...(draft.sectionId ? { sectionId: draft.sectionId } : {}),
      ...(draft.viewport ? { viewport: draft.viewport } : {}),
      message: draft.message,
      recommendation: draft.recommendation,
      source: "SYSTEM" as const,
      status: "OPEN" as const,
      ...(draft.actionCode ? { actionCode: draft.actionCode } : {}),
      ...(draft.platformLimitation ? { platformLimitation: true } : {}),
    }));
}

function noteAction(list: DraftFinding[], sectionId: string, action: LandingPageAction) {
  const resolved = resolveLandingPageAction(action);
  if (!resolved || !resolved.label.trim()) {
    push(list, {
      code: "EMPTY_ACTION_LABEL",
      category: "NAVIGATION",
      severity: "BLOCKER",
      scope: "SECTION",
      sectionId,
      message: "Há uma ação sem texto visível.",
      recommendation: "Escreva o que o botão ou o link pede para a pessoa fazer.",
      actionCode: "CONFIGURE_ACTION",
    });
    return;
  }
  if (resolved.label.length > ACTION_LABEL_ATTENTION) {
    push(list, {
      code: "ACTION_LABEL_LONG",
      category: "READABILITY",
      severity: "ATTENTION",
      scope: "SECTION",
      sectionId,
      message: "O texto de uma ação está longo.",
      recommendation: "Use um rótulo curto para o próximo passo.",
      actionCode: "REVIEW_COPY",
    });
  }
}

function noteMedia(
  list: DraftFinding[],
  sectionId: string,
  mediaId: string,
  altText: string | undefined,
  decorative: boolean | undefined,
  mediaById: Map<string, ExperienceMediaInput>,
  missingCode: "MEDIA_MISSING" | "HERO_MEDIA_MISSING",
) {
  const row = mediaById.get(mediaId);
  if (!row || row.status === "FAILED" || row.status === "DELETED") {
    push(list, {
      code: missingCode,
      category: "MEDIA",
      severity: "ATTENTION",
      scope: "SECTION",
      sectionId,
      message: missingCode === "HERO_MEDIA_MISSING"
        ? "A imagem da abertura não está disponível."
        : "Uma imagem ligada à página não está disponível.",
      recommendation: "Envie a imagem de novo ou retire a referência.",
      actionCode: "REVIEW_MEDIA",
    });
    return;
  }
  if (decorative !== true && !textOf(altText) && !textOf(row.altText)) {
    push(list, {
      code: "MEDIA_ALT_MISSING",
      category: "ACCESSIBILITY",
      severity: "ATTENTION",
      scope: "SECTION",
      sectionId,
      message: "Uma imagem informativa está sem descrição curta.",
      recommendation: "Descreva a imagem em uma frase ou marque como decorativa se ela não informa.",
      actionCode: "REVIEW_MEDIA",
    });
  }
}

function collectReferencedMedia(sections: LandingPageDocumentV1["sections"]): string[] {
  const ids: string[] = [];
  for (const section of sections) {
    if (!section.enabled) continue;
    if ((section.type === "HERO" || section.type === "FOOTER") && section.content.mediaRef) ids.push(section.content.mediaRef.mediaId);
    if (section.type === "PORTFOLIO") {
      for (const item of section.content.items) ids.push(item.mediaRef.mediaId);
    }
  }
  return [...new Set(ids)];
}

export function experienceFindingCodes(findings: ExperienceFindingV1[]): string[] {
  return [...new Set(findings.map((finding) => finding.code))];
}
