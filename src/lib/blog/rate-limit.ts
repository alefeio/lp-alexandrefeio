import { bindDurableRateLimit } from "@/lib/landing-page/rate-limit/resolve";

const limiter = bindDurableRateLimit();

export const BLOG_AI_LIMIT = { namespace: "blog-editorial", limit: 20, windowSeconds: 10 * 60 } as const;
export const BLOG_TREND_LIMIT = { namespace: "blog-trend", limit: 10, windowSeconds: 60 * 60 } as const;

export function resetBlogRateLimit(): void {
  limiter.reset();
}

export async function consumeBlogAiRateLimit(userId: string, now = Date.now()): Promise<boolean> {
  const decision = await limiter.consume({ namespace: BLOG_AI_LIMIT.namespace, key: userId, limit: BLOG_AI_LIMIT.limit, windowSeconds: BLOG_AI_LIMIT.windowSeconds, now });
  return decision.allowed;
}

export async function consumeBlogTrendRateLimit(userId: string, now = Date.now()): Promise<boolean> {
  const decision = await limiter.consume({ namespace: BLOG_TREND_LIMIT.namespace, key: userId, limit: BLOG_TREND_LIMIT.limit, windowSeconds: BLOG_TREND_LIMIT.windowSeconds, now });
  return decision.allowed;
}
