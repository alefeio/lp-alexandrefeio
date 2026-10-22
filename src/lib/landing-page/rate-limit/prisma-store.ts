import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import {
  hashRateLimitKey,
  rateLimitRetryAfterSeconds,
  rateLimitWindowBucket,
  type DurableRateLimiter,
} from "@/lib/landing-page/rate-limit/durable";

/**
 * Balde atômico no Postgres. A chave guardada é o resumo, nunca o endereço.
 * Linhas vencidas saem na própria operação, sem cron.
 */
export function createPrismaDurableRateLimiter(): DurableRateLimiter {
  let calls = 0;
  return {
    async consume(input) {
      const now = input.now ?? Date.now();
      const prisma = getPrisma();
      calls += 1;
      if (calls % 25 === 1) {
        await prisma.landingPageRateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
      }
      const windowBucket = rateLimitWindowBucket(now, input.windowSeconds);
      const hashedKey = hashRateLimitKey(input.key);
      const expiresAt = new Date(now + input.windowSeconds * 1000);
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "landing_page_rate_limit_bucket" ("id", "namespace", "hashedKey", "windowBucket", "count", "expiresAt", "createdAt")
        VALUES (${randomUUID()}, ${input.namespace}, ${hashedKey}, ${windowBucket}, 1, ${expiresAt}, ${new Date(now)})
        ON CONFLICT ("namespace", "hashedKey", "windowBucket")
        DO UPDATE SET "count" = "landing_page_rate_limit_bucket"."count" + 1
        RETURNING "count"
      `;
      const count = Number(rows[0]?.count ?? 0);
      const allowed = count > 0 && count <= input.limit;
      return {
        allowed,
        remaining: Math.max(0, input.limit - count),
        ...(allowed ? {} : { retryAfterSeconds: rateLimitRetryAfterSeconds(now, input.windowSeconds) }),
      };
    },
  };
}
