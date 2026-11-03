import {
  completeAiOperation,
  failAiOperation,
  markAiOperationProviderDispatched,
  reserveAiOperation,
  unknownAiOperation,
  type AiIdempotencyStore,
  type AiOperationReservationRecord,
  type ReserveAiOperationResult,
} from "@/lib/ai/idempotency";

export type AiIdempotencyBlockKind =
  | "missing_key"
  | "in_progress"
  | "completed"
  | "unknown_blocked"
  | "fingerprint_conflict"
  | "store_unavailable";

export type GuardedAiExecution<T> =
  | { ok: true; value: T; reservation: AiOperationReservationRecord }
  | { ok: false; block: AiIdempotencyBlockKind; reservation?: AiOperationReservationRecord }
  | { ok: false; executionFailed: true; uncertain: boolean; reservation: AiOperationReservationRecord; error?: unknown };

function blockFromReserve(result: Exclude<ReserveAiOperationResult, { kind: "authorized" }>): AiIdempotencyBlockKind {
  return result.kind;
}

/**
 * Reserva → marca despacho → executa → completa/falha/unknown.
 * Não chama o provedor se a reserva não autorizar.
 */
export async function runGuardedAiOperation<T>(input: {
  userId: string;
  featureKey: string;
  idempotencyKey: string | null | undefined;
  fingerprintHash: string;
  store: AiIdempotencyStore;
  now?: Date;
  ttlMs?: number;
  requestId?: string;
  execute: (ctx: {
    requestId: string;
    reservation: AiOperationReservationRecord;
    markDispatched: () => Promise<void>;
  }) => Promise<{ ok: true; value: T } | { ok: false; uncertain?: boolean }>;
}): Promise<GuardedAiExecution<T>> {
  const reserved = await reserveAiOperation({
    userId: input.userId,
    featureKey: input.featureKey,
    idempotencyKey: input.idempotencyKey,
    fingerprintHash: input.fingerprintHash,
    store: input.store,
    now: input.now,
    ttlMs: input.ttlMs,
    requestId: input.requestId,
  });

  if (reserved.kind !== "authorized") {
    return {
      ok: false,
      block: blockFromReserve(reserved),
      ...("reservation" in reserved ? { reservation: reserved.reservation } : {}),
    };
  }

  const reservation = reserved.reservation;
  let dispatched = false;
  const markDispatched = async () => {
    if (dispatched) return;
    await markAiOperationProviderDispatched(input.store, reservation.id, input.now);
    dispatched = true;
  };

  try {
    const outcome = await input.execute({
      requestId: reservation.requestId,
      reservation,
      markDispatched,
    });
    if (outcome.ok) {
      await completeAiOperation(input.store, reservation.id, input.now);
      return { ok: true, value: outcome.value, reservation };
    }
    if (outcome.uncertain) {
      await unknownAiOperation(input.store, reservation.id, input.now);
      return { ok: false, executionFailed: true, uncertain: true, reservation };
    }
    await failAiOperation(input.store, reservation.id, input.now);
    return { ok: false, executionFailed: true, uncertain: false, reservation };
  } catch (error) {
    if (dispatched) {
      await unknownAiOperation(input.store, reservation.id, input.now);
      return { ok: false, executionFailed: true, uncertain: true, reservation, error };
    }
    await failAiOperation(input.store, reservation.id, input.now);
    return { ok: false, executionFailed: true, uncertain: false, reservation, error };
  }
}
