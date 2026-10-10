import assert from "node:assert/strict";
import {
  ATTRIBUTION_STORAGE_KEY,
  buildAttributionFromUrl,
  readStoredAttribution,
  sanitizeAttributionInput,
} from "../src/lib/attribution";
import {
  CONSENT_STORAGE_KEY,
  consentToGoogleSignals,
  parseConsent,
  serializeConsent,
} from "../src/lib/consent";
import { lessonAnalyticsEntries, lessonAnalyticsPayload, lessonEventDedupeKey } from "../src/lib/learning/analytics-events";
import { crossedProgressBuckets, lessonProgressEvents } from "../src/lib/learning/progress";
import { objectiveToServiceName, toServiceAnalyticsName } from "../src/lib/service-analytics";

assert.equal(toServiceAnalyticsName("site-trafego"), "site_trafego");
assert.equal(toServiceAnalyticsName("trafego-pago"), "trafego_pago");
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

assert.equal(CONSENT_STORAGE_KEY, "af_consent_v1");
assert.equal(ATTRIBUTION_STORAGE_KEY, "af_attribution");

function assertSignals(
  choice: { analytics: boolean; marketing: boolean },
  expected: {
    analytics_storage: "granted" | "denied";
    ad_storage: "granted" | "denied";
    ad_user_data: "granted" | "denied";
    ad_personalization: "granted" | "denied";
  },
) {
  assert.deepEqual(consentToGoogleSignals(serializeConsent(choice)), expected);
}

// Default / reject
assertSignals(
  { analytics: false, marketing: false },
  {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  },
);

// Accept all
assertSignals(
  { analytics: true, marketing: true },
  {
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  },
);

// Analytics only
assertSignals(
  { analytics: true, marketing: false },
  {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  },
);

// Marketing only
assertSignals(
  { analytics: false, marketing: true },
  {
    analytics_storage: "denied",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  },
);

// Persistência: salvar → serializar → restaurar
const accepted = serializeConsent({ analytics: true, marketing: true });
const restored = parseConsent(JSON.stringify(accepted));
assert.equal(restored?.analytics, true);
assert.equal(restored?.marketing, true);
assert.equal(restored?.necessary, true);

// Mudança granted → denied
const revoked = serializeConsent({ analytics: true, marketing: false });
assert.deepEqual(consentToGoogleSignals(revoked), {
  analytics_storage: "granted",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
});

// Mudança denied → granted
const grantedAgain = serializeConsent({ analytics: false, marketing: true });
assert.deepEqual(consentToGoogleSignals(grantedAgain), {
  analytics_storage: "denied",
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
});

assert.equal(parseConsent("invalid"), null);
assert.equal(parseConsent('{"analytics":"yes"}'), null);
assert.equal(parseConsent(null), null);

// Evento consent_update (payload não identificável; espelha a preferência)
function consentUpdateEvent(choice: { analytics: boolean; marketing: boolean }) {
  return {
    event: "consent_update",
    consent_analytics: choice.analytics === true,
    consent_marketing: choice.marketing === true,
  };
}

assert.deepEqual(consentUpdateEvent({ analytics: false, marketing: false }), {
  event: "consent_update",
  consent_analytics: false,
  consent_marketing: false,
});
assert.deepEqual(consentUpdateEvent({ analytics: true, marketing: false }), {
  event: "consent_update",
  consent_analytics: true,
  consent_marketing: false,
});
assert.deepEqual(consentUpdateEvent({ analytics: false, marketing: true }), {
  event: "consent_update",
  consent_analytics: false,
  consent_marketing: true,
});
assert.deepEqual(consentUpdateEvent({ analytics: true, marketing: true }), {
  event: "consent_update",
  consent_analytics: true,
  consent_marketing: true,
});

const lessonPayload = lessonAnalyticsEntries(
  lessonAnalyticsPayload({
    lessonSlug: "como-funciona-o-trafego-pago",
    courseSlug: "trafego-pago-na-pratica",
    accessType: "FREE",
    progressBucket: 50,
  }),
);
assert.deepEqual(Object.keys(lessonPayload).sort(), ["access_type", "course_slug", "lesson_slug", "progress_bucket"]);
assert.equal(lessonPayload.progress_bucket, 50);
assert.deepEqual(crossedProgressBuckets(0, 50), [25, 50]);
assert.equal(lessonProgressEvents(90, 100)[0]?.event, "lesson_completed");
assert.equal(lessonProgressEvents(0, 75).some((item) => item.bucket === 100), false);
assert.equal(lessonEventDedupeKey("como-funciona-o-trafego-pago", "lesson_started"), "af_lesson_started_como-funciona-o-trafego-pago");
assert.equal(lessonEventDedupeKey("como-funciona-o-trafego-pago", "lesson_started").includes("@"), false);
assert.equal(lessonEventDedupeKey("como-funciona-o-trafego-pago", "lesson_started").includes("user"), false);
assert.equal("email" in lessonPayload, false);
assert.equal("userId" in lessonPayload, false);

console.log("analytics checks ok");
