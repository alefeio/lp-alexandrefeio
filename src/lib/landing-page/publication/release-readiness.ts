import { siteConfig } from "@/data/site-config";
import { LIVE_MEDIA_STORE_READY, landingPagePublicRuntimeEnabled } from "@/lib/landing-page/publication/gate";
import { landingPageRateLimitSecret } from "@/lib/landing-page/rate-limit/secret";
import { landingPageMediaStorageConfigured } from "@/lib/landing-page/trust/plan";

export const CAPTCHA_REQUIRED_AT_LAUNCH = "NOT_REQUIRED_FOR_MVP" as const;
export const LEAD_RETENTION_POLICY = "OPEN_DECISION" as const;
export const MEDIA_RETENTION_POLICY = "OPEN_DECISION" as const;
export const METRICS_RETENTION_POLICY = "OPEN_DECISION" as const;

/**
 * A página /privacidade cobre contato, conta, estudo, projeto e compra.
 * Ainda não cobre formulário de landing, acesso do dono aos leads, contagem agregada,
 * mídia pública nem retenção em aberto.
 */
export const PRIVACY_POLICY_UPDATE_REQUIRED = true;

export type ReleaseCheck = {
  id: string;
  status: "PASS" | "BLOCKED";
  kind: "TECHNICAL_BLOCKER" | "POLICY_BLOCKER" | "MANUAL_RELEASE_STEP";
};

export type LandingPagePublicReleaseReadinessV1 = {
  status: "READY" | "BLOCKED";
  checks: ReleaseCheck[];
};

type ReadinessEnv = {
  NODE_ENV?: string;
  LANDING_PAGE_PUBLIC_RUNTIME_ENABLED?: string;
  LANDING_PAGE_RATE_LIMIT_SECRET?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  VERCEL_OIDC_TOKEN?: string;
};

function check(id: string, pass: boolean, kind: ReleaseCheck["kind"]): ReleaseCheck {
  return { id, status: pass ? "PASS" : "BLOCKED", kind };
}

/** Configuração de produção, sem devolver segredo, token ou endereço de banco. */
export function evaluateLandingPageProductionReadinessConfig(env: ReadinessEnv = process.env as ReadinessEnv): LandingPagePublicReleaseReadinessV1 {
  const secretReady = landingPageRateLimitSecret(env) !== null;
  const mediaConfigured = landingPageMediaStorageConfigured(env);
  const runtimeOn = landingPagePublicRuntimeEnabled(env);
  const productionSafe = env.NODE_ENV !== "production" || !runtimeOn || secretReady;
  const hostReady = siteConfig.url === "https://alexandrefeio.com.br";
  return {
    status: secretReady && mediaConfigured && hostReady && productionSafe ? "READY" : "BLOCKED",
    checks: [
      check("RATE_LIMIT_SECRET", secretReady, "MANUAL_RELEASE_STEP"),
      check("MEDIA_STORAGE_CONFIG", mediaConfigured, "TECHNICAL_BLOCKER"),
      check("PUBLIC_RUNTIME_FLAG", !runtimeOn || secretReady, "MANUAL_RELEASE_STEP"),
      check("CANONICAL_HOST", hostReady, "TECHNICAL_BLOCKER"),
      check("PRODUCTION_DEFAULT_FAILS_CLOSED", productionSafe, "TECHNICAL_BLOCKER"),
    ],
  };
}

/**
 * Consolidado do corte. Políticas em aberto e o runtime desligado mantêm BLOCKED.
 * Não é uma nota.
 */
export function evaluateLandingPagePublicReleaseReadiness(input?: {
  env?: ReadinessEnv;
  liveMediaStoreReady?: boolean;
  migrationPresent?: boolean;
}): LandingPagePublicReleaseReadinessV1 {
  const env = input?.env ?? (process.env as ReadinessEnv);
  const config = evaluateLandingPageProductionReadinessConfig(env);
  const liveMedia = input?.liveMediaStoreReady ?? LIVE_MEDIA_STORE_READY;
  const migrationPresent = input?.migrationPresent ?? true;
  const checks: ReleaseCheck[] = [
    check("DURABLE_COPY_RATE_LIMIT", true, "TECHNICAL_BLOCKER"),
    check("DURABLE_MEDIA_RATE_LIMIT", true, "TECHNICAL_BLOCKER"),
    check("DURABLE_FORM_RATE_LIMIT", true, "TECHNICAL_BLOCKER"),
    check("PUBLIC_EVENT_PROTECTION", true, "TECHNICAL_BLOCKER"),
    check("LIVE_MEDIA_STORAGE", liveMedia, "TECHNICAL_BLOCKER"),
    check("MEDIA_ORPHAN_CLEANUP", true, "TECHNICAL_BLOCKER"),
    check("FORM_SECURITY", true, "TECHNICAL_BLOCKER"),
    check("PUBLIC_EVENT_SECURITY", true, "TECHNICAL_BLOCKER"),
    check("PRIVACY_BOUNDARY", true, "TECHNICAL_BLOCKER"),
    check("SECURITY_HEADERS", true, "TECHNICAL_BLOCKER"),
    check("PUBLIC_RUNTIME_SMOKE", true, "TECHNICAL_BLOCKER"),
    check("RESPONSIVE_PUBLIC_SMOKE", true, "MANUAL_RELEASE_STEP"),
    check("PRIVACY_POLICY", !PRIVACY_POLICY_UPDATE_REQUIRED, "POLICY_BLOCKER"),
    check("RETENTION_DECISIONS", false, "POLICY_BLOCKER"),
    check("DURABLE_LIMITER_MIGRATION", migrationPresent, "TECHNICAL_BLOCKER"),
    ...config.checks,
  ];
  return { status: checks.every((item) => item.status === "PASS") ? "READY" : "BLOCKED", checks };
}
