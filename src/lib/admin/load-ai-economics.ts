import { Prisma } from "@/generated/prisma/client";
import {
  aiEconomicsWindow,
  buildAiEconomicsView,
  parseAiEconomicsPeriod,
  type AiEconomicsCall,
  type AiEconomicsPayment,
} from "@/lib/admin/ai-economics";
import { getPrisma } from "@/lib/db/prisma";

const callSelect = {
  requestId: true,
  featureKey: true,
  providerId: true,
  modelId: true,
  serviceTier: true,
  promptVersion: true,
  operationType: true,
  status: true,
  inputTokens: true,
  cachedInputTokens: true,
  cacheWriteTokens: true,
  outputTokens: true,
  totalTokens: true,
  webSearchCalls: true,
  estimatedModelCostUsdMicros: true,
  estimatedToolCostUsdMicros: true,
  estimatedCostUsdMicros: true,
  pricingVersion: true,
  latencyMs: true,
  createdAt: true,
} satisfies Prisma.AiProviderCallSelect;

export async function loadAiEconomics(query: { periodo?: string }, now = new Date()) {
  const period = parseAiEconomicsPeriod(query.periodo);
  const window = aiEconomicsWindow(period, now);
  const createdAt = window.start ? { gte: window.start, lt: window.end } : { lt: window.end };
  const prisma = getPrisma();
  const [calls, payments, paidOrders] = await Promise.all([
    prisma.aiProviderCall.findMany({ where: { createdAt }, select: callSelect }),
    prisma.payment.findMany({
      where: {
        status: { in: ["APPROVED", "PARTIALLY_REFUNDED"] },
        OR: [
          { approvedAt: createdAt },
          { AND: [{ approvedAt: null }, { createdAt }] },
        ],
      },
      select: { status: true, amountCents: true, refundedAmountCents: true, approvedAt: true, createdAt: true },
    }),
    prisma.order.count({ where: { status: "PAID", createdAt } }),
  ]);

  return buildAiEconomicsView({
    period,
    now,
    calls: calls satisfies AiEconomicsCall[],
    payments: payments satisfies AiEconomicsPayment[],
    paidOrders,
  });
}
