/**
 * Diagnóstico read-only das tentativas Pix/HTTP 402 (janela local 18/11/2026).
 * Apenas SELECT + GET Orders. Sem POST/PATCH/DELETE, sem nova cobrança, sem dump de PII.
 */
import { config as loadEnv } from "dotenv";
import {
  extractProviderChargeDiagnostics,
  sanitizeProviderDiagnosticToken,
} from "../src/lib/commerce/provider";

loadEnv({ path: ".env.local" });

const START = new Date("2026-11-18T03:00:00.000Z"); // 00:00 America/Sao_Paulo
const END = new Date("2026-11-19T03:00:00.000Z");

function sanitizeDetail(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("fp:")) return "fp:<redacted>";
  return sanitizeProviderDiagnosticToken(value, 80);
}

async function getRemoteOrder(providerPaymentId: string, accessToken: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/orders/${encodeURIComponent(providerPaymentId)}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const payload = await response.json().catch(() => null);
  const diagnostics = extractProviderChargeDiagnostics({
    httpStatus: response.status,
    payload,
    view: null,
    method: "PIX",
    correlationId: null,
  });
  return {
    httpStatus: response.status,
    providerStatus: diagnostics.providerStatus,
    statusDetail: diagnostics.statusDetail,
    errorCode: diagnostics.errorCode,
    remoteOrderIdPresent: diagnostics.remoteOrderIdPresent,
  };
}

async function main() {
  if ((process.env.VERCEL_ENV ?? "").toLowerCase() === "production" && process.env.ALLOW_PROD_READONLY_DIAG !== "1") {
    // Ainda pode ler o Postgres compartilhado via RUNTIME_DATABASE_URL local; bloqueia só se o processo estiver marcado production sem opt-in.
    console.error("Defina ALLOW_PROD_READONLY_DIAG=1 para diagnóstico read-only neste processo.");
    process.exit(2);
  }

  delete process.env.UNIT_TEST_ISOLATION;
  const g = globalThis as unknown as { prisma?: unknown };
  delete g.prisma;

  const { getPrisma } = await import("../src/lib/db/prisma");
  const prisma = getPrisma();

  const rows = await prisma.payment.findMany({
    where: {
      createdAt: { gte: START, lt: END },
      OR: [
        { status: "REJECTED" },
        { providerStatus: { in: ["request_failed", "rejected", "failed", "cancelled", "outcome_unknown", "charge_dispatched"] } },
      ],
    },
    select: {
      id: true,
      orderId: true,
      createdAt: true,
      status: true,
      providerStatus: true,
      providerStatusDetail: true,
      providerPaymentId: true,
      paymentMethodType: true,
      amountCents: true,
      order: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
  const mpEnv = (process.env.MERCADO_PAGO_ENV ?? "").toLowerCase();
  const summaries = [];

  for (const row of rows) {
    const base = {
      paymentIdPrefix: row.id.slice(0, 8),
      orderIdPrefix: row.orderId.slice(0, 8),
      createdAt: row.createdAt.toISOString(),
      status: row.status,
      providerStatus: sanitizeProviderDiagnosticToken(row.providerStatus, 40),
      providerStatusDetail: sanitizeDetail(row.providerStatusDetail),
      hasProviderPaymentId: Boolean(row.providerPaymentId),
      paymentMethodType: row.paymentMethodType,
      amountCents: row.amountCents,
      orderStatus: row.order.status,
      remote: null as null | Awaited<ReturnType<typeof getRemoteOrder>>,
    };

    if (row.providerPaymentId && accessToken.startsWith("APP_USR")) {
      // GET only — nunca POST/PATCH/DELETE
      base.remote = await getRemoteOrder(row.providerPaymentId, accessToken);
    }
    summaries.push(base);
  }

  const withRemoteId = summaries.filter((row) => row.hasProviderPaymentId).length;
  const remoteOk = summaries.filter((row) => row.remote && row.remote.httpStatus >= 200 && row.remote.httpStatus < 300);
  const remoteMissing = summaries.filter((row) => row.remote && row.remote.httpStatus === 404);
  const persistedDetails = [
    ...new Set(summaries.map((row) => row.providerStatusDetail).filter((value): value is string => Boolean(value))),
  ];
  const hasProcessingError = summaries.some(
    (row) => row.providerStatus === "rejected" && row.providerStatusDetail === "processing_error",
  );

  // Causa persistida no momento do 402 (applyProviderView) vs reconsulta GET atual.
  const verdict =
    rows.length === 0
      ? "INCONCLUSIVO"
      : hasProcessingError || remoteOk.length > 0
        ? "CONFIRMADO"
        : withRemoteId === 0
          ? "INCONCLUSIVO"
          : "INCONCLUSIVO";

  console.info(
    JSON.stringify(
      {
        window: { start: START.toISOString(), end: END.toISOString(), tz: "America/Sao_Paulo" },
        mercadoPagoEnv: mpEnv || null,
        attemptedCount: rows.length,
        withProviderPaymentId: withRemoteId,
        remoteLookupsOk: remoteOk.length,
        remoteLookupsNotFound: remoteMissing.length,
        persistedStatusDetails: persistedDetails,
        verdict,
        note: hasProcessingError
          ? "Causa CONFIRMADA pelos campos persistidos rejected/processing_error (resposta estruturada do 402). GET atual pode retornar order_not_found se a order sandbox expirou ou o token não vê o recurso."
          : verdict === "INCONCLUSIVO"
            ? "Sem identificador remoto recuperável ou sem GET útil; instrumentação pós-#32 só comprova causa em execução controlada futura."
            : "Status remoto obtido via GET Orders; correlacionar com logs Vercel (httpStatus 402 não persiste no banco).",
        rows: summaries,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
