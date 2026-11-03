import {
  AiIdempotencyOwnershipError,
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
  | "store_unavailable"
  | "ownership_lost";

/** Classificação do resultado da execução protegida. */
export type AiExecutionFailureKind =
  /** Falha antes de confirmar despacho no banco — recuperável. */
  | "before_dispatch"
  /** Resposta definitiva do provedor ou rejeição de validação com evidência. */
  | "definitive"
  /** Timeout/transporte após possível envio — não recuperar com a mesma chave. */
  | "uncertain";

export type GuardedAiExecution<T> =
  | { ok: true; value: T; reservation: AiOperationReservationRecord }
  | { ok: false; block: AiIdempotencyBlockKind; reservation?: AiOperationReservationRecord }
  | {
    ok: false;
    executionFailed: true;
    failureKind: AiExecutionFailureKind;
    uncertain: boolean;
    reservation: AiOperationReservationRecord;
    error?: unknown;
  };

function blockFromReserve(result: Exclude<ReserveAiOperationResult, { kind: "authorized" }>): AiIdempotencyBlockKind {
  return result.kind;
}

/**
 * Reserva → confirma despacho (fencing) → executa → completa/falha/unknown.
 * Não chama o provedor se a reserva não autorizar ou se a confirmação de despacho falhar.
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
    /** Confirma despacho no banco. Lança OwnershipError se a geração não for mais dona. */
    confirmDispatch: () => Promise<void>;
  }) => Promise<
    | { ok: true; value: T }
    | { ok: false; failureKind?: AiExecutionFailureKind; uncertain?: boolean }
  >;
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
  const confirmDispatch = async () => {
    if (dispatched) return;
    await markAiOperationProviderDispatched(input.store, reservation, input.now);
    dispatched = true;
  };

  try {
    const outcome = await input.execute({
      requestId: reservation.requestId,
      reservation,
      confirmDispatch,
    });
    if (outcome.ok) {
      // Resposta válida não é descartada se a atualização final da reserva falhar.
      await completeAiOperation(input.store, reservation, input.now);
      return { ok: true, value: outcome.value, reservation };
    }

    const failureKind: AiExecutionFailureKind = outcome.failureKind
      ?? (outcome.uncertain ? "uncertain" : dispatched ? "definitive" : "before_dispatch");
    const uncertain = failureKind === "uncertain";

    if (uncertain) {
      await unknownAiOperation(input.store, reservation, input.now);
      return { ok: false, executionFailed: true, failureKind, uncertain: true, reservation };
    }
    await failAiOperation(input.store, reservation, input.now);
    return { ok: false, executionFailed: true, failureKind, uncertain: false, reservation };
  } catch (error) {
    if (error instanceof AiIdempotencyOwnershipError) {
      return {
        ok: false,
        block: "ownership_lost",
        reservation,
      };
    }
    if (dispatched) {
      await unknownAiOperation(input.store, reservation, input.now);
      return {
        ok: false,
        executionFailed: true,
        failureKind: "uncertain",
        uncertain: true,
        reservation,
        error,
      };
    }
    await failAiOperation(input.store, reservation, input.now);
    return {
      ok: false,
      executionFailed: true,
      failureKind: "before_dispatch",
      uncertain: false,
      reservation,
      error,
    };
  }
}
