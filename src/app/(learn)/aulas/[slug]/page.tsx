import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, navigationLinkClass } from "@/lib/button-styles";
import { notFound } from "next/navigation";
import { ViewEvent } from "@/components/analytics/ViewEvent";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { LessonPaywall } from "@/components/learning/LessonPaywall";
import { LessonReader } from "@/components/learning/LessonReader";
import { LessonStepNav } from "@/components/learning/LessonStepNav";
import { lessonStepNav, nextLessonContinuationLabel, visibleNeighborAccess } from "@/lib/learning/lesson-nav";
import { loadOwnedLessonIds } from "@/lib/commerce/catalog";
import { PublicLessonArticle } from "@/components/learning/PublicLessonArticle";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { getSession } from "@/lib/auth/session";
import { hasActiveEntitlement } from "@/lib/commerce/access";
import { isCommerceEnabled, isProductForSale } from "@/lib/commerce/config";
import { canIndexLesson, canReadLessonBody, lessonGateKind } from "@/lib/learning/access";
import { adjacentLessons, getPublicLesson, getReaderSnapshot, loadLessonBlocks, type PublicLesson } from "@/lib/learning/catalog";
import { formatPriceCents } from "@/lib/learning/money";
import type { LessonSnapshot } from "@/lib/learning/reader-types";
import { loadCampaignBriefPanel } from "@/lib/learning/brief";
import { loadConversionJourneyPanel } from "@/lib/learning/conversion-journey";
import { loadDigitalPresencePanel } from "@/lib/learning/digital-presence";
import { loadPageReadinessPanel } from "@/lib/learning/page-readiness";
import { loadConversionBriefPanel } from "@/lib/learning/conversion-page-brief";
import { loadVisitorDecisionPanel } from "@/lib/learning/visitor-decision";
import { loadWireframePanel } from "@/lib/learning/landing-page-wireframe";
import { loadCopyPanel } from "@/lib/learning/landing-page-copy";
import { loadVisualPanel } from "@/lib/learning/landing-page-visual";
import { loadTrustPanel } from "@/lib/learning/landing-page-trust";
import { loadExperiencePanel } from "@/lib/learning/landing-page-experience";
import { loadMeasurementPanel } from "@/lib/learning/landing-page-measurement";
import { loadPublicationPanel } from "@/lib/learning/landing-page-publication";
import { loadDestinationPlanPanel } from "@/lib/learning/measurement";
import { loadKeywordIntentPanel } from "@/lib/learning/keyword-plan";
import { loadLeadConversionPanel } from "@/lib/learning/lead-conversion-plan";
import { loadCampaignDiagnosisPanel } from "@/lib/learning/campaign-diagnosis-plan";
import { loadCampaignNextActionPanel } from "@/lib/learning/campaign-next-action-plan";
import { loadMetaCampaignPanel } from "@/lib/learning/meta-campaign-plan";
import { loadResponsiveAdPanel } from "@/lib/learning/responsive-ad-plan";
import { loadSearchBlueprintPanel } from "@/lib/learning/search-campaign";
import { loadTrafficToolPanel } from "@/lib/learning/tool";
import { breadcrumbList, lessonJsonLd } from "@/lib/seo/learning-jsonld";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ continuar?: string }>;
};

