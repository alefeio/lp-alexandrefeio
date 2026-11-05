import { blogReadingIngestEnabled, BLOG_READING_ABUSE_LIMIT, BLOG_READING_ABUSE_NAMESPACE, BLOG_READING_RATE_LIMIT, BLOG_READING_RATE_NAMESPACE, BLOG_READING_RATE_WINDOW_SECONDS } from "@/lib/blog/reading/constants";
import { handleBlogReadingRequest } from "@/lib/blog/reading/ingest";
import { createPrismaBlogReadingStore, findPublishedBlogPost } from "@/lib/blog/reading/repository";
import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";
import { clientAddressLabel, landingPageAbuseKey } from "@/lib/landing-page/rate-limit/abuse-key";
import { landingPageRateLimitSecret } from "@/lib/landing-page/rate-limit/secret";

export const dynamic = "force-dynamic";

const limiter = bindDurableRateLimit();
const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function POST(request: Request) {
  if (!blogReadingIngestEnabled()) return Response.json({ ok: false }, { status: 404, headers: NO_STORE });
  const secret = landingPageRateLimitSecret();
  if (!secret) return Response.json({ ok: false }, { status: 503, headers: NO_STORE });
  const now = Date.now();
  const abuseKey = landingPageAbuseKey({
    secret,
    address: clientAddressLabel(request.headers),
    namespace: BLOG_READING_ABUSE_NAMESPACE,
    now,
    windowSeconds: BLOG_READING_RATE_WINDOW_SECONDS,
  });
  return handleBlogReadingRequest(request, {
    enabled: true,
    now,
    findPublished: findPublishedBlogPost,
    store: createPrismaBlogReadingStore(),
    consumeAbuse: (at) =>
      limiter.consume({
        namespace: BLOG_READING_ABUSE_NAMESPACE,
        key: abuseKey,
        limit: BLOG_READING_ABUSE_LIMIT,
        windowSeconds: BLOG_READING_RATE_WINDOW_SECONDS,
        now: at,
      }),
    consumeIdentity: (anonymousId, at) =>
      limiter.consume({
        namespace: BLOG_READING_RATE_NAMESPACE,
        key: anonymousId,
        limit: BLOG_READING_RATE_LIMIT,
        windowSeconds: BLOG_READING_RATE_WINDOW_SECONDS,
        now: at,
      }),
  }).catch(() => Response.json({ ok: false }, { status: 500, headers: NO_STORE }));
}
