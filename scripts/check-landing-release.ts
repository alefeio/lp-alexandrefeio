import { evaluateLandingPagePublicReleaseReadiness } from "../src/lib/landing-page/publication/release-readiness";

const report = evaluateLandingPagePublicReleaseReadiness({
  env: {
    NODE_ENV: process.env.NODE_ENV,
    LANDING_PAGE_PUBLIC_RUNTIME_ENABLED: process.env.LANDING_PAGE_PUBLIC_RUNTIME_ENABLED,
    LANDING_PAGE_RATE_LIMIT_SECRET: process.env.LANDING_PAGE_RATE_LIMIT_SECRET,
    APIMG_UPLOAD_URL: process.env.APIMG_UPLOAD_URL,
    APIMG_API_KEY: process.env.APIMG_API_KEY,
  },
});

const secret = process.env.LANDING_PAGE_RATE_LIMIT_SECRET ?? "";
const apimgKey = process.env.APIMG_API_KEY ?? "";
const text = JSON.stringify({ status: report.status, checks: report.checks.map((item) => ({ id: item.id, status: item.status, kind: item.kind })) });
if ((secret && text.includes(secret)) || (apimgKey && text.includes(apimgKey))) {
  console.error("release check leaked a secret");
  process.exit(1);
}
console.log(text);
if (process.env.LANDING_PAGE_PUBLIC_RUNTIME_ENABLED === "true" && process.env.NODE_ENV === "production") {
  console.error("production public runtime must stay disabled during hardening");
  process.exit(1);
}