function metaDescription(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157).trimEnd()}…`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicLesson(slug);
  if (!page) return { robots: { index: false, follow: false } };
  const indexable = canIndexLesson(page.lesson, page.hasBody, page.hasPublicPreview);
  const description = metaDescription(page.lesson.summary);
  const path = `/aulas/${page.lesson.slug}`;
  return {
    title: page.lesson.title,
    description,
    alternates: indexable ? { canonical: path } : undefined,
    openGraph: indexable ? { title: page.lesson.title, description, url: path, type: "article" } : undefined,
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function LessonPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const page = await getPublicLesson(slug);
  if (!page) notFound();

  const session = await getSession();
  const entitled = Boolean(session && page.lesson.accessType === "PAID" && (await hasActiveEntitlement(session.user.id, page.lesson.id)));
  const allowed = canReadLessonBody(page.lesson, { entitled });
  const indexable = canIndexLesson(page.lesson, page.hasBody, page.hasPublicPreview);

  if (allowed) {
    const blocks = await loadLessonBlocks(page.lesson.id, "full");
    if (blocks.length === 0) return <LessonGate lesson={page.lesson} hasBody={false} entitled={entitled} />;
    return (
      <FullLesson
        lesson={page.lesson}
        blocks={blocks}
        userId={session?.user.id ?? null}
        authenticated={Boolean(session)}
        resume={query.continuar === "1"}
        indexable={indexable}
      />
    );
  }

  if (page.hasPublicPreview && page.blocks.length > 0) {
    const neighbors = await lessonContext(page.lesson.courseSlug, page.lesson.slug, session?.user.id ?? null);
    const description = metaDescription(page.lesson.summary);
    const path = `/aulas/${page.lesson.slug}`;
    const commerce = isCommerceEnabled();
    return (
      <Container className="max-w-3xl py-12 sm:py-16">
        <ViewEvent event="lesson_public_preview_view" slug={page.lesson.slug} courseSlug={page.lesson.courseSlug} lessonSlug={page.lesson.slug} />
        {indexable ? (
          <>
            <JsonLd
              data={breadcrumbList([
                { name: "Home", path: "/" },
                { name: page.lesson.courseTitle, path: `/cursos/${page.lesson.courseSlug}` },
                { name: page.lesson.title, path },
              ])}
            />
            <JsonLd
              data={lessonJsonLd({
                title: page.lesson.title,
                description,
                path,
                publishedAt: page.lesson.publishedAt,
                updatedAt: page.lesson.updatedAt,
                free: false,
                paywall: true,
              })}
            />
          </>
        ) : null}
        <LessonChrome lesson={page.lesson} paid place={neighbors.place} />
        <PublicLessonArticle blocks={page.blocks} />
        <LessonPaywall
          lessonId={page.lesson.id}
          lessonSlug={page.lesson.slug}
          courseSlug={page.lesson.courseSlug}
          courseTitle={page.lesson.courseTitle}
          moduleTitle={page.lesson.moduleTitle}
          lessonPriceCents={page.lesson.priceCents}
          modulePriceCents={page.lesson.modulePriceCents}
          coursePriceCents={page.lesson.coursePriceCents}
          lessonForSale={isProductForSale(page.lesson.commerceStatus, page.lesson.priceCents, commerce)}
          moduleForSale={isProductForSale(page.lesson.moduleCommerceStatus, page.lesson.modulePriceCents, commerce)}
          courseForSale={isProductForSale(page.lesson.courseCommerceStatus, page.lesson.coursePriceCents, commerce)}
          moduleId={page.lesson.moduleId}
          courseId={page.lesson.courseId}
        />
        <LessonNeighbors courseSlug={page.lesson.courseSlug} courseTitle={page.lesson.courseTitle} previous={neighbors.previous} next={neighbors.next} tone="text" />
      </Container>
    );
  }

  return <LessonGate lesson={page.lesson} hasBody={page.hasBody} entitled={entitled} />;
}

async function FullLesson({
  lesson,
  blocks,
  userId,
  authenticated,
  resume,
  indexable,
}: {
  lesson: PublicLesson;
  blocks: Awaited<ReturnType<typeof loadLessonBlocks>>;
  userId: string | null;
  authenticated: boolean;
  resume: boolean;
  indexable: boolean;
}) {
  const reader = userId ? await getReaderSnapshot(userId, lesson.id) : null;
  const initial: LessonSnapshot = reader?.snapshot ?? emptySnapshot();
  const tool = blocks.find((block) => block.data.type === "TOOL");
  const toolKey = tool?.data.type === "TOOL" ? tool.data.toolKey : null;
  const toolPanel =
    toolKey === "CONVERSION_JOURNEY_MAP_V1"
      ? await loadConversionJourneyPanel({ userId, blocks })
      : toolKey === "DIGITAL_PRESENCE_DECISION_V1"
        ? await loadDigitalPresencePanel({ userId, blocks })
        : toolKey === "CONVERSION_PAGE_READINESS_V1"
          ? await loadPageReadinessPanel({ userId, blocks })
          : toolKey === "CONVERSION_PAGE_BRIEF_V1"
            ? await loadConversionBriefPanel({ userId, blocks })
            : toolKey === "VISITOR_DECISION_JOURNEY_V1"
              ? await loadVisitorDecisionPanel({ userId, blocks })
              : toolKey === "LANDING_PAGE_WIREFRAME_V1"
                ? await loadWireframePanel({ userId, blocks })
                : toolKey === "LANDING_PAGE_COPY_ASSIST_V1"
                  ? await loadCopyPanel({ userId, blocks })
                  : toolKey === "LANDING_PAGE_VISUAL_DIRECTION_V1"
                    ? await loadVisualPanel({ userId, blocks })
                    : toolKey === "LANDING_PAGE_TRUST_V1"
                      ? await loadTrustPanel({ userId, blocks })
                      : toolKey === "LANDING_PAGE_EXPERIENCE_REVIEW_V1"
                        ? await loadExperiencePanel({ userId, blocks })
                        : toolKey === "LANDING_PAGE_MEASUREMENT_PLAN_V1"
                          ? await loadMeasurementPanel({ userId, blocks })
                          : toolKey === "LANDING_PAGE_PUBLICATION_V1"
                            ? await loadPublicationPanel({ userId, blocks })
          : toolKey === "CAMPAIGN_BRIEF_V1"
          ? await loadCampaignBriefPanel({ userId, blocks })
          : toolKey === "DESTINATION_MEASUREMENT_PLAN_V1"
            ? await loadDestinationPlanPanel({ userId, blocks })
            : toolKey === "SEARCH_CAMPAIGN_BLUEPRINT_V1"
              ? await loadSearchBlueprintPanel({ userId, blocks })
              : toolKey === "KEYWORD_INTENT_PLAN_V1"
                ? await loadKeywordIntentPanel({ userId, blocks })
                : toolKey === "RESPONSIVE_SEARCH_AD_PLAN_V1"
                  ? await loadResponsiveAdPanel({ userId, blocks })
                  : toolKey === "META_CAMPAIGN_BLUEPRINT_V1"
                    ? await loadMetaCampaignPanel({ userId, blocks })
                    : toolKey === "META_LEAD_CONVERSION_PLAN_V1"
                      ? await loadLeadConversionPanel({ userId, blocks })
                      : toolKey === "CAMPAIGN_PERFORMANCE_DIAGNOSIS_V1"
                        ? await loadCampaignDiagnosisPanel({ userId, blocks })
                        : toolKey === "CAMPAIGN_NEXT_ACTION_PLAN_V1"
                          ? await loadCampaignNextActionPanel({ userId, blocks })
                          : await loadTrafficToolPanel({ userId, blocks });
  const neighbors = await lessonContext(lesson.courseSlug, lesson.slug, userId);
  const path = `/aulas/${lesson.slug}`;
  const description = metaDescription(lesson.summary);

  return (
    <>
      {indexable ? (
        <>
          <JsonLd
            data={breadcrumbList([
              { name: "Home", path: "/" },
              { name: lesson.courseTitle, path: `/cursos/${lesson.courseSlug}` },
              { name: lesson.title, path },
            ])}
          />
          <JsonLd
            data={lessonJsonLd({
              title: lesson.title,
              description,
              path,
              publishedAt: lesson.publishedAt,
              updatedAt: lesson.updatedAt,
              free: lesson.accessType === "FREE",
              paywall: false,
            })}
          />
        </>
      ) : null}
      <Container className="max-w-6xl px-5 pt-10 sm:px-8">
        <LessonTrail lesson={lesson} />
        <LessonPlace courseTitle={lesson.courseTitle} moduleTitle={lesson.moduleTitle} place={neighbors.place} />
        <p className="mt-4 text-sm">
          Conteúdo por <Link className="underline underline-offset-4" href="/#sobre">Alexandre Feio</Link>. Aula gratuita.
        </p>
      </Container>
      <LessonReader
        lesson={{
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary,
          estimatedMinutes: lesson.estimatedMinutes,
          accessType: lesson.accessType,
          courseSlug: lesson.courseSlug,
          courseTitle: lesson.courseTitle,
          moduleTitle: lesson.moduleTitle,
        }}
        blocks={blocks}
        initial={initial}
        initialFeedback={reader?.checkpointFeedback ?? {}}
        authenticated={authenticated}
        resume={resume}
        toolPanel={toolPanel}
      />
      <Container className="max-w-3xl pb-16">
        <LessonNeighbors courseSlug={lesson.courseSlug} courseTitle={lesson.courseTitle} previous={neighbors.previous} next={neighbors.next} />
      </Container>
    </>
  );
}

async function lessonContext(courseSlug: string, lessonSlug: string, userId: string | null) {
  const neighbors = await adjacentLessons(courseSlug, lessonSlug);
  const owned = userId ? await loadOwnedLessonIds(userId) : [];
  return {
    previous: presentNeighbor(neighbors.previous, owned),
    next: presentNeighbor(neighbors.next, owned),
    place: neighbors.place,
  };
}

function presentNeighbor(
  neighbor: { slug: string; title: string; lessonId: string; access: "open" | "preview" } | null,
  owned: readonly string[],
) {
  if (!neighbor) return null;
  return {
    slug: neighbor.slug,
    title: neighbor.title,
    access: visibleNeighborAccess(neighbor.access, neighbor.lessonId, owned),
  };
}

function LessonTrail({ lesson }: { lesson: PublicLesson }) {
  return (
    <nav aria-label="Trilha" className="text-sm text-muted">
      <ol className="flex flex-wrap gap-x-2 gap-y-1">
        <li>
          <Link className="underline underline-offset-4" href="/">
            Home
          </Link>
        </li>
        <li aria-hidden="true">→</li>
        <li>
          <Link className="underline underline-offset-4" href={`/cursos/${lesson.courseSlug}`}>
            {lesson.courseTitle}
          </Link>
        </li>
        <li aria-hidden="true">→</li>
        <li className="text-foreground">{lesson.title}</li>
      </ol>
    </nav>
  );
}

function LessonPlace({
  courseTitle,
  moduleTitle,
  place,
}: {
  courseTitle: string;
  moduleTitle: string;
  place: { number: number; total: number } | null;
}) {
  return (
    <p className="mt-4 text-sm leading-relaxed text-foreground">
      <span className="font-medium">{courseTitle}</span>
      <span className="text-muted"> · {moduleTitle}</span>
      {place ? <span className="text-muted"> · Aula {place.number} de {place.total}</span> : null}
    </p>
  );
}

function LessonChrome({
  lesson,
  paid,
  place,
}: {
  lesson: PublicLesson;
  paid: boolean;
  place: { number: number; total: number } | null;
}) {
  return (
    <>
      <LessonTrail lesson={lesson} />
      <LessonPlace courseTitle={lesson.courseTitle} moduleTitle={lesson.moduleTitle} place={place} />
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.16em] text-cta">{lesson.moduleTitle}</p>
      <h1 className="mt-3 text-[1.85rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl">{lesson.title}</h1>
      <p className="mt-4 text-base leading-relaxed">{lesson.summary}</p>
      <p className="mt-3 text-sm text-muted">
        {lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min` : "Leitura"}
        {paid ? " · Aula paga" : " · Aula gratuita"}
      </p>
      <p className="mt-3 text-sm">
        Conteúdo por <Link className="underline underline-offset-4" href="/#sobre">Alexandre Feio</Link>.
      </p>
    </>
  );
}

