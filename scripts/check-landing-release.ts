import { evaluateLandingPagePublicReleaseReadiness } from "../src/lib/landing-page/publication/release-readiness";

const report = evaluateLandingPagePublicReleaseReadiness({
  env: {
    NODE_ENV: process.env.NODE_ENV,
    LANDING_PAGE_PUBLIC_RUNTIME_ENABLED: process.env.LANDING_PAGE_PUBLIC_RUNTIME_ENABLED,
    LANDING_PAGE_RATE_LIMIT_SECRET: process.env.LANDING_PAGE_RATE_LIMIT_SECRET,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
  },
});

const secret = process.env.LANDING_PAGE_RATE_LIMIT_SECRET ?? "";
const blob = process.env.BLOB_READ_WRITE_TOKEN ?? "";
const text = JSON.stringify({ status: report.status, checks: report.checks.map((item) => ({ id: item.id, status: item.status, kind: item.kind })) });
if ((secret && text.includes(secret)) || (blob && text.includes(blob))) {
  console.error("release check leaked a secret");
  process.exit(1);
}
console.log(text);
if (process.env.LANDING_PAGE_PUBLIC_RUNTIME_ENABLED === "true" && process.env.NODE_ENV === "production") {
  console.error("production public runtime must stay disabled during hardening");
  process.exit(1);
}
