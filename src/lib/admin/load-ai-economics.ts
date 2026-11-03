import { Prisma } from "@/generated/prisma/client";
import {
  aiEconomicsWindow,
  buildAiEconomicsView,
  parseAiEconomicsPeriod,
  type AiEconomicsCall,
  type AiEconomicsPayment,
  type AiEconomicsUserDirectory,
} from "@/lib/admin/ai-economics";
import { getPrisma } from "@/lib/db/prisma";

const callSelect = {
  requestId: true,
  featureKey: true,
  userId: true,
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

  const userIds = [...new Set(calls.map((call) => call.userId))];
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        });

  const userDirectory: AiEconomicsUserDirectory = Object.fromEntries(
    users.map((user) => [user.id, { name: user.name, email: user.email }]),
  );

  return buildAiEconomicsView({
    period,
    now,
    calls: calls satisfies AiEconomicsCall[],
    payments: payments satisfies AiEconomicsPayment[],
    paidOrders,
    userDirectory,
  });
}
