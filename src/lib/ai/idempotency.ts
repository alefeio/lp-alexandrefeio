import { createHash, randomUUID } from "node:crypto";
import { recordAiIdempotencyMetric } from "@/lib/ai/idempotency-metrics";

export const AI_OPERATION_STATUSES = ["IN_PROGRESS", "COMPLETED", "FAILED", "UNKNOWN"] as const;
export type AiOperationStatus = (typeof AI_OPERATION_STATUSES)[number];

/** Lease padrão: 3 minutos. */
export const AI_IDEMPOTENCY_TTL_MS = 180_000;

export class AiIdempotencyOwnershipError extends Error {
  readonly code = "OWNERSHIP_LOST" as const;
  constructor(message = "ai_idempotency_ownership_lost") {
    super(message);
    this.name = "AiIdempotencyOwnershipError";
  }
}

export type AiOperationReservationRecord = {
  id: string;
  userId: string;
  featureKey: string;
  idempotencyKey: string;
  fingerprintHash: string;
  requestId: string;
  /** Fencing token. Reclaim incrementa e invalida a geração anterior. */
  generation: number;
  status: AiOperationStatus;
  providerDispatched: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

export type AiIdempotencyStore = {
  tryInsert(record: AiOperationReservationRecord): Promise<AiOperationReservationRecord | null>;
  findByScope(input: {
    userId: string;
    featureKey: string;
    idempotencyKey: string;
  }): Promise<AiOperationReservationRecord | null>;
  reclaimFailed(input: {
    userId: string;
    featureKey: string;
    idempotencyKey: string;
    fingerprintHash: string;
    requestId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<AiOperationReservationRecord | null>;
  reclaimExpiredUndispatched(input: {
    userId: string;
    featureKey: string;
    idempotencyKey: string;
    fingerprintHash: string;
    requestId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<AiOperationReservationRecord | null>;
  /**
   * Condicional: id + generation + IN_PROGRESS + ainda não despachado + lease vigente (`expiresAt > now`).
   * Lease expirado não autoriza iniciar chamada ao provedor.
   * Zero linhas = perda de propriedade (nunca sucesso).
   */
  markProviderDispatched(input: {
    id: string;
    generation: number;
    now: Date;
  }): Promise<AiOperationReservationRecord | null>;
  /**
   * Condicional: id + generation + IN_PROGRESS.
   * Zero linhas = perda de propriedade (nunca sucesso).
   */
  markStatus(input: {
    id: string;
    generation: number;
    status: Extract<AiOperationStatus, "COMPLETED" | "FAILED" | "UNKNOWN">;
    now: Date;
  }): Promise<AiOperationReservationRecord | null>;
  promoteExpiredDispatchedToUnknown(input: {
    userId: string;
    featureKey: string;
    idempotencyKey: string;
    now: Date;
  }): Promise<AiOperationReservationRecord | null>;
};

export type ReserveAiOperationInput = {
  userId: string;
  featureKey: string;
  idempotencyKey: string | null | undefined;
  fingerprintHash: string;
  store: AiIdempotencyStore;
  now?: Date;
  ttlMs?: number;
  requestId?: string;
};

export type ReserveAiOperationResult =
  | { kind: "authorized"; reservation: AiOperationReservationRecord; reclaimed: boolean }
  | { kind: "missing_key" }
  | { kind: "in_progress"; reservation: AiOperationReservationRecord }
  | { kind: "completed"; reservation: AiOperationReservationRecord }
  | { kind: "unknown_blocked"; reservation: AiOperationReservationRecord }
  | { kind: "fingerprint_conflict"; reservation: AiOperationReservationRecord }
  | { kind: "store_unavailable" };

export function normalizeIdempotencyKey(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

/** Hash canônico estável. Não persiste o payload — só o digest. */
export function fingerprintAiParams(parts: unknown): string {
  return createHash("sha256").update(canonicalize(parts)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(",")}}`;
}

export async function reserveAiOperation(input: ReserveAiOperationInput): Promise<ReserveAiOperationResult> {
  const key = normalizeIdempotencyKey(input.idempotencyKey);
  if (!key) {
    recordAiIdempotencyMetric("missing_key", { featureKey: input.featureKey });
    return { kind: "missing_key" };
  }

  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? AI_IDEMPOTENCY_TTL_MS;
  const requestId = input.requestId ?? randomUUID();
  const candidate: AiOperationReservationRecord = {
    id: randomUUID(),
    userId: input.userId,
    featureKey: input.featureKey,
    idempotencyKey: key,
    fingerprintHash: input.fingerprintHash,
    requestId,
    generation: 1,
    status: "IN_PROGRESS",
    providerDispatched: false,
    expiresAt: new Date(now.getTime() + ttlMs),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  try {
    const inserted = await input.store.tryInsert(candidate);
    if (inserted) {
      recordAiIdempotencyMetric("authorized", { featureKey: input.featureKey });
      return { kind: "authorized", reservation: inserted, reclaimed: false };
    }

    let existing = await input.store.findByScope({
      userId: input.userId,
      featureKey: input.featureKey,
      idempotencyKey: key,
    });
    if (!existing) {
      recordAiIdempotencyMetric("store_failure", { featureKey: input.featureKey });
      return { kind: "store_unavailable" };
    }

    if (existing.fingerprintHash !== input.fingerprintHash) {
      recordAiIdempotencyMetric("fingerprint_conflict", { featureKey: input.featureKey });
      return { kind: "fingerprint_conflict", reservation: existing };
    }

    if (existing.status === "COMPLETED") {
      recordAiIdempotencyMetric("duplicate_blocked", { featureKey: input.featureKey, reason: "completed" });
      return { kind: "completed", reservation: existing };
    }

    if (existing.status === "UNKNOWN") {
      recordAiIdempotencyMetric("unknown_blocked", { featureKey: input.featureKey });
      return { kind: "unknown_blocked", reservation: existing };
    }

    if (existing.status === "FAILED") {
      const reclaimed = await input.store.reclaimFailed({
        userId: input.userId,
        featureKey: input.featureKey,
        idempotencyKey: key,
        fingerprintHash: input.fingerprintHash,
        requestId,
        expiresAt: candidate.expiresAt,
        now,
      });
      if (reclaimed) {
        recordAiIdempotencyMetric("reclaimed", { featureKey: input.featureKey, reason: "failed" });
        recordAiIdempotencyMetric("authorized", { featureKey: input.featureKey });
        return { kind: "authorized", reservation: reclaimed, reclaimed: true };
      }
      existing = (await input.store.findByScope({
        userId: input.userId,
        featureKey: input.featureKey,
        idempotencyKey: key,
      })) ?? existing;
    }

    if (existing.status === "IN_PROGRESS" && existing.expiresAt.getTime() <= now.getTime()) {
      if (existing.providerDispatched) {
        const unknown = await input.store.promoteExpiredDispatchedToUnknown({
          userId: input.userId,
          featureKey: input.featureKey,
          idempotencyKey: key,
          now,
        });
        recordAiIdempotencyMetric("unknown_blocked", { featureKey: input.featureKey, reason: "expired_dispatched" });
        return { kind: "unknown_blocked", reservation: unknown ?? { ...existing, status: "UNKNOWN" } };
      }
      const reclaimed = await input.store.reclaimExpiredUndispatched({
        userId: input.userId,
        featureKey: input.featureKey,
        idempotencyKey: key,
        fingerprintHash: input.fingerprintHash,
        requestId,
        expiresAt: candidate.expiresAt,
        now,
      });
      if (reclaimed) {
        recordAiIdempotencyMetric("reclaimed", { featureKey: input.featureKey, reason: "expired_undispatched" });
        recordAiIdempotencyMetric("authorized", { featureKey: input.featureKey });
        return { kind: "authorized", reservation: reclaimed, reclaimed: true };
      }
      existing = (await input.store.findByScope({
        userId: input.userId,
        featureKey: input.featureKey,
        idempotencyKey: key,
      })) ?? existing;
    }

    if (existing.status === "IN_PROGRESS" && existing.expiresAt.getTime() > now.getTime()) {
      recordAiIdempotencyMetric("in_progress", { featureKey: input.featureKey });
      return { kind: "in_progress", reservation: existing };
    }

    if (existing.status === "COMPLETED") {
      recordAiIdempotencyMetric("duplicate_blocked", { featureKey: input.featureKey, reason: "completed" });
      return { kind: "completed", reservation: existing };
    }
    if (existing.status === "UNKNOWN") {
      recordAiIdempotencyMetric("unknown_blocked", { featureKey: input.featureKey });
      return { kind: "unknown_blocked", reservation: existing };
    }

    recordAiIdempotencyMetric("in_progress", { featureKey: input.featureKey });
    return { kind: "in_progress", reservation: existing };
  } catch {
    recordAiIdempotencyMetric("store_failure", { featureKey: input.featureKey });
    return { kind: "store_unavailable" };
  }
}

/** Confirma despacho no banco. Zero linhas → OwnershipError (não chamar provedor). */
export async function markAiOperationProviderDispatched(
  store: AiIdempotencyStore,
  reservation: Pick<AiOperationReservationRecord, "id" | "generation">,
  now = new Date(),
): Promise<AiOperationReservationRecord> {
  const updated = await store.markProviderDispatched({
    id: reservation.id,
    generation: reservation.generation,
    now,
  });
  if (!updated) {
    recordAiIdempotencyMetric("store_failure", { reason: "dispatch_ownership_lost" });
    throw new AiIdempotencyOwnershipError("dispatch_ownership_lost");
  }
  return updated;
}

export async function completeAiOperation(
  store: AiIdempotencyStore,
  reservation: Pick<AiOperationReservationRecord, "id" | "generation">,
  now = new Date(),
): Promise<AiOperationReservationRecord | null> {
  const updated = await store.markStatus({
    id: reservation.id,
    generation: reservation.generation,
    status: "COMPLETED",
    now,
  });
  if (updated) recordAiIdempotencyMetric("completed");
  else recordAiIdempotencyMetric("store_failure", { reason: "complete_ownership_lost" });
  return updated;
}

export async function failAiOperation(
  store: AiIdempotencyStore,
  reservation: Pick<AiOperationReservationRecord, "id" | "generation">,
  now = new Date(),
): Promise<AiOperationReservationRecord | null> {
  const updated = await store.markStatus({
    id: reservation.id,
    generation: reservation.generation,
    status: "FAILED",
    now,
  });
  if (updated) recordAiIdempotencyMetric("failed");
  else recordAiIdempotencyMetric("store_failure", { reason: "fail_ownership_lost" });
  return updated;
}

export async function unknownAiOperation(
  store: AiIdempotencyStore,
  reservation: Pick<AiOperationReservationRecord, "id" | "generation">,
  now = new Date(),
): Promise<AiOperationReservationRecord | null> {
  const updated = await store.markStatus({
    id: reservation.id,
    generation: reservation.generation,
    status: "UNKNOWN",
    now,
  });
  if (updated) recordAiIdempotencyMetric("unknown_marked");
  else recordAiIdempotencyMetric("store_failure", { reason: "unknown_ownership_lost" });
  return updated;
}

export function createMemoryAiIdempotencyStore(): AiIdempotencyStore {
  const rows = new Map<string, AiOperationReservationRecord>();
  const scope = (userId: string, featureKey: string, idempotencyKey: string) => `${userId}\0${featureKey}\0${idempotencyKey}`;
  let chain: Promise<unknown> = Promise.resolve();
  const exclusive = async <T>(work: () => Promise<T> | T): Promise<T> => {
    const run = chain.then(work, work);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };

  return {
    async tryInsert(record) {
      return exclusive(() => {
        const key = scope(record.userId, record.featureKey, record.idempotencyKey);
        if (rows.has(key)) return null;
        const stored = { ...record };
        rows.set(key, stored);
        return { ...stored };
      });
    },
    async findByScope(input) {
      return exclusive(() => {
        const found = rows.get(scope(input.userId, input.featureKey, input.idempotencyKey));
        return found ? { ...found } : null;
      });
    },
    async reclaimFailed(input) {
      return exclusive(() => {
        const key = scope(input.userId, input.featureKey, input.idempotencyKey);
        const current = rows.get(key);
        if (!current || current.status !== "FAILED" || current.fingerprintHash !== input.fingerprintHash) return null;
        const next: AiOperationReservationRecord = {
          ...current,
          requestId: input.requestId,
          generation: current.generation + 1,
          status: "IN_PROGRESS",
          providerDispatched: false,
          expiresAt: input.expiresAt,
          updatedAt: input.now,
          completedAt: null,
        };
        rows.set(key, next);
        return { ...next };
      });
    },
    async reclaimExpiredUndispatched(input) {
      return exclusive(() => {
        const key = scope(input.userId, input.featureKey, input.idempotencyKey);
        const current = rows.get(key);
        if (
          !current
          || current.status !== "IN_PROGRESS"
          || current.providerDispatched
          || current.fingerprintHash !== input.fingerprintHash
          || current.expiresAt.getTime() > input.now.getTime()
        ) {
          return null;
        }
        const next: AiOperationReservationRecord = {
          ...current,
          requestId: input.requestId,
          generation: current.generation + 1,
          status: "IN_PROGRESS",
          providerDispatched: false,
          expiresAt: input.expiresAt,
          updatedAt: input.now,
          completedAt: null,
        };
        rows.set(key, next);
        return { ...next };
      });
    },
    async markProviderDispatched(input) {
      return exclusive(() => {
        for (const [key, row] of rows) {
          if (row.id !== input.id) continue;
          if (row.generation !== input.generation) return null;
          if (row.status !== "IN_PROGRESS" || row.providerDispatched) return null;
          if (row.expiresAt.getTime() <= input.now.getTime()) return null;
          const next = { ...row, providerDispatched: true, updatedAt: input.now };
          rows.set(key, next);
          return { ...next };
        }
        return null;
      });
    },
    async markStatus(input) {
      return exclusive(() => {
        for (const [key, row] of rows) {
          if (row.id !== input.id) continue;
          if (row.generation !== input.generation) return null;
          if (row.status !== "IN_PROGRESS") return null;
          const next: AiOperationReservationRecord = {
            ...row,
            status: input.status,
            updatedAt: input.now,
            completedAt: input.status === "COMPLETED" ? input.now : row.completedAt,
          };
          rows.set(key, next);
          return { ...next };
        }
        return null;
      });
    },
    async promoteExpiredDispatchedToUnknown(input) {
      return exclusive(() => {
        const key = scope(input.userId, input.featureKey, input.idempotencyKey);
        const current = rows.get(key);
        if (!current || current.status !== "IN_PROGRESS" || !current.providerDispatched) return null;
        if (current.expiresAt.getTime() > input.now.getTime()) return null;
        const next: AiOperationReservationRecord = {
          ...current,
          status: "UNKNOWN",
          updatedAt: input.now,
        };
        rows.set(key, next);
        return { ...next };
      });
    },
  };
}
