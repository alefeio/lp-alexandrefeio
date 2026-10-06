import assert from "node:assert/strict";
import {
  ATTRIBUTION_STORAGE_KEY,
  buildAttributionFromUrl,
  readStoredAttribution,
  sanitizeAttributionInput,
} from "../src/lib/attribution";
import { parseConsent, serializeConsent } from "../src/lib/consent";
import { objectiveToServiceName, toServiceAnalyticsName } from "../src/lib/service-analytics";

assert.equal(toServiceAnalyticsName("site-trafego"), "site_trafego");
assert.equal(objectiveToServiceName("site-trafego"), "site_trafego");
assert.equal(objectiveToServiceName("google-ads"), "gestao_trafego");

const attributed = buildAttributionFromUrl(
  "https://alexandrefeio.com.br/?servico=site-trafego&utm_source=google&utm_medium=cpc&utm_campaign=sites_belem&gclid=abc123",
  "https://www.google.com/",
);
assert.equal(attributed.utm_source, "google");
assert.equal(attributed.utm_medium, "cpc");
assert.equal(attributed.utm_campaign, "sites_belem");
assert.equal(attributed.gclid, "abc123");
assert.match(attributed.landing_page ?? "", /servico=site-trafego/);

const direct = buildAttributionFromUrl("https://alexandrefeio.com.br/", "");
assert.equal(direct.lead_source, "direct");
assert.equal(direct.lead_medium, "none");

const referral = buildAttributionFromUrl("https://alexandrefeio.com.br/", "https://example.com/page");
assert.equal(referral.lead_source, "referral");

const sanitized = sanitizeAttributionInput({
  utm_source: " google ",
  gclid: "x".repeat(300),
  landing_page: "/",
});
assert.equal(sanitized.utm_source, "google");
assert.equal(sanitized.gclid?.length, 200);

const stored = readStoredAttribution(
  JSON.stringify({ utm_source: "meta", utm_medium: "paid", fbclid: "fb-1" }),
);
assert.equal(stored.utm_source, "meta");
assert.equal(stored.fbclid, "fb-1");

const consent = serializeConsent({ analytics: true, marketing: false });
assert.equal(consent.analytics, true);
assert.equal(consent.marketing, false);
assert.equal(parseConsent(JSON.stringify(consent))?.analytics, true);
assert.equal(parseConsent("invalid"), null);

assert.equal(ATTRIBUTION_STORAGE_KEY, "af_attribution");

console.log("analytics checks ok");