function LessonNeighbors({
  courseSlug,
  courseTitle,
  previous,
  next,
  tone = "steps",
}: {
  courseSlug: string;
  courseTitle: string;
  previous: { slug: string; title: string; access?: "open" | "preview" } | null;
  next: { slug: string; title: string; access?: "open" | "preview" } | null;
  /** No paywall, avançar não pode competir com a compra. */
  tone?: "steps" | "text";
}) {
  const freeFunnelEnd = tone === "steps" && courseSlug === "sites-que-convertem" && !next;
  const nextIsPreview = next?.access === "preview";
  const steps = lessonStepNav({ previous, next: nextIsPreview ? null : next });
  return (
    <nav aria-label="Aulas próximas" className="mt-12 text-sm">
      <p>
        <Link className={navigationLinkClass()} href={`/cursos/${courseSlug}`} aria-label={`Voltar ao curso ${courseTitle}`}>
          Voltar ao curso
        </Link>
      </p>
      <p>
        <Link className={navigationLinkClass()} href="/app/aprendizado">
          Voltar aos meus cursos
        </Link>
      </p>
      {freeFunnelEnd ? (
        <aside className="mt-6 rounded-lg border border-border bg-surface px-5 py-4">
          <p className="font-medium">Você concluiu a etapa gratuita.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Agora você já mapeou sua jornada, definiu a estrutura mais adequada e identificou os principais pontos de atenção.
          </p>
          <p className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link className={buttonClass("primary")} href={`/cursos/${courseSlug}`}>
              Ver a formação
            </Link>
            <Link className={navigationLinkClass()} href="/cursos">
              Explorar outros cursos
            </Link>
          </p>
        </aside>
      ) : null}
      {tone === "text" ? (
        <div className="mt-4 flex flex-col">
          {steps.previous ? (
            <Link className={navigationLinkClass()} href={steps.previous.href}>
              {steps.previous.kicker}: {steps.previous.title}
            </Link>
          ) : null}
          {next ? (
            <Link className={navigationLinkClass()} href={`/aulas/${next.slug}`}>
              {nextLessonContinuationLabel(next.access ?? "open")}: {next.title}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <LessonStepNav previous={previous} next={nextIsPreview ? null : next} />
          {nextIsPreview && next ? (
            <p className="mt-4">
              <Link className={navigationLinkClass()} href={`/aulas/${next.slug}`}>
                {nextLessonContinuationLabel("preview")}: {next.title}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </nav>
  );
}

function LessonGate({
  lesson,
  hasBody,
  entitled,
}: {
  lesson: PublicLesson;
  hasBody: boolean;
  entitled: boolean;
}) {
  const paid = lesson.accessType === "PAID";
  const forSale = paid && isProductForSale(lesson.commerceStatus, lesson.priceCents);
  const gate = lessonGateKind({ accessType: lesson.accessType, entitled, forSale, hasBody });
  return (
    <Container className="max-w-2xl py-16">
      <LessonChrome lesson={lesson} paid={paid} place={null} />
      <p className="mt-8 text-sm leading-relaxed text-muted">
        {forSale && lesson.priceCents != null ? `${formatPriceCents(lesson.priceCents)}. ` : ""}
        {gate === "soon" ? "Disponível em breve." : null}
      </p>
      {gate === "buy" ? <AddToCartButton id={lesson.id} type="LESSON" label="Comprar esta aula" /> : null}
      {gate === "soon" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">A compra não está aberta. O texto da aula não aparece nesta página.</p>
      ) : null}
      {gate === "owned-unavailable" ? <p className="mt-6 text-sm text-muted">Conteúdo temporariamente indisponível.</p> : null}
      {gate === "preparing" ? <p className="mt-6 text-sm text-muted">O texto completo desta aula ainda está em preparação.</p> : null}
    </Container>
  );
}

function emptySnapshot(): LessonSnapshot {
  return {
    percent: 0,
    completed: false,
    lastBlockKey: null,
    viewedBlockKeys: [],
    completedBlockKeys: [],
    responses: {},
    notes: {},
    bookmarks: [],
    result: null,
  };
}
