import { landingPagePublicRouteEnabled } from "@/lib/landing-page/publication/gate";
import { handlePublicLandingForm } from "@/lib/landing-page/publication/http";
import { createPrismaLandingPageLeadStore } from "@/lib/landing-page/leads/prisma-store";
import { createPrismaLandingPageMetricStore } from "@/lib/landing-page/measurement/prisma-store";
import { createPrismaLandingPagePublicationStore } from "@/lib/landing-page/publication/prisma-store";
import { clientAddressLabel, landingPageAbuseKey } from "@/lib/landing-page/rate-limit/abuse-key";
import { LANDING_PAGE_RATE_POLICIES } from "@/lib/landing-page/rate-limit/policies";
import { landingPageRateLimitSecret } from "@/lib/landing-page/rate-limit/secret";
import { consumeLandingPageFormRateLimit } from "@/lib/landing-page/forms/rate-limit";

type RouteContext = { params: Promise<{ slug: string; sectionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  if (!landingPagePublicRouteEnabled()) return new Response(null, { status: 404 });
  const secret = landingPageRateLimitSecret();
  if (!secret) return new Response(null, { status: 503 });
  const params = await context.params;
  const now = Date.now();
  const abuseKey = landingPageAbuseKey({
    secret,
    address: clientAddressLabel(request.headers),
    namespace: LANDING_PAGE_RATE_POLICIES.form.namespace,
    now,
    windowSeconds: LANDING_PAGE_RATE_POLICIES.form.windowSeconds,
  });
  return handlePublicLandingForm(
    {
      publications: createPrismaLandingPagePublicationStore(),
      leads: createPrismaLandingPageLeadStore(),
      metrics: createPrismaLandingPageMetricStore(),
      consumeRateLimit: (_projectId, at, publicationId) =>
        consumeLandingPageFormRateLimit({ publicationId: publicationId ?? "unknown", abuseKey }, at),
    },
    request,
    params,
  );
}
