import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonReader } from "@/components/learning/LessonReader";
import { Container } from "@/components/ui/Container";
import { requireAdmin } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { parseBlockData } from "@/lib/learning/blocks";
import { previewBlocksFor } from "@/lib/editorial/service";
import type { ReaderBlock } from "@/lib/learning/reader-types";
import { campaignBriefPreviewState } from "@/lib/learning/brief";
import { conversionJourneyPreviewState } from "@/lib/learning/conversion-journey";
import { digitalPresencePreviewState } from "@/lib/learning/digital-presence";
import { pageReadinessPreviewState } from "@/lib/learning/page-readiness";
import { conversionBriefPreviewState } from "@/lib/learning/conversion-page-brief";
import { visitorDecisionPreviewState } from "@/lib/learning/visitor-decision";
import { wireframePreviewState } from "@/lib/learning/landing-page-wireframe";
import { copyPreviewState } from "@/lib/learning/landing-page-copy";
import { visualPreviewState } from "@/lib/learning/landing-page-visual";
import { trustPreviewState } from "@/lib/learning/landing-page-trust";
import { experiencePreviewState } from "@/lib/landing-page/experience/lesson-flow";
import { measurementPreviewState } from "@/lib/landing-page/measurement/lesson-flow";
import { publicationPreviewState } from "@/lib/landing-page/publication/lesson-flow";
import { destinationPlanPreviewState } from "@/lib/learning/measurement";
import { keywordIntentPreviewState } from "@/lib/learning/keyword-plan";
import { leadConversionPreviewState } from "@/lib/learning/lead-conversion-plan";
import { campaignDiagnosisPreviewState } from "@/lib/learning/campaign-diagnosis-plan";
import { campaignNextActionPreviewState } from "@/lib/learning/campaign-next-action-plan";
import { metaCampaignPreviewState } from "@/lib/learning/meta-campaign-plan";
import { responsiveAdPreviewState } from "@/lib/learning/responsive-ad-plan";
import { searchBlueprintPreviewState } from "@/lib/learning/search-campaign";
import { trafficToolPreviewState } from "@/lib/learning/tool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pré-visualização",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ tela?: string }> };

export default async function LessonPreviewPage({ params, searchParams }: PageProps) {
  const session = await requireAdmin();
  if (!session) return null;
  const { id } = await params;
  const query = await searchParams;
  const lesson = await getPrisma().lesson.findUnique({
    where: { id },
    include: {
      module: { include: { course: true } },
      blocks: { where: { retiredAt: null }, orderBy: { position: "asc" } },
    },
  });
  if (!lesson) notFound();
  const blocks = previewBlocksFor(
    session.user.role,
    lesson.blocks.flatMap((block) => {
      const data = parseBlockData(block.payload);
      if (!data) return [];
      const reader: ReaderBlock = {
        blockKey: block.blockKey,
        position: block.position,
        countsForProgress: block.countsForProgress,
        required: block.required,
        data,
      };
      return [reader];
    }),
  ) as ReaderBlock[];
  const narrow = query.tela === "320";

  return (
    <div className={narrow ? "mx-auto max-w-[320px]" : undefined}>
      <Container className="max-w-3xl pb-0">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Pré-visualização</p>
        <p className="mt-2 text-sm text-muted">Nada desta tela grava progresso nem dispara analytics.</p>
        <p className="mt-2 text-sm">
          <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}/preview`}>Desktop</Link>
          {" · "}
          <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}/preview?tela=320`}>320px</Link>
          {" · "}
          <Link className="underline underline-offset-4" href={`/admin/aulas/${lesson.id}`}>Voltar ao editor</Link>
        </p>
      </Container>
      <LessonReader
        preview
        lesson={{
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary,
          estimatedMinutes: lesson.estimatedMinutes,
          accessType: lesson.accessType,
          courseSlug: lesson.module.course.slug,
          courseTitle: lesson.module.course.title,
          moduleTitle: lesson.module.title,
        }}
        blocks={blocks}
        initial={{ percent: 0, completed: false, lastBlockKey: null, viewedBlockKeys: [], completedBlockKeys: [], responses: {}, notes: {}, bookmarks: [], result: null }}
        authenticated={false}
        resume={false}
        toolPanel={previewToolPanel(blocks)}
      />
    </div>
  );
}

function previewToolPanel(blocks: ReaderBlock[]) {
  const tool = blocks.find((block) => block.data.type === "TOOL");
  const toolKey = tool?.data.type === "TOOL" ? tool.data.toolKey : null;
  if (toolKey === "CONVERSION_JOURNEY_MAP_V1") return conversionJourneyPreviewState();
  if (toolKey === "DIGITAL_PRESENCE_DECISION_V1") return digitalPresencePreviewState();
  if (toolKey === "CONVERSION_PAGE_READINESS_V1") return pageReadinessPreviewState();
  if (toolKey === "CONVERSION_PAGE_BRIEF_V1") return conversionBriefPreviewState();
  if (toolKey === "VISITOR_DECISION_JOURNEY_V1") return visitorDecisionPreviewState();
  if (toolKey === "LANDING_PAGE_WIREFRAME_V1") return wireframePreviewState();
  if (toolKey === "LANDING_PAGE_COPY_ASSIST_V1") return copyPreviewState();
  if (toolKey === "LANDING_PAGE_VISUAL_DIRECTION_V1") return visualPreviewState();
  if (toolKey === "LANDING_PAGE_TRUST_V1") return trustPreviewState();
  if (toolKey === "LANDING_PAGE_EXPERIENCE_REVIEW_V1") return experiencePreviewState();
  if (toolKey === "LANDING_PAGE_MEASUREMENT_PLAN_V1") return measurementPreviewState();
  if (toolKey === "LANDING_PAGE_PUBLICATION_V1") return publicationPreviewState();
  if (toolKey === "CAMPAIGN_BRIEF_V1") return campaignBriefPreviewState();
  if (toolKey === "DESTINATION_MEASUREMENT_PLAN_V1") return destinationPlanPreviewState();
  if (toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1") return searchBlueprintPreviewState();
  if (toolKey === "KEYWORD_INTENT_PLAN_V1") return keywordIntentPreviewState();
  if (toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1") return responsiveAdPreviewState();
  if (toolKey === "META_CAMPAIGN_BLUEPRINT_V1") return metaCampaignPreviewState();
  if (toolKey === "META_LEAD_CONVERSION_PLAN_V1") return leadConversionPreviewState();
  if (toolKey === "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1") return campaignDiagnosisPreviewState();
  if (toolKey === "CAMPAIGN_NEXT_ACTION_PLAN_V1") return campaignNextActionPreviewState();
  return trafficToolPreviewState();
}
