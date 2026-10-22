import { createHash } from "node:crypto";

export type DurableRateLimitConsume = {
  namespace: string;
  key: string;
  limit: number;
  windowSeconds: number;
  now?: number;
};

export type DurableRateLimitResult = {
  allowed: boolean;
  remaining?: number;
  retryAfterSeconds?: number;
};

/**
 * Um balde por namespace, chave já resumida e janela.
 * Não guarda a requisição, o endereço nem o valor original da chave.
 */
export interface DurableRateLimiter {
  consume(input: DurableRateLimitConsume): Promise<DurableRateLimitResult>;
}

type Bucket = { count: number; expiresAt: number };

export function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function rateLimitWindowBucket(now: number, windowSeconds: number): number {
  return Math.floor(now / (windowSeconds * 1000));
}

export function rateLimitRetryAfterSeconds(now: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  const bucket = rateLimitWindowBucket(now, windowSeconds);
  return Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));
}

export function createMemoryDurableRateLimiter(): DurableRateLimiter & {
  reset(): void;
  snapshot(): Array<{ namespace: string; hashedKey: string; windowBucket: number; count: number }>;
} {
  const rows = new Map<string, Bucket>();
  let chain: Promise<unknown> = Promise.resolve();

  function run<T>(task: () => T): Promise<T> {
    const result = chain.then(task, task);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    reset() {
      rows.clear();
      chain = Promise.resolve();
    },
    snapshot() {
      return [...rows.entries()].map(([id, bucket]) => {
        const [namespace, hashedKey, windowBucket] = id.split("|");
        return { namespace: namespace ?? "", hashedKey: hashedKey ?? "", windowBucket: Number(windowBucket), count: bucket.count };
      });
    },
    consume(input) {
      return run(() => {
        const now = input.now ?? Date.now();
        for (const [id, bucket] of rows) {
          if (bucket.expiresAt <= now) rows.delete(id);
        }
        const windowBucket = rateLimitWindowBucket(now, input.windowSeconds);
        const hashedKey = hashRateLimitKey(input.key);
        const id = `${input.namespace}|${hashedKey}|${windowBucket}`;
        const current = rows.get(id);
        const count = (current?.count ?? 0) + 1;
        rows.set(id, { count, expiresAt: now + input.windowSeconds * 1000 });
        const allowed = count <= input.limit;
        return {
          allowed,
          remaining: Math.max(0, input.limit - count),
          ...(allowed ? {} : { retryAfterSeconds: rateLimitRetryAfterSeconds(now, input.windowSeconds) }),
        };
      });
    },
  };
}
