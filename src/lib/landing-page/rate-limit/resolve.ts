import { createMemoryDurableRateLimiter, type DurableRateLimiter, type DurableRateLimitConsume, type DurableRateLimitResult } from "@/lib/landing-page/rate-limit/durable";

let prismaLimiter: DurableRateLimiter | null = null;

async function productionLimiter(): Promise<DurableRateLimiter> {
  if (!prismaLimiter) {
    const loaded = await import("@/lib/landing-page/rate-limit/prisma-store");
    prismaLimiter = loaded.createPrismaDurableRateLimiter();
  }
  return prismaLimiter;
}

/** Cada módulo autenticado ou público tem o próprio balde em memória nos testes. */
export function bindDurableRateLimit() {
  const memory = createMemoryDurableRateLimiter();
  return {
    reset() {
      memory.reset();
    },
    consume(input: DurableRateLimitConsume): Promise<DurableRateLimitResult> {
      if (process.env.UNIT_TEST_ISOLATION === "1") return memory.consume(input);
      return productionLimiter().then((limiter) => limiter.consume(input));
    },
  };
}
