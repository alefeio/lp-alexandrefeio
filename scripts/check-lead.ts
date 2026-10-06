import assert from "node:assert/strict";
import {
  buildConfirmationEmail,
  buildLeadEmail,
  deliverLeadEmail,
  dispatchLeadEmails,
  formatWhatsApp,
  prepareLead,
  validateLead,
  type OutboundEmail,
  type SendFailure,
} from "../src/lib/lead";

const valid = {
  name: "Ana Souza",
  company: "Clínica Exemplo",
  whatsapp: "91988887777",
  email: " Ana.Souza+site@Example.com ",
  objective: "criar-site",
  extra: "",
  startedAt: Date.now() - 5000,
};

const prepared = prepareLead(valid);
if (!prepared.ok) throw new Error("valid lead was rejected");
const lead = prepared.lead;
assert.equal(lead.email, "ana.souza+site@example.com");
assert.equal(lead.whatsapp, "(91) 98888-7777");
assert.deepEqual(lead.attribution, {});
assert.equal(formatWhatsApp("9198887777"), "(91) 9888-7777");
assert.equal(formatWhatsApp("+55 91 98888-7777"), "+55 (91) 98888-7777");

const attributed = prepareLead({
  ...valid,
  attribution: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "sites-belem",
    gclid: "test-gclid",
  },
});
if (!attributed.ok) throw new Error("attributed lead was rejected");
assert.match(buildLeadEmail(attributed.lead).text, /ORIGEM DO LEAD/);
assert.match(buildLeadEmail(attributed.lead).text, /test-gclid/);

const email = buildLeadEmail(lead);
assert.match(email.subject, /^Novo contato pelo site — Ana Souza$/);
assert.match(email.text, /NOVO CONTATO PELO SITE/);
assert.match(email.text, /Criar um site/);
assert.match(email.text, /ana\.souza\+site@example\.com/);
assert.match(email.text, /alexandrefeio.com.br/);
assert.match(email.html, /https:\/\/wa\.me\/91988887777/);
assert.match(email.html, /mailto:ana\.souza\+site@example\.com/);
assert.equal(email.html.includes("<script>"), false);

const confirmation = buildConfirmationEmail(lead);
assert.equal(confirmation.subject, "Recebi seu contato — Alexandre Feio");
assert.match(confirmation.text, /Olá, Ana Souza\./);
assert.match(confirmation.text, /Criar um site/);
assert.match(confirmation.html, /Ana Souza/);
assert.equal(confirmation.html.includes("promo"), false);

const hostile = prepareLead({
  ...valid,
  name: "Ana\r\nBcc: x",
  company: "<script>alert(1)</script>",
  email: "ana@example.com",
});
if (!hostile.ok) throw new Error("hostile lead was rejected");
const hostileEmail = buildLeadEmail(hostile.lead);
const hostileConfirmation = buildConfirmationEmail(hostile.lead);
assert.equal(hostileEmail.subject.includes("\n"), false);
assert.match(hostileEmail.html, /&lt;script&gt;/);
assert.equal(hostileConfirmation.html.includes("\nBcc"), false);
assert.match(hostileConfirmation.text, /Ana Bcc: x/);

assert.ok(validateLead({ ...valid, name: " " }).name);
assert.ok(validateLead({ ...valid, whatsapp: "" }).whatsapp);
assert.ok(validateLead({ ...valid, email: "" }).email);
assert.ok(validateLead({ ...valid, email: "ana@" }).email);
assert.ok(validateLead({ ...valid, email: "ana@ex\nample.com" }).email);
assert.equal(validateLead({ ...valid, email: "ana.souza@example.com" }).email, undefined);
assert.ok(validateLead({ ...valid, objective: "invalido" }).objective);
assert.equal(validateLead(valid).company, undefined);

assert.equal(prepareLead({ ...valid, extra: "bot" }).ok, false);
assert.equal(prepareLead({ ...valid, startedAt: 0 }).ok, false);
assert.equal(prepareLead({ ...valid, startedAt: Date.now() }).ok, false);
assert.equal(prepareLead({ ...valid, objective: "invalido" }).ok, false);
assert.equal(prepareLead({ ...valid, email: "nao-e-email" }).ok, false);

const routing = { adminTo: "alexandrefpenha@gmail.com", replyTo: "alexandrefpenha@gmail.com" };

async function main() {
  const sent = await deliverLeadEmail(email, "admin", async () => null);
  assert.equal(sent, "sent");

  const failed = await deliverLeadEmail(email, "admin", async () => ({ name: "validation_error", statusCode: 403 }));
  assert.equal(failed, "failed");

  const thrown = await deliverLeadEmail(email, "admin", async () => {
    throw new Error("network");
  });
  assert.equal(thrown, "failed");

  const both = await dispatchLeadEmails(lead, routing, async (message) => {
    assert.ok(message.subject.length > 0);
    return null;
  });
  assert.deepEqual(both, { ok: true, confirmation: "sent" });

  let adminCalls = 0;
  const adminFailed = await dispatchLeadEmails(lead, routing, async () => {
    adminCalls += 1;
    return { name: "validation_error", statusCode: 422 };
  });
  assert.equal(adminCalls, 1);
  assert.deepEqual(adminFailed, { ok: false, stage: "admin" });

  const seen: OutboundEmail[] = [];
  const confirmationFailed = await dispatchLeadEmails(lead, routing, async (message) => {
    seen.push(message);
    if (seen.length === 1) return null;
    return { name: "application_error", statusCode: 500 } satisfies SendFailure;
  });
  assert.equal(seen.length, 2);
  assert.equal(seen[0]?.to, "alexandrefpenha@gmail.com");
  assert.equal(seen[0]?.replyTo, "ana.souza+site@example.com");
  assert.equal(seen[1]?.to, "ana.souza+site@example.com");
  assert.equal(seen[1]?.replyTo, "alexandrefpenha@gmail.com");
  assert.match(seen[1]?.subject ?? "", /^Recebi seu contato — Alexandre Feio$/);
  assert.deepEqual(confirmationFailed, { ok: true, confirmation: "failed" });

  console.log("lead checks ok");
}

void main();
