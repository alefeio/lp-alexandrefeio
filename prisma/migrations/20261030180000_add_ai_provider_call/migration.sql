-- Ledger aditivo de chamadas reais a provedores de IA. Não altera tabelas existentes.

CREATE TABLE "ai_provider_call" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "featureKey" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "serviceTier" TEXT,
    "providerResponseId" TEXT,
    "promptVersion" TEXT,
    "operationType" TEXT,
    "sectionType" TEXT,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "courseId" TEXT,
    "landingPageProjectId" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "cacheWriteTokens" INTEGER,
    "cacheWrite30mTokens" INTEGER,
    "cacheWrite12hTokens" INTEGER,
    "outputTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsdMicros" INTEGER,
    "pricingVersion" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_call_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_provider_call_requestId_attempt_key" ON "ai_provider_call"("requestId", "attempt");

CREATE INDEX "ai_provider_call_createdAt_idx" ON "ai_provider_call"("createdAt");

CREATE INDEX "ai_provider_call_userId_createdAt_idx" ON "ai_provider_call"("userId", "createdAt");

CREATE INDEX "ai_provider_call_featureKey_createdAt_idx" ON "ai_provider_call"("featureKey", "createdAt");

CREATE INDEX "ai_provider_call_modelId_createdAt_idx" ON "ai_provider_call"("modelId", "createdAt");

CREATE INDEX "ai_provider_call_projectId_createdAt_idx" ON "ai_provider_call"("projectId", "createdAt");

ALTER TABLE "ai_provider_call" ADD CONSTRAINT "ai_provider_call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
